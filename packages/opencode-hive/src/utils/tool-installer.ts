/**
 * Tool Auto-Installer
 * Auto-installs hive dependencies (Agent Tools + CLI Tools) on plugin load.
 * All tools are npm packages installed into ~/.config/opencode/hive/packages/
 */
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execSync, exec } from 'child_process';
import { promisify } from 'util';
import { shouldSkipAutoInstall } from './skip-install.js';

const asyncExec = promisify(exec);

/** Node/npm runtimes to probe when choosing the installer (first match wins). */
const NODE_RUNTIME_NAMES = ['node', 'bun'];

/** Whether a runtime/package-manager command is available to spawn. */
function isExecutableOnPath(name: string, envPath: string = process.env.PATH ?? ''): boolean {
  const dirs = envPath.split(path.delimiter).filter(Boolean);
  return dirs.some((dir) => {
    try {
      fs.accessSync(path.join(dir, name), fs.constants.X_OK);
      return true;
    } catch {
      return false;
    }
  });
}

/**
 * Pick the package manager used for auto-install.
 *
 * `bun` is preferred but not required: `bun pm bin -g` and `bun test` do not
 * put `bun` on PATH (see the CI workflow, which only installs Bun), while npm
 * ships with Node. Returning null means no installer is available and the
 * tools must degrade gracefully instead of logging a hard failure.
 */
export function resolveInstaller(
  envPath: string = process.env.PATH ?? '',
): { command: 'npm' | 'bun add'; label: 'npm' | 'bun' } | null {
  if (NODE_RUNTIME_NAMES.some((runtime) => isExecutableOnPath(runtime, envPath)) && isExecutableOnPath('npm', envPath)) {
    return { command: 'npm', label: 'npm' };
  }
  if (isExecutableOnPath('bun', envPath)) {
    return { command: 'bun add', label: 'bun' };
  }
  return null;
}

const HIVE_DIR = path.join(os.homedir(), '.config', 'opencode', 'hive');
const PACKAGES_DIR = path.join(HIVE_DIR, 'packages');
const NODE_MODULES_DIR = path.join(PACKAGES_DIR, 'node_modules');
const BIN_DIR = path.join(HIVE_DIR, 'bin');

interface ToolEntry {
  name: string;
  version?: string;
  category: 'agent' | 'cli';
  binaries?: string[];
  /**
   * Skip this tool entirely. Kept for dependencies that are known to be
   * unusable at the source (not just slow or missing), so plugin load never
   * spends time on an install that cannot succeed.
   */
  disabledReason?: string;
}

const TOOLS: ToolEntry[] = [
  { name: '@sparkleideas/agent-booster', version: '0.2.34', category: 'agent' },
  // No published release of @sparkleideas/memory provides the facade API Hive
  // needs (`add`/`search`); the three.js chain also wants `@sparkleideas/agentdb@alpha`,
  // whose tarballs ship without `dist/` (require fails). Installing it therefore
  // can never enable vector search, so it is disabled: hive_vector_* stays on
  // the documented sharded text-search fallback.
  {
    name: '@sparkleideas/memory',
    category: 'agent',
    disabledReason: 'no usable release on npm (missing dist/ + missing agentdb@alpha); vector memory runs on text-search fallback',
  },
  { name: 'bun-pty', category: 'agent' },
  // auto-cr ships its executable as `check`; `auto-cr-cmd` is kept as an
  // alias so both names resolve after install.
  { name: 'auto-cr-cmd', category: 'cli', binaries: ['check', 'auto-cr-cmd'] },
  { name: 'btca', category: 'cli', binaries: ['btca'] },
];

/** Tools Hive considers for auto-install (disabled ones are excluded). */
function installableTools(): ToolEntry[] {
  return TOOLS.filter((tool) => !tool.disabledReason);
}

/** Dependencies that are intentionally not installed, with the reason. */
export function disabledToolReasons(): Record<string, string> {
  return Object.fromEntries(
    TOOLS.filter((tool) => tool.disabledReason).map((tool) => [tool.name, tool.disabledReason!]),
  );
}

export function getHiveNodeModulesPath(): string {
  return NODE_MODULES_DIR;
}

export function getHiveBinPath(): string {
  return BIN_DIR;
}

// Cached result of `npm root -g` (undefined = not yet resolved, null = unavailable)
let cachedGlobalRoot: string | null | undefined;

/**
 * Global npm root from `npm root -g` (plus bun/pnpm fallbacks), cached for process lifetime (null when unavailable).
 */
export function getGlobalNpmRoot(): string | null {
  if (cachedGlobalRoot !== undefined) return cachedGlobalRoot;
  const candidates: string[] = [];
  const tryCmd = (cmd: string): string | null => {
    try {
      const out = execSync(cmd, { encoding: 'utf-8', timeout: 5000, stdio: ['ignore', 'pipe', 'ignore'] }).trim();
      if (out && fs.existsSync(out)) return out;
    } catch {}
    return null;
  };
  candidates.push(tryCmd('npm root -g') ?? '');
  candidates.push(tryCmd('bun pm bin -g 2>/dev/null | xargs dirname 2>/dev/null') ?? '');
  candidates.push(tryCmd('pnpm root -g 2>/dev/null') ?? '');
  // bun global install often uses ~/.bun/install/global/node_modules
  const bunGlobal = path.join(os.homedir(), '.bun', 'install', 'global', 'node_modules');
  if (fs.existsSync(bunGlobal)) candidates.push(bunGlobal);
  for (const c of candidates) {
    if (c && fs.existsSync(c)) {
      cachedGlobalRoot = c;
      return cachedGlobalRoot;
    }
  }
  cachedGlobalRoot = null;
  return cachedGlobalRoot;
}

/** Check if an npm module is resolvable from the hive packages, global install, or normal require. */
function isModuleResolvable(name: string, requiredVersion?: string): boolean {
  const checkVersion = (pkgPath: string): boolean => {
    if (!requiredVersion) return true;
    try {
      const ver = JSON.parse(fs.readFileSync(path.join(pkgPath, 'package.json'), 'utf-8')).version as string;
      return ver === requiredVersion;
    } catch { return false; }
  };
  const hivePath = path.join(NODE_MODULES_DIR, name);
  if (fs.existsSync(hivePath) && checkVersion(hivePath)) return true;
  const globalRoot = getGlobalNpmRoot();
  const globalPath = globalRoot ? path.join(globalRoot, name) : '';
  if (globalPath && fs.existsSync(globalPath) && checkVersion(globalPath)) return true;
  try {
    const resolved = require.resolve(path.join(name, 'package.json'));
    if (requiredVersion) {
      const ver = JSON.parse(fs.readFileSync(resolved, 'utf-8')).version as string;
      return ver === requiredVersion;
    }
    return true;
  } catch {
    return false;
  }
}

/** Check if a CLI binary is on PATH or in the hive bin dir. */
function isCliAvailable(binary: string): boolean {
  if (fs.existsSync(path.join(BIN_DIR, binary))) return true;
  try {
    execSync(`which ${binary} 2>/dev/null`, { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

export function isToolAvailable(name: string): boolean {
  const tool = TOOLS.find(t => t.name === name);
  if (!tool) return isModuleResolvable(name) || isCliAvailable(name);
  if (tool.category === 'agent') return isModuleResolvable(tool.name, tool.version);
  return (tool.binaries ?? []).some(b => isCliAvailable(b));
}

/**
 * Auto-install all tools into the hive packages directory.
 * Agent Tools land in node_modules for require() resolution.
 * CLI Tools get binaries symlinked to hive/bin/ for PATH access.
 */
export async function ensureToolsInstalled(): Promise<{ installed: string[]; failed: string[] }> {
  // Cleanup stale binaries from removed tools (e.g. dora after 1.20.1)
  try {
    const staleBins = ['dora'];
    for (const bin of staleBins) {
      const p = path.join(BIN_DIR, bin);
      if (fs.existsSync(p)) {
        fs.unlinkSync(p);
        console.log(`[hive:installer] Removed stale bin: ${bin}`);
      }
    }
  } catch {}
  if (shouldSkipAutoInstall()) {
    return { installed: [], failed: [] };
  }
  const installed: string[] = [];
  const failed: string[] = [];

  const toInstall = installableTools().filter(t => !isToolAvailable(t.name));
  if (toInstall.length === 0) {
    return { installed: [], failed: [] };
  }

  const installer = resolveInstaller();
  if (!installer) {
    console.warn('[hive:installer] No npm or bun on PATH; skipping tool auto-install (tools degrade gracefully)');
    return { installed: [], failed: toInstall.map(t => t.name) };
  }

  console.log(`[hive:installer] Auto-installing ${toInstall.length} tool(s) via ${installer.label}: ${toInstall.map(t => t.name).join(', ')}`);

  fs.mkdirSync(PACKAGES_DIR, { recursive: true });
  fs.mkdirSync(BIN_DIR, { recursive: true });

  const packageNames = toInstall.map(t => t.version ? `${t.name}@${t.version}` : t.name);
  try {
    const installCommand = installer.command === 'npm'
      ? `npm install --prefix "${PACKAGES_DIR}" --no-package-lock --no-save ${packageNames.join(' ')}`
      : `bun add --cwd "${PACKAGES_DIR}" --no-save ${packageNames.join(' ')}`;
    await asyncExec(installCommand, { timeout: 120000 });

    for (const tool of toInstall) {
      if (tool.category === 'cli' && tool.binaries) {
        // Link every declared binary. When a declared bin name is missing from
        // node_modules/.bin (e.g. `auto-cr-cmd` ships only `check`), alias it
        // to the first source that exists so both names stay callable.
        const sources = tool.binaries.map((bin) => path.join(NODE_MODULES_DIR, '.bin', bin));
        const primarySource = sources.find((src) => fs.existsSync(src));
        for (let i = 0; i < tool.binaries.length; i++) {
          const target = path.join(BIN_DIR, tool.binaries[i]);
          if (fs.existsSync(target)) continue;
          const linkSource = fs.existsSync(sources[i]) ? sources[i] : primarySource;
          if (!linkSource) continue;
          try {
            fs.symlinkSync(linkSource, target);
          } catch {
            fs.copyFileSync(linkSource, target);
            fs.chmodSync(target, 0o755);
          }
        }
      }
    }

    const names = toInstall.map(t => t.name);
    console.log(`[hive:installer] Installed: ${names.join(', ')}`);
    installed.push(...names);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // A package the registry cannot satisfy (e.g. a transitive `@alpha`
    // dependency that was never published) must not block the rest of the
    // batch on every start: retry one by one and report what fails.
    if (toInstall.length > 1) {
      for (const tool of toInstall) {
        const spec = tool.version ? `${tool.name}@${tool.version}` : tool.name;
        try {
          const singleCommand = installer.command === 'npm'
            ? `npm install --prefix "${PACKAGES_DIR}" --no-package-lock --no-save ${spec}`
            : `bun add --cwd "${PACKAGES_DIR}" --no-save ${spec}`;
          await asyncExec(singleCommand, { timeout: 120000 });
          installed.push(tool.name);
        } catch {
          failed.push(tool.name);
        }
      }
      if (installed.length > 0) {
        console.log(`[hive:installer] Installed individually via ${installer.label}: ${installed.join(', ')}`);
      }
      if (failed.length > 0) {
        console.warn(`[hive:installer] Failed individually: ${failed.join(', ')} (tools fall back to graceful degradation)`);
      }
      return { installed, failed };
    }
    console.warn(`[hive:installer] Install failed: ${message}`);
    console.warn('[hive:installer] Tools will fall back to graceful degradation');
    failed.push(...packageNames);
  }

  return { installed, failed };
}
