import { describe, test, expect } from 'bun:test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { resolveInstaller, disabledToolReasons } from './tool-installer.js';

/**
 * Tool auto-install hardening.
 *
 * `bun pm bin -g` and `bun test` do not put `bun` on PATH (the CI workflow only
 * installs Bun via setup-bun), so auto-install once hard-failed there with
 * `/bin/sh: 1: npm: not found` on every plugin load. The installer now picks
 * whatever package manager actually exists, and reports "no installer" cleanly.
 */

function tempBinDir(files: string[]): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hive-installer-path-'));
  for (const name of files) {
    const file = path.join(dir, name);
    fs.writeFileSync(file, '#!/bin/sh\nexit 0\n');
    fs.chmodSync(file, 0o755);
  }
  return dir;
}

describe('resolveInstaller', () => {
  test('prefers npm when node and npm are on PATH', () => {
    const dir = tempBinDir(['node', 'npm', 'bun']);
    try {
      expect(resolveInstaller(dir)?.command).toBe('npm');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('falls back to bun when npm is missing', () => {
    const dir = tempBinDir(['bun']);
    try {
      expect(resolveInstaller(dir)).toEqual({ command: 'bun add', label: 'bun' });
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('returns null when no installer is available', () => {
    const dir = tempBinDir([]);
    try {
      expect(resolveInstaller(dir)).toBeNull();
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('does not treat npm without a node runtime as usable', () => {
    const dir = tempBinDir(['npm']);
    try {
      expect(resolveInstaller(dir)).toBeNull();
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('disabledToolReasons', () => {
  test('skips @sparkleideas/memory with a documented reason', () => {
    const reasons = disabledToolReasons();
    expect(Object.keys(reasons)).toContain('@sparkleideas/memory');
    expect(reasons['@sparkleideas/memory']).toMatch(/agentdb|dist/);
    // agent-booster is still usable and must stay installable.
    expect(Object.keys(reasons)).not.toContain('@sparkleideas/agent-booster');
  });
});
