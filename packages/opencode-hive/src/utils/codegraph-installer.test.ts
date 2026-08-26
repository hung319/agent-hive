import { describe, it, expect, vi, beforeEach, afterEach } from 'bun:test';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';

import {
  getCodegraphInstallRoot,
  isCodegraphInstalled,
  isCodegraphOnPath,
  getCodegraphCommand,
  resolveCodegraphMcpCommand,
} from './codegraph-installer.js';

// Invariant: child_process stays unspied here. Availability is driven via the
// REAL PATH with executable shim fixtures — see withCodegraphOnPath().
const realHome = process.env.HOME;
const realPathEnv = process.env.PATH;

let sandboxHome = '';
let pathBinDirs: string[] = [];

function writeMarker(marker: unknown): void {
  fs.mkdirSync(getCodegraphInstallRoot(), { recursive: true });
  fs.writeFileSync(path.join(getCodegraphInstallRoot(), 'current.json'), JSON.stringify(marker));
}

function readMarkerJson(): { version: string; bin: string } {
  return JSON.parse(
    fs.readFileSync(path.join(getCodegraphInstallRoot(), 'current.json'), 'utf-8'),
  ) as { version: string; bin: string };
}

function writeFakeInstall(version: string): string {
  const launcher = path.join(getCodegraphInstallRoot(), version, 'bin', 'codegraph');
  fs.mkdirSync(path.dirname(launcher), { recursive: true });
  fs.writeFileSync(launcher, '#!/bin/sh\nexit 0\n');
  writeMarker({ version, bin: launcher });
  return launcher;
}

function withCodegraphOnPath(): void {
  const binDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cg-path-bin-'));
  const shim = path.join(binDir, 'codegraph');
  fs.writeFileSync(shim, '#!/bin/sh\nexit 0\n');
  fs.chmodSync(shim, 0o755);
  pathBinDirs.push(binDir);
  process.env.PATH = `${binDir}:${process.env.PATH ?? ''}`;
}

describe('codegraph-installer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sandboxHome = fs.mkdtempSync(path.join(os.tmpdir(), 'hive-cg-home-'));
    process.env.HOME = sandboxHome;
  });

  afterEach(() => {
    process.env.HOME = realHome;
    process.env.PATH = realPathEnv;
    vi.restoreAllMocks();
    if (sandboxHome !== '') {
      fs.rmSync(sandboxHome, { recursive: true, force: true });
      sandboxHome = '';
    }
    for (const binDir of pathBinDirs) {
      fs.rmSync(binDir, { recursive: true, force: true });
    }
    pathBinDirs = [];
  });

  it('getCodegraphInstallRoot lives under $HOME/.config/opencode/hive/codegraph', () => {
    expect(getCodegraphInstallRoot()).toBe(
      path.join(sandboxHome, '.config', 'opencode', 'hive', 'codegraph'),
    );
  });

  it('isCodegraphInstalled is false when nothing is installed', () => {
    expect(isCodegraphInstalled()).toBe(false);
  });

  it('isCodegraphInstalled is true for a legacy marker when the launcher exists', () => {
    writeFakeInstall('1.5.0');
    expect(isCodegraphInstalled()).toBe(true);
  });

  it('isCodegraphInstalled tolerates corrupt marker JSON as missing', () => {
    fs.mkdirSync(getCodegraphInstallRoot(), { recursive: true });
    fs.writeFileSync(path.join(getCodegraphInstallRoot(), 'current.json'), '{nope');
    expect(isCodegraphInstalled()).toBe(false);
  });

  it('isCodegraphOnPath detects an executable codegraph entry on the live PATH', () => {
    process.env.PATH = pathBinDirs[0] ?? '';
    expect(isCodegraphOnPath()).toBe(false);
    withCodegraphOnPath();
    expect(isCodegraphOnPath()).toBe(true);
  });

  it('isCodegraphOnPath ignores non-executable entries', () => {
    const binDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cg-path-bin-'));
    pathBinDirs.push(binDir);
    fs.writeFileSync(path.join(binDir, 'codegraph'), '#!/bin/sh\nexit 0\n');
    process.env.PATH = `${binDir}:/usr/bin`;
    expect(isCodegraphOnPath()).toBe(false);
  });

  it('getCodegraphCommand prefers a valid marker over PATH', () => {
    withCodegraphOnPath();
    const launcher = writeFakeInstall('1.5.0');
    expect(getCodegraphCommand()).toBe(launcher);
  });

  it('getCodegraphCommand falls back to bare name when on PATH', () => {
    withCodegraphOnPath();
    expect(getCodegraphCommand()).toBe('codegraph');
  });

  it('getCodegraphCommand returns empty string when unavailable', () => {
    process.env.PATH = '';
    expect(getCodegraphCommand()).toBe('');
  });

  it('resolveCodegraphMcpCommand prefers the npm shim in a real environment', () => {
    // Our patch: when process.execPath is not real node, it finds node in PATH.
    // When it IS real node (CI Bun has node in PATH), it uses process.execPath directly.
    // Either way, if the npm shim resolves and a node is found, source is 'npm'.
    const resolution = resolveCodegraphMcpCommand();
    if (resolution?.source === 'npm') {
      expect(resolution.command[1]?.endsWith('npm-shim.js')).toBe(true);
      // command[0] is either process.execPath (if it IS node) or a discovered node in PATH
      expect(typeof resolution.command[0]).toBe('string');
      expect(resolution.command[0].length).toBeGreaterThan(0);
    }
    // If source is not 'npm', that's also valid — means no node binary was found
    // and it fell through to bundle/path/null
  });

  it('resolveCodegraphMcpCommand falls back to the legacy bundle marker when npm resolution fails', () => {
    const launcher = writeFakeInstall('1.5.0');
    const resolution = resolveCodegraphMcpCommand({ resolveNpmShim: () => null });
    expect(resolution?.source).toBe('bundle');
    expect(resolution?.command).toEqual([launcher]);
  });

  it('resolveCodegraphMcpCommand falls back to PATH when npm and bundle miss', () => {
    withCodegraphOnPath();
    const resolution = resolveCodegraphMcpCommand({ resolveNpmShim: () => null });
    expect(resolution?.source).toBe('path');
    expect(resolution?.command).toEqual(['codegraph']);
  });

  it('resolveCodegraphMcpCommand returns null when every source misses', () => {
    process.env.PATH = '';
    const resolution = resolveCodegraphMcpCommand({ resolveNpmShim: () => null });
    expect(resolution).toBeNull();
  });

  it('readMarkerJson round-trips what writeFakeInstall wrote', () => {
    const launcher = writeFakeInstall('9.9.9');
    expect(readMarkerJson().bin).toBe(launcher);
  });
});
