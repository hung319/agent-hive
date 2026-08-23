import { describe, it, expect, vi, beforeEach, afterEach } from 'bun:test';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import * as childProcess from 'child_process';

import { getBuiltinMcps } from './index.js';
import { getCodegraphInstallRoot } from '../utils/codegraph-installer.js';

const realHome = process.env.HOME;

let sandboxHome = '';

const FAKE_VERSION = '1.5.0';

/** Write a fake installed codegraph marker + launcher into the sandboxed HOME. */
function writeFakeInstall(): string {
  const installRoot = getCodegraphInstallRoot();
  const launcher = path.join(installRoot, FAKE_VERSION, 'bin', 'codegraph');
  fs.mkdirSync(path.dirname(launcher), { recursive: true });
  fs.writeFileSync(launcher, '#!/bin/sh\nexit 0\n');
  fs.writeFileSync(
    path.join(installRoot, 'current.json'),
    JSON.stringify({ version: FAKE_VERSION, bin: launcher }),
  );
  return launcher;
}

describe('getBuiltinMcps', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sandboxHome = fs.mkdtempSync(path.join(os.tmpdir(), 'hive-mcp-home-'));
    process.env.HOME = sandboxHome;
    // Default: `which codegraph` fails -> binary deterministically NOT on PATH.
    vi.spyOn(childProcess, 'execSync').mockImplementation((() => {
      throw new Error('command not found');
    }) as typeof childProcess.execSync);
  });

  afterEach(() => {
    process.env.HOME = realHome;
    vi.restoreAllMocks();
    if (sandboxHome !== '') {
      fs.rmSync(sandboxHome, { recursive: true, force: true });
      sandboxHome = '';
    }
  });

  it('filters disabledMcps from the result', () => {
    const mcps = getBuiltinMcps(['websearch']);
    expect(mcps.websearch).toBeUndefined();
    expect(mcps.context7).toBeDefined();
    expect(mcps.grep_app).toBeDefined();
  });

  it('excludes codegraph entirely when readiness returns false', () => {
    const mcps = getBuiltinMcps([], { isCodegraphReady: () => false });
    expect(mcps.codegraph).toBeUndefined();
    expect(mcps.context7).toBeDefined();
  });

  it('includes codegraph with the installed launcher command when ready', () => {
    const launcher = writeFakeInstall();
    const mcps = getBuiltinMcps([], { isCodegraphReady: () => true });
    expect(mcps.codegraph).toMatchObject({
      type: 'local',
      command: [launcher, 'serve', '--mcp'],
      environment: { CODEGRAPH_NO_DOWNLOAD: '1' },
    });
  });

  it('omits codegraph when ready but no command resolves', () => {
    const mcps = getBuiltinMcps([], { isCodegraphReady: () => true });
    expect(mcps.codegraph).toBeUndefined();
  });

  it('leaves remote MCPs unaffected by codegraph readiness', () => {
    const mcps = getBuiltinMcps([], { isCodegraphReady: () => false });
    expect(mcps.websearch).toMatchObject({ type: 'remote' });
    expect(mcps.context7).toMatchObject({ type: 'remote' });
    expect(mcps.grep_app).toMatchObject({ type: 'remote' });
  });
});
