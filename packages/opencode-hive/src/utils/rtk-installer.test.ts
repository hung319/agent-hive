import { describe, test, expect } from 'bun:test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  ensureRtkInstalled,
  getRtkCommand,
  isRtkOnPath,
  prefixWithRtk,
} from './rtk-installer.js';

/**
 * RTK is an optional, user-installed binary. Hive used to download it from
 * GitHub on every plugin load and then rewrite shell commands to point at it.
 * A failed download left commands pointing at a binary that was not there.
 *
 * These tests pin the contract: resolving RTK never reaches the network, and
 * a command is only rewritten when the binary is genuinely executable.
 */
describe('rtk resolution', () => {
  test('ensureRtkInstalled never downloads: it only resolves', async () => {
    const source = await Bun.file(new URL('./rtk-installer.ts', import.meta.url)).text();

    expect(source).not.toContain('fetch(');
    expect(source).not.toContain('execSync');
    expect(source).not.toContain('releases/download');
    // The resolved value is produced by getRtkCommand(), i.e. PATH/disk only.
    expect(source).toContain('return getRtkCommand();');
  });

  test('resolves to empty when no binary is present', async () => {
    const originalPath = process.env.PATH;
    const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'hive-rtk-empty-'));
    process.env.PATH = empty;
    try {
      expect(isRtkOnPath()).toBe(false);
      expect(await ensureRtkInstalled()).toBe('');
      expect(getRtkCommand()).toBe('');
    } finally {
      process.env.PATH = originalPath;
      fs.rmSync(empty, { recursive: true, force: true });
    }
  });

  test('resolves a bare name once the binary is on PATH', async () => {
    const originalPath = process.env.PATH;
    const binDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hive-rtk-bin-'));
    const binary = path.join(binDir, 'rtk');
    fs.writeFileSync(binary, '#!/bin/sh\nexit 0\n');
    fs.chmodSync(binary, 0o755);
    process.env.PATH = binDir;
    try {
      expect(isRtkOnPath()).toBe(true);
      expect(await ensureRtkInstalled()).toBe('rtk');
    } finally {
      process.env.PATH = originalPath;
      fs.rmSync(binDir, { recursive: true, force: true });
    }
  });
});

describe('prefixWithRtk', () => {
  test('prefixes a plain command', () => {
    expect(prefixWithRtk('git status', 'rtk')).toBe('rtk git status');
  });

  test('does not double-prefix', () => {
    expect(prefixWithRtk('rtk git status', 'rtk')).toBe('rtk git status');
  });

  test('prefixes only the last segment of a chained command', () => {
    expect(prefixWithRtk('cd /repo && git status', 'rtk')).toBe('cd /repo && rtk git status');
  });

  test('keeps env var prefixes in front', () => {
    expect(prefixWithRtk('FOO=1 git status', 'rtk')).toBe('FOO=1 rtk git status');
  });
});
