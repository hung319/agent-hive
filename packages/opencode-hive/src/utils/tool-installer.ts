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

const HIVE_DIR = path.join(os.homedir(), '.config', 'opencode', 'hive');
const PACKAGES_DIR = path.join(HIVE_DIR, 'packages');
const NODE_MODULES_DIR = path.join(PACKAGES_DIR, 'node_modules');
const BIN_DIR = path.join(HIVE_DIR, 'bin');

interface ToolEntry {
  name: string;
  version?: string;
  category: 'agent' | 'cli';
  binaries?: string[];
}

const TOOLS: ToolEntry[] = [
  { name: '@sparkleideas/agent-booster', version: '0.2.34', category: 'agent' },
  { name: '@sparkleideas/memory', category: 'agent' },
  { name: 'bun-pty', category: 'agent' },
  // auto-cr-cmd ships its executable as `check`; `auto-cr-cmd` is kept as an
  // alias so both names resolve after install.
  { name: 'auto-cr-cmd', category: 'cli', binaries: ['check', 'auto-cr-cmd'] },
  { name: 'btca', category: 'cli', binaries: ['btca'] },
];

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

  const toInstall = TOOLS.filter(t => !isToolAvailable(t.name));
  if (toInstall.length === 0) {
    return { installed: [], failed: [] };
  }

  console.log(`[hive:installer] Auto-installing ${toInstall.length} tool(s): ${toInstall.map(t => t.name).join(', ')}`);

  fs.mkdirSync(PACKAGES_DIR, { recursive: true });
  fs.mkdirSync(BIN_DIR, { recursive: true });

  const packageNames = toInstall.map(t => t.version ? `${t.name}@${t.version}` : t.name);
  try {
    await asyncExec(
      `npm install --prefix "${PACKAGES_DIR}" --no-package-lock --no-save ${packageNames.join(' ')}`,
      { timeout: 120000 },
    );

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
    console.warn(`[hive:installer] Install failed: ${message}`);
    console.warn('[hive:installer] Tools will fall back to graceful degradation');
    failed.push(...packageNames);
  }

  return { installed, failed };
}
