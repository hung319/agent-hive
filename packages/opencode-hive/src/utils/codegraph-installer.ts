/**
 * CodeGraph MCP command resolution.
 *
 * Preferred source is the npm dependency @colbymchenry/codegraph: its
 * npm-shim.js launcher locates the per-platform bundle (optionalDependency,
 * esbuild os/cpu pattern) and self-heals by downloading from GitHub Releases
 * when the bundle is missing — so the MCP command exists without any
 * preinstalled binary and works from the first session.
 *
 * Fallbacks, in order: a legacy managed-bundle marker (current.json written by
 * earlier Hive versions), then an executable `codegraph` on the live PATH.
 */
import * as fs from 'fs';
import * as path from 'path';
import { createRequire } from 'module';

const CODEGRAPH_NPM_PKG = '@colbymchenry/codegraph';

export function getCodegraphInstallRoot(): string {
  return path.join(process.env.HOME || '/root', '.config', 'opencode', 'hive', 'codegraph');
}

interface CodegraphMarker {
  version: string;
  bin: string;
}

function getMarkerPath(): string {
  return path.join(getCodegraphInstallRoot(), 'current.json');
}

function readMarker(): CodegraphMarker | null {
  try {
    const parsed = JSON.parse(fs.readFileSync(getMarkerPath(), 'utf-8')) as Partial<CodegraphMarker>;
    if (typeof parsed.version !== 'string' || typeof parsed.bin !== 'string') {
      return null;
    }
    return { version: parsed.version, bin: parsed.bin };
  } catch {
    return null;
  }
}

/** Installed = legacy managed-bundle marker parses AND its launcher exists. */
export function isCodegraphInstalled(): boolean {
  const marker = readMarker();
  return marker !== null && fs.existsSync(marker.bin);
}

function isExecutable(candidate: string): boolean {
  try {
    fs.accessSync(candidate, fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

/** Check if an executable `codegraph` exists in any live-PATH directory.
 * Scans process.env directly instead of spawning `which`: Bun snapshots the
 * environment at startup, so child processes never see runtime PATH changes,
 * and this avoids a fork per availability check. */
export function isCodegraphOnPath(): boolean {
  const pathVar = process.env.PATH;
  if (pathVar === undefined || pathVar === '') {
    return false;
  }
  const names = process.platform === 'win32'
    ? ['codegraph.exe', 'codegraph.cmd', 'codegraph.bat']
    : ['codegraph'];
  for (const dir of pathVar.split(path.delimiter)) {
    if (dir === '') continue;
    for (const name of names) {
      if (isExecutable(path.join(dir, name))) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Get the codegraph command to use.
 * Returns the installed launcher path, 'codegraph' if on PATH, or '' if unavailable.
 */
export function getCodegraphCommand(): string {
  const marker = readMarker();
  if (marker !== null && fs.existsSync(marker.bin)) {
    return marker.bin;
  }
  if (isCodegraphOnPath()) {
    return 'codegraph';
  }
  return '';
}

export type CodegraphMcpSource = 'npm' | 'bundle' | 'path';

export interface CodegraphMcpResolution {
  command: string[];
  source: CodegraphMcpSource;
}

export interface ResolveCodegraphOptions {
  /** Injection point for tests; returns absolute shim path or null. */
  resolveNpmShim?: () => string | null;
}

function resolveNpmShimDefault(): string | null {
  try {
    const require = createRequire(import.meta.url);
    // The exports map blocks subpaths, so resolve via package.json's dirname.
    const pkgJsonPath = require.resolve(`${CODEGRAPH_NPM_PKG}/package.json`);
    return path.join(path.dirname(pkgJsonPath), 'npm-shim.js');
  } catch {
    return null;
  }
}

/**
 * Resolve the command that should back the codegraph MCP server.
 * npm shim → legacy managed bundle → PATH executable → null.
 */
export function resolveCodegraphMcpCommand(
  options: ResolveCodegraphOptions = {},
): CodegraphMcpResolution | null {
  const resolveNpmShim = options.resolveNpmShim ?? resolveNpmShimDefault;
  const shimPath = resolveNpmShim();
  if (shimPath !== null) {
    return { command: [process.execPath, shimPath], source: 'npm' };
  }
  const marker = readMarker();
  if (marker !== null && fs.existsSync(marker.bin)) {
    return { command: [marker.bin], source: 'bundle' };
  }
  if (isCodegraphOnPath()) {
    return { command: ['codegraph'], source: 'path' };
  }
  return null;
}
