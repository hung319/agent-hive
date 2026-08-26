import { describe, it, expect, vi, beforeEach, afterEach } from 'bun:test';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';

import { ensureCodegraphInit } from './codegraph-init.js';
import type { CodegraphExecFn } from './codegraph-init.js';

let projectRoot = '';

function fakeRunner(): CodegraphExecFn & { mock: { calls: unknown[][] } } {
  const fn = vi.fn(async () => ({ stdout: '', stderr: '' })) as unknown as CodegraphExecFn & {
    mock: { calls: unknown[][] },
  };
  return fn;
}

describe('ensureCodegraphInit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'hive-cginit-proj-'));
  });

  afterEach(() => {
    fs.rmSync(projectRoot, { recursive: true, force: true });
  });

  it('skips when the command is an empty string', async () => {
    const execFn = fakeRunner();
    const result = await ensureCodegraphInit(projectRoot, '', execFn);
    expect(result).toMatchObject({ success: true, action: 'skipped' });
    expect(execFn).not.toHaveBeenCalled();
  });

  it('skips when the command is an empty array', async () => {
    const execFn = fakeRunner();
    const result = await ensureCodegraphInit(projectRoot, [], execFn);
    expect(result).toMatchObject({ success: true, action: 'skipped' });
    expect(execFn).not.toHaveBeenCalled();
  });

  it('defaults to the real resolver when no command is given', async () => {
    const execFn = fakeRunner();
    const result = await ensureCodegraphInit(projectRoot, undefined, execFn);
    expect(result).toMatchObject({ success: true, action: 'init' });
    const [file, args] = execFn.mock.calls[0] as [string, string[]];
    // With our node-binary patch, the resolver may pick npm shim (source='npm'),
    // managed bundle (source='bundle'), or bare 'codegraph' on PATH (source='path').
    // All are valid — the important thing is that a command was resolved.
    expect(typeof file).toBe('string');
    expect(file.length).toBeGreaterThan(0);
    expect(args.at(-1)).toBe('init');
  });

  it('runs init with the provided string command when .codegraph is missing', async () => {
    const execFn = fakeRunner();
    const result = await ensureCodegraphInit(projectRoot, '/opt/cg/bin/codegraph', execFn);
    expect(result).toMatchObject({ success: true, action: 'init' });
    expect(execFn.mock.calls[0]?.[0]).toBe('/opt/cg/bin/codegraph');
    expect(execFn.mock.calls[0]?.[1]).toEqual(['init']);
    expect(execFn.mock.calls[0]?.[2]).toMatchObject({ cwd: projectRoot });
  });

  it('runs argv-style commands keeping extra flags before the subcommand', async () => {
    const execFn = fakeRunner();
    const result = await ensureCodegraphInit(
      projectRoot,
      ['/bin/execPath', '/shim/npm-shim.js', '--quiet'],
      execFn,
    );
    expect(result).toMatchObject({ success: true, action: 'init' });
    expect(execFn.mock.calls[0]?.[0]).toBe('/bin/execPath');
    expect(execFn.mock.calls[0]?.[1]).toEqual(['/shim/npm-shim.js', '--quiet', 'init']);
  });

  it('runs sync with the provided command when .codegraph exists', async () => {
    fs.mkdirSync(path.join(projectRoot, '.codegraph'));
    const execFn = fakeRunner();
    const result = await ensureCodegraphInit(projectRoot, '/opt/cg/bin/codegraph', execFn);
    expect(result).toMatchObject({ success: true, action: 'sync' });
    expect(execFn.mock.calls[0]?.[1]).toEqual(['sync']);
  });

  it('returns an error result when the runner fails', async () => {
    const execFn = vi.fn(async () => {
      throw new Error('spawn failed');
    }) as unknown as CodegraphExecFn;
    const result = await ensureCodegraphInit(projectRoot, '/opt/cg/bin/codegraph', execFn);
    expect(result).toMatchObject({ success: false, action: 'error' });
  });
});
