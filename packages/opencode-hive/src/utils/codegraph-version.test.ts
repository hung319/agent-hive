import { describe, it, expect, vi, afterEach } from 'bun:test';

import {
  parseLatestVersionFromUrl,
  resolveLatestCodegraphVersion,
  isNewerVersion,
  parseSha256SumFor,
} from './codegraph-version.js';

const realFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = realFetch;
  vi.restoreAllMocks();
});

describe('parseLatestVersionFromUrl', () => {
  it('extracts the version from a GitHub tag redirect URL', () => {
    expect(parseLatestVersionFromUrl('https://github.com/colbymchenry/codegraph/releases/tag/v1.6.0')).toBe('1.6.0');
  });

  it('accepts tags without the v prefix', () => {
    expect(parseLatestVersionFromUrl('https://github.com/colbymchenry/codegraph/releases/tag/2.0.0')).toBe('2.0.0');
  });

  it('returns null for garbage input', () => {
    expect(parseLatestVersionFromUrl('not-a-url')).toBeNull();
  });

  it('returns null for non-semver tag names', () => {
    expect(parseLatestVersionFromUrl('https://github.com/colbymchenry/codegraph/releases/tag/latest')).toBeNull();
  });
});

describe('resolveLatestCodegraphVersion', () => {
  it('parses the final redirect URL after following releases/latest', async () => {
    globalThis.fetch = vi.fn(async () =>
      ({ ok: true, status: 200, url: 'https://github.com/colbymchenry/codegraph/releases/tag/v1.6.0' }) as Response,
    ) as typeof fetch;
    await expect(resolveLatestCodegraphVersion()).resolves.toBe('1.6.0');
  });

  it('returns null when the final URL is unparseable', async () => {
    globalThis.fetch = vi.fn(async () =>
      ({ ok: true, status: 200, url: 'https://github.com/colbymchenry/codegraph/releases/latest' }) as Response,
    ) as typeof fetch;
    await expect(resolveLatestCodegraphVersion()).resolves.toBeNull();
  });

  it('returns null when the fetch throws', async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new Error('network down');
    }) as unknown as typeof fetch;
    await expect(resolveLatestCodegraphVersion()).resolves.toBeNull();
  });
});

describe('isNewerVersion', () => {
  it('is false for equal versions', () => {
    expect(isNewerVersion('1.5.0', '1.5.0')).toBe(false);
  });

  it('detects patch, minor and major bumps', () => {
    expect(isNewerVersion('1.5.1', '1.5.0')).toBe(true);
    expect(isNewerVersion('1.6.0', '1.5.9')).toBe(true);
    expect(isNewerVersion('2.0.0', '1.9.9')).toBe(true);
  });

  it('compares segments numerically so 1.10.0 > 1.9.9', () => {
    expect(isNewerVersion('1.10.0', '1.9.9')).toBe(true);
    expect(isNewerVersion('1.9.9', '1.10.0')).toBe(false);
  });

  it('treats missing segments as zero', () => {
    expect(isNewerVersion('1.5', '1.5.0')).toBe(false);
    expect(isNewerVersion('1.5.0.1', '1.5.0')).toBe(true);
  });
});

describe('parseSha256SumFor', () => {
  const sumsText = [
    '2ba65e87a1210b706bb1e67d5e48b5fc4a1935e43dbb3fb5f31c5597840d2e58  codegraph-linux-x64.tar.gz',
    '9f17750aedf45d51f68caae39ed21d6e2a7290b2326e5c53f95a165918ebd1d8  codegraph-linux-arm64.tar.gz',
    '',
  ].join('\n');

  it('finds the hash for the requested archive name', () => {
    expect(parseSha256SumFor(sumsText, 'codegraph-linux-x64.tar.gz')).toBe(
      '2ba65e87a1210b706bb1e67d5e48b5fc4a1935e43dbb3fb5f31c5597840d2e58',
    );
  });

  it('returns null when the archive has no entry', () => {
    expect(parseSha256SumFor(sumsText, 'codegraph-darwin-arm64.tar.gz')).toBeNull();
    expect(parseSha256SumFor('', 'codegraph-linux-x64.tar.gz')).toBeNull();
  });

  it('ignores lines whose hash is not sha256-shaped', () => {
    expect(parseSha256SumFor('zzzz  codegraph-linux-x64.tar.gz', 'codegraph-linux-x64.tar.gz')).toBeNull();
  });
});
