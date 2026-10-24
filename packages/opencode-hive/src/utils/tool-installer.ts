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

/** Package managers probed for auto-install, in order of preference. */
const INSTALL_COMMANDS = ['npm', 'bun'] as const;
type InstallCommand = (typeof INSTALL_COMMANDS)[number];

/** Whether a command is spawnable from the given PATH. */
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
 * Which package manager would be used for auto-install, given a PATH.
 *
 * Exported for `hive_status` diagnostics and tests only: auto-install itself
 * no longer leaves plugin setup, so nothing here runs during `bun test`.
 */
export function resolveInstaller(
  envPath: string = process.env.PATH ?? '',
): { command: 'npm' | 'bun add'; label: 'npm' | 'bun' } | null {
  if (isExecutableOnPath('npm', envPath)) return { command: 'npm', label: 'npm' };
  if (isExecutableOnPath('bun', envPath)) return { command: 'bun add', label: 'bun' };
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

export interface ToolInstallStatus {
  /** Tools installed by this run. */
  installed: string[];
  /** Tools the installer could not provide. */
  failed: string[];
  /** Tools left alone because no installer is available or auto-install is off. */
  skipped: string[];
}

/**
 * Install the tools that are not resolvable yet.
 *
 * Never called during plugin setup: a plugin load (a `bun test` file, an
 * offline run, a plain edit) must not reach the network, and a failing install
 * must not change that load's outcome. Tools install on first use instead
 * (`ensureToolInstalled`) and `hive_status` reports what is missing.
 *
 * Agent Tools land in node_modules for require() resolution; CLI Tools get
 * binaries symlinked to hive/bin/ for PATH access.
 */
export async function ensureToolsInstalled(): Promise<ToolInstallStatus> {
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
    return { installed: [], failed: [], skipped: [] };
  }

  const toInstall = installableTools().filter(t => !isToolAvailable(t.name));
  if (toInstall.length === 0) {
    return { installed: [], failed: [], skipped: [] };
  }

  // No installer means no network by design: the tools degrade gracefully, so
  // this stays quiet instead of warning on every load.
  const installer = resolveInstaller();
  if (!installer) {
    return { installed: [], failed: [], skipped: toInstall.map(t => t.name) };
  }

  return installTools(toInstall, installer);
}

/** Install missing tools one at a time, skipping any that cannot be provided. */
async function installTools(
  tools: ToolEntry[],
  installer: NonNullable<ReturnType<typeof resolveInstaller>>,
): Promise<ToolInstallStatus> {
  const installed: string[] = [];
  const failed: string[] = [];

  fs.mkdirSync(PACKAGES_DIR, { recursive: true });
  fs.mkdirSync(BIN_DIR, { recursive: true });

  for (const tool of tools) {
    const spec = tool.version ? `${tool.name}@${tool.version}` : tool.name;
    const command = installer.command === 'npm'
      ? `npm install --prefix "${PACKAGES_DIR}" --no-package-lock --no-save ${spec}`
      : `bun add --cwd "${PACKAGES_DIR}" --no-save ${spec}`;
    try {
      await asyncExec(command, { timeout: 120000 });
      installed.push(tool.name);
      if (tool.category === 'cli' && tool.binaries) linkToolBinaries(tool);
    } catch {
      // A package the registry cannot satisfy (an unpublished `@alpha`
      // dependency, a yanked version) must not block the tools after it.
      failed.push(tool.name);
    }
  }

  if (installed.length > 0) {
    console.log(`[hive:installer] Installed via ${installer.label}: ${installed.join(', ')}`);
  }
  if (failed.length > 0) {
    console.warn(`[hive:installer] Unavailable: ${failed.join(', ')} (those tools degrade gracefully)`);
  }
  return { installed, failed, skipped: [] };
}

/**
 * Link every declared binary of a CLI tool. When a declared bin name is
 * missing from node_modules/.bin (e.g. `auto-cr-cmd` ships only `check`),
 * alias it to the first source that exists so both names stay callable.
 */
function linkToolBinaries(tool: ToolEntry): void {
  const binaries = tool.binaries ?? [];
  const sources = binaries.map((bin) => path.join(NODE_MODULES_DIR, '.bin', bin));
  const primarySource = sources.find((src) => fs.existsSync(src));
  for (let i = 0; i < binaries.length; i++) {
    const target = path.join(BIN_DIR, binaries[i]);
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

/**
 * Make sure one tool is available, installing it on first use.
 *
 * Callers are tool implementations that genuinely need the package, so this is
 * where the network is allowed. Returns true when the tool can be used.
 */
export async function ensureToolInstalled(name: string): Promise<boolean> {
  if (isToolAvailable(name)) return true;
  const tool = TOOLS.find((t) => t.name === name);
  if (!tool || tool.disabledReason || shouldSkipAutoInstall()) return false;
  const installer = resolveInstaller();
  if (!installer) return false;
  const { installed } = await installTools([tool], installer);
  return installed.includes(name);
}
