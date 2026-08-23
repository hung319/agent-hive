import { describe, it, expect, vi, beforeEach, afterEach } from 'bun:test';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import * as childProcess from 'child_process';
import { createHash } from 'crypto';

import {
  getCodegraphDownloadUrl,
  getCodegraphInstallRoot,
  isCodegraphInstalled,
  isCodegraphOnPath,
  getCodegraphCommand,
  ensureCodegraphInstalled,
} from './codegraph-installer.js';

const realExecSync = childProcess.execSync.bind(childProcess);
const realFetch = globalThis.fetch;
const realHome = process.env.HOME;

let sandboxHome = '';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Build a tiny codegraph-bundle tar.gz in-memory (one top-level dir, like the
 * official release archive) and return its bytes.
 */
function buildBundleTarball(): Buffer {
  const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'cg-fixture-'));
  try {
    const bundleName = 'codegraph-bundle';
    const bundleDir = path.join(fixtureRoot, bundleName);
    fs.mkdirSync(path.join(bundleDir, 'bin'), { recursive: true });
    fs.mkdirSync(path.join(bundleDir, 'lib', 'dist'), { recursive: true });
    fs.writeFileSync(path.join(bundleDir, 'node'), 'fake node runtime');
    fs.writeFileSync(
      path.join(bundleDir, 'bin', 'codegraph'),
      '#!/bin/sh\nexec ./node lib/dist/bin/codegraph.js\n',
    );
    return childProcess.execFileSync('tar', ['czf', '-', '-C', fixtureRoot, bundleName]) as Buffer;
  } finally {
    fs.rmSync(fixtureRoot, { recursive: true, force: true });
  }
}

/** Full release archive filename for this platform (same key format as SHA256SUMS entries). */
function archiveKey(): string {
  const ext = process.platform === 'win32' ? '.zip' : '.tar.gz';
  return `codegraph-${process.platform}-${process.arch}${ext}`;
}

/** Write a fake installed marker (+ optional lastCheckedAt) and launcher into the sandboxed HOME. */
function writeFakeInstall(version: string, lastCheckedAt?: number): string {
  const installRoot = getCodegraphInstallRoot();
  const launcher = path.join(installRoot, version, 'bin', 'codegraph');
  fs.mkdirSync(path.dirname(launcher), { recursive: true });
  fs.writeFileSync(launcher, '#!/bin/sh\nexit 0\n');
  const marker: Record<string, unknown> = { version, bin: launcher };
  if (lastCheckedAt !== undefined) marker.lastCheckedAt = lastCheckedAt;
  fs.writeFileSync(path.join(installRoot, 'current.json'), JSON.stringify(marker));
  return launcher;
}

function readMarkerJson(): { version: string; bin: string; lastCheckedAt?: number } {
  return JSON.parse(
    fs.readFileSync(path.join(getCodegraphInstallRoot(), 'current.json'), 'utf-8'),
  ) as { version: string; bin: string; lastCheckedAt?: number };
}

/** Minimal structural Response stub — production only touches the props each branch needs. */
function stubResponse(props: Record<string, unknown>): Response {
  return { ok: true, status: 200, ...props } as unknown as Response;
}

interface FetchRoute {
  match: RegExp;
  respond: () => Response;
}

/** Route mocked fetch calls by URL pattern; unmatched URLs throw (tripwire against stray requests). */
function stubFetch(routes: FetchRoute[]): ReturnType<typeof vi.fn> {
  const spy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: RequestInfo | URL) => {
    const url = String(input);
    const route = routes.find((candidate) => candidate.match.test(url));
    if (!route) throw new Error(`unexpected fetch: ${url}`);
    return route.respond();
  });
  return spy as unknown as ReturnType<typeof vi.fn>;
}

function tarballBody(tarball: Buffer): ArrayBuffer {
  return tarball.buffer.slice(tarball.byteOffset, tarball.byteOffset + tarball.byteLength) as ArrayBuffer;
}

function latestRedirect(tagVersion: string): FetchRoute {
  return {
    match: /\/releases\/latest$/,
    respond: () =>
      stubResponse({ url: `https://github.com/colbymchenry/codegraph/releases/tag/v${tagVersion}` }),
  };
}

describe('codegraph-installer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sandboxHome = fs.mkdtempSync(path.join(os.tmpdir(), 'hive-cg-home-'));
    process.env.HOME = sandboxHome;
    // Default: only real `tar` passes through; everything else (which codegraph) fails,
    // so the binary is deterministically NOT on PATH.
    vi.spyOn(childProcess, 'execSync').mockImplementation(((...args: Parameters<typeof childProcess.execSync>) => {
      const cmd = String(args[0] ?? '');
      if (cmd.startsWith('tar ')) {
        return realExecSync(...args);
      }
      throw new Error(`command not found: ${cmd.split(' ')[0]}`);
    }) as typeof childProcess.execSync);
  });

  afterEach(() => {
    process.env.HOME = realHome;
    delete process.env.HIVE_DISABLE_AUTO_INSTALL;
    vi.restoreAllMocks();
    globalThis.fetch = realFetch;
    if (sandboxHome !== '') {
      fs.rmSync(sandboxHome, { recursive: true, force: true });
      sandboxHome = '';
    }
  });

  it('getCodegraphDownloadUrl builds release URLs per platform', () => {
    const base = 'https://github.com/colbymchenry/codegraph/releases/download/v1.6.0';
    expect(getCodegraphDownloadUrl('1.6.0', 'linux', 'x64')).toBe(`${base}/codegraph-linux-x64.tar.gz`);
    expect(getCodegraphDownloadUrl('1.6.0', 'darwin', 'arm64')).toBe(`${base}/codegraph-darwin-arm64.tar.gz`);
    expect(getCodegraphDownloadUrl('1.6.0', 'win32', 'x64')).toBe(`${base}/codegraph-win32-x64.zip`);
  });

  it('getCodegraphDownloadUrl returns empty string for unsupported platforms', () => {
    expect(getCodegraphDownloadUrl('1.6.0', 'sunos', 'x64')).toBe('');
  });

  it('getCodegraphInstallRoot lives under $HOME/.config/opencode/hive/codegraph', () => {
    expect(getCodegraphInstallRoot()).toBe(
      path.join(sandboxHome, '.config', 'opencode', 'hive', 'codegraph'),
    );
  });

  it('isCodegraphInstalled is false when nothing is installed', () => {
    expect(isCodegraphInstalled()).toBe(false);
  });

  it('isCodegraphInstalled is true for any recorded version when the launcher exists', () => {
    writeFakeInstall('7.7.7');
    expect(isCodegraphInstalled()).toBe(true);
  });

  it('isCodegraphInstalled is true for a legacy marker without lastCheckedAt', () => {
    writeFakeInstall('1.5.0');
    expect(isCodegraphInstalled()).toBe(true);
  });

  it('isCodegraphOnPath mirrors which codegraph result', () => {
    expect(isCodegraphOnPath()).toBe(false);
    (childProcess.execSync as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => '');
    expect(isCodegraphOnPath()).toBe(true);
  });

  it('getCodegraphCommand prefers a valid marker over PATH', () => {
    (childProcess.execSync as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => '');
    const launcher = writeFakeInstall('1.5.0');
    expect(getCodegraphCommand()).toBe(launcher);
  });

  it('getCodegraphCommand falls back to bare name when on PATH', () => {
    (childProcess.execSync as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => '');
    expect(getCodegraphCommand()).toBe('codegraph');
  });

  it('getCodegraphCommand returns empty string when unavailable', () => {
    expect(getCodegraphCommand()).toBe('');
  });

  it('ensureCodegraphInstalled skips fast when HIVE_DISABLE_AUTO_INSTALL=1', async () => {
    process.env.HIVE_DISABLE_AUTO_INSTALL = '1';
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const result = await ensureCodegraphInstalled();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result).toBe('');
  });

  it('ensureCodegraphInstalled rejects corrupt downloads on sha256 mismatch', async () => {
    const garbage = Buffer.from('definitely-not-a-tarball');
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response(new Uint8Array(garbage)));
    const result = await ensureCodegraphInstalled({
      version: '9.9.9-test',
      checksums: { [archiveKey()]: '0'.repeat(64) },
    });
    expect(result).toBe('');
    expect(fs.existsSync(path.join(getCodegraphInstallRoot(), 'current.json'))).toBe(false);
  });

  it('ensureCodegraphInstalled does not fetch for unsupported platforms', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const result = await ensureCodegraphInstalled({ version: '9.9.9-test', checksums: {} });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result).toBe('');
  });

  it('ensureCodegraphInstalled installs the bundle and writes a marker with lastCheckedAt', async () => {
    const tarball = buildBundleTarball();
    const sha = createHash('sha256').update(tarball).digest('hex');
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(
      async () => new Response(new Uint8Array(tarball)),
    );

    const result = await ensureCodegraphInstalled({
      version: '9.9.9-test',
      checksums: { [archiveKey()]: sha },
      resolveVersion: async () => 'unused',
    });

    const expectedLauncher = path.join(
      getCodegraphInstallRoot(),
      '9.9.9-test',
      'bin',
      'codegraph',
    );
    expect(result).toBe(expectedLauncher);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy.mock.calls[0][0]).toBe(
      `https://github.com/colbymchenry/codegraph/releases/download/v9.9.9-test/${archiveKey()}`,
    );
    expect(fs.existsSync(expectedLauncher)).toBe(true);
    expect(fs.statSync(expectedLauncher).mode & 0o755).toBe(0o755);

    const marker = readMarkerJson();
    expect(marker.version).toBe('9.9.9-test');
    expect(marker.bin).toBe(expectedLauncher);
    expect(typeof marker.lastCheckedAt).toBe('number');

    // tmp dir cleaned up: only the versioned bundle + marker remain
    expect(fs.readdirSync(getCodegraphInstallRoot()).sort()).toEqual(['9.9.9-test', 'current.json']);
  });

  it('returns immediately within the update-check TTL without touching the network', async () => {
    const launcher = writeFakeInstall('1.5.0', Date.now());
    const resolver = vi.fn(async () => '9.9.9');
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    const result = await ensureCodegraphInstalled({ resolveVersion: resolver });

    expect(result).toBe(launcher);
    expect(resolver).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('refreshes lastCheckedAt without downloading when the resolved version is not newer', async () => {
    const staleTs = Date.now() - DAY_MS - 5000;
    const launcher = writeFakeInstall('1.5.0', staleTs);
    const resolver = vi.fn(async () => '1.5.0');
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    const result = await ensureCodegraphInstalled({ resolveVersion: resolver });

    expect(result).toBe(launcher);
    expect(resolver).toHaveBeenCalledTimes(1);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(readMarkerJson().lastCheckedAt).toBeGreaterThan(staleTs);
  });

  it('treats a legacy marker without lastCheckedAt as stale and runs one resolution pass', async () => {
    const launcher = writeFakeInstall('1.5.0');
    const resolver = vi.fn(async () => '1.5.0');
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    const result = await ensureCodegraphInstalled({ resolveVersion: resolver });

    expect(result).toBe(launcher);
    expect(resolver).toHaveBeenCalledTimes(1);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(typeof readMarkerJson().lastCheckedAt).toBe('number');
  });

  it('upgrades via the SHA256SUMS fixture when a newer version resolves, sweeping old dirs', async () => {
    const tarball = buildBundleTarball();
    const sha = createHash('sha256').update(tarball).digest('hex');
    const sumsText = `${sha}  ${archiveKey()}\n`;
    writeFakeInstall('1.4.0', Date.now() - DAY_MS - 5000);
    fs.mkdirSync(path.join(getCodegraphInstallRoot(), '1.3.0'), { recursive: true });
    const fetchSpy = stubFetch([
      latestRedirect('1.6.0'),
      { match: /SHA256SUMS$/, respond: () => stubResponse({ text: async () => sumsText }) },
      {
        match: /\/download\/v1\.6\.0\//,
        respond: () => stubResponse({ arrayBuffer: async () => tarballBody(tarball) }),
      },
    ]);

    const result = await ensureCodegraphInstalled();

    const expectedLauncher = path.join(getCodegraphInstallRoot(), '1.6.0', 'bin', 'codegraph');
    expect(result).toBe(expectedLauncher);
    const fetchedUrls = fetchSpy.mock.calls.map((call) => String(call[0]));
    expect(fetchedUrls.some((url) => url.endsWith('/SHA256SUMS'))).toBe(true);
    expect(fetchedUrls.some((url) => url.includes('/download/v1.6.0/'))).toBe(true);

    const marker = readMarkerJson();
    expect(marker.version).toBe('1.6.0');
    expect(marker.bin).toBe(expectedLauncher);
    expect(typeof marker.lastCheckedAt).toBe('number');

    expect(fs.existsSync(expectedLauncher)).toBe(true);
    expect(fs.existsSync(path.join(getCodegraphInstallRoot(), '1.4.0'))).toBe(false);
    expect(fs.existsSync(path.join(getCodegraphInstallRoot(), '1.3.0'))).toBe(false);
  });

  it('keeps the current command and refreshes lastCheckedAt when the resolver rejects', async () => {
    const staleTs = Date.now() - DAY_MS - 5000;
    const launcher = writeFakeInstall('1.5.0', staleTs);
    const resolver = vi.fn(async () => {
      throw new Error('resolution failed');
    });

    const result = await ensureCodegraphInstalled({ resolveVersion: resolver });

    expect(result).toBe(launcher);
    expect(readMarkerJson().lastCheckedAt).toBeGreaterThan(staleTs);
  });

  it('fresh install resolves latest via the redirect then verifies via SHA256SUMS', async () => {
    const tarball = buildBundleTarball();
    const sha = createHash('sha256').update(tarball).digest('hex');
    const sumsText = [
      `deadbeef${'0'.repeat(56)}  some-other-archive.tar.gz`,
      `${sha}  ${archiveKey()}`,
    ].join('\n');
    stubFetch([
      latestRedirect('1.6.0'),
      { match: /SHA256SUMS$/, respond: () => stubResponse({ text: async () => sumsText }) },
      {
        match: /\/download\/v1\.6\.0\//,
        respond: () => stubResponse({ arrayBuffer: async () => tarballBody(tarball) }),
      },
    ]);

    const result = await ensureCodegraphInstalled();

    expect(result).toBe(path.join(getCodegraphInstallRoot(), '1.6.0', 'bin', 'codegraph'));
    expect(readMarkerJson().version).toBe('1.6.0');
  });

  it('aborts the install when SHA256SUMS cannot be fetched', async () => {
    stubFetch([
      latestRedirect('1.6.0'),
      { match: /SHA256SUMS$/, respond: () => ({ ok: false, status: 404 }) as unknown as Response },
    ]);

    const result = await ensureCodegraphInstalled();

    expect(result).toBe('');
    expect(fs.existsSync(path.join(getCodegraphInstallRoot(), 'current.json'))).toBe(false);
  });

  it('aborts the install when SHA256SUMS has no entry for our archive', async () => {
    stubFetch([
      latestRedirect('1.6.0'),
      {
        match: /SHA256SUMS$/,
        respond: () => stubResponse({ text: async () => `deadbeef  some-other-archive.tar.gz\n` }),
      },
    ]);

    const result = await ensureCodegraphInstalled();

    expect(result).toBe('');
    expect(fs.existsSync(path.join(getCodegraphInstallRoot(), 'current.json'))).toBe(false);
  });
});
