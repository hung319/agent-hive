import { describe, test, expect } from 'bun:test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { resolveInstaller, disabledToolReasons } from './tool-installer.js';

/**
 * Tool auto-install.
 *
 * Install used to run from plugin setup, so every `bun test` load tried to
 * download tool packages with `npm`; on CI (no Node) it logged
 * `/bin/sh: 1: npm: not found`, and when npm was present a failed install could
 * change the load's outcome. Install now happens on first use instead, and
 * these tests cover the parts that are pure: which manager would be used, and
 * which packages are intentionally left alone.
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
  test('prefers npm when it is on PATH', () => {
    const dir = tempBinDir(['node', 'npm', 'bun']);
    try {
      expect(resolveInstaller(dir)).toEqual({ command: 'npm', label: 'npm' });
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
    const dir = tempBinDir(['node']);
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
