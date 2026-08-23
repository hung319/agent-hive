import { describe, it, expect, vi, beforeEach, afterEach } from 'bun:test';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import * as childProcess from 'child_process';

import { ensureCodegraphInit } from './codegraph-init.js';
import type { CodegraphExecFn } from './codegraph-init.js';

const realHome = process.env.HOME;

let sandboxHome = '';
let projectRoot = '';

describe('ensureCodegraphInit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sandboxHome = fs.mkdtempSync(path.join(os.tmpdir(), 'hive-cginit-home-'));
    projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'hive-cginit-proj-'));
    process.env.HOME = sandboxHome;
    // Default: `which codegraph` fails -> nothing installed, not on PATH.
    vi.spyOn(childProcess, 'execSync').mockImplementation((() => {
      throw new Error('command not found');
    }) as typeof childProcess.execSync);
  });

  afterEach(() => {
    process.env.HOME = realHome;
    vi.restoreAllMocks();
    fs.rmSync(sandboxHome, { recursive: true, force: true });
    fs.rmSync(projectRoot, { recursive: true, force: true });
  });

  it('skips when the resolved command is empty', async () => {
    const execFn: CodegraphExecFn = vi.fn(async () => ({ stdout: '', stderr: '' }));
    const result = await ensureCodegraphInit(projectRoot, undefined, execFn);
    expect(result).toMatchObject({ success: true, action: 'skipped' });
    expect(execFn).not.toHaveBeenCalled();
  });

  it('runs init with the provided command when .codegraph is missing', async () => {
    const execFn: CodegraphExecFn = vi.fn(async () => ({ stdout: '', stderr: '' }));
    const result = await ensureCodegraphInit(projectRoot, '/opt/cg/bin/codegraph', execFn);
    expect(result).toMatchObject({ success: true, action: 'init' });
    expect(execFn).toHaveBeenCalledTimes(1);
    expect(execFn.mock.calls[0][0]).toBe('/opt/cg/bin/codegraph');
    expect(execFn.mock.calls[0][1]).toEqual(['init']);
    expect(execFn.mock.calls[0][2]).toMatchObject({ cwd: projectRoot });
  });

  it('runs sync with the provided command when .codegraph exists', async () => {
    fs.mkdirSync(path.join(projectRoot, '.codegraph'));
    const execFn: CodegraphExecFn = vi.fn(async () => ({ stdout: '', stderr: '' }));
    const result = await ensureCodegraphInit(projectRoot, '/opt/cg/bin/codegraph', execFn);
    expect(result).toMatchObject({ success: true, action: 'sync' });
    expect(execFn.mock.calls[0][1]).toEqual(['sync']);
  });

  it('returns an error result when the runner fails', async () => {
    const execFn: CodegraphExecFn = vi.fn(async () => {
      throw new Error('spawn failed');
    });
    const result = await ensureCodegraphInit(projectRoot, '/opt/cg/bin/codegraph', execFn);
    expect(result).toMatchObject({ success: false, action: 'error' });
  });
});
