/**
 * bun-pty API shapes.
 *
 * bun-pty 0.3 exported `open(options)`; every version from 0.4 on exports
 * `spawn(file, args, options)`. pty.ts read `.open` unconditionally, so on any
 * current install pty_start threw "open2 is not a function" — which a user
 * reads as "this session has no shell". These tests pin both shapes so a
 * dependency bump cannot silently reintroduce it.
 */
import { describe, it, expect } from 'bun:test';
import { normaliseSpawn } from './pty.js';

describe('normaliseSpawn', () => {
  it('uses spawn(file, args, options) when that is exported', () => {
    const calls: unknown[][] = [];
    const mod = {
      spawn: (file: string, args: string[], options: unknown) => {
        calls.push([file, args, options]);
        return { file, args, options };
      },
    };

    const spawn = normaliseSpawn(mod);
    const pty = spawn('/bin/sh', ['-c', 'echo hi'], { cwd: '/tmp' });

    expect(calls).toEqual([['/bin/sh', ['-c', 'echo hi'], { cwd: '/tmp' }]]);
    expect(pty.file).toBe('/bin/sh');
  });

  it('falls back to the legacy open(options) shape', () => {
    const calls: unknown[] = [];
    const mod = {
      open: (options: unknown) => {
        calls.push(options);
        return { ok: true };
      },
    };

    const spawn = normaliseSpawn(mod);
    const pty = spawn('/bin/sh', ['-c', 'echo hi'], { cwd: '/tmp' });

    expect(calls).toEqual([{ cwd: '/tmp' }]);
    expect(pty.ok).toBe(true);
  });

  it('prefers spawn when a build exports both', () => {
    const spawn = normaliseSpawn({
      spawn: () => 'from-spawn',
      open: () => 'from-open',
    });
    expect(spawn('/bin/sh', [], {})).toBe('from-spawn');
  });

  it('names the install command when neither entry point exists', () => {
    expect(() => normaliseSpawn({ Terminal: class {} })).toThrow(/neither spawn\(\) nor open\(\)/);
    expect(() => normaliseSpawn({})).toThrow(/npm i -g bun-pty@latest/);
  });
});
