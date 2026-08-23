/**
 * Version resolution helpers for the codegraph auto-updater.
 *
 * Pure parsing plus one thin fetch wrapper — no filesystem access here.
 * The resolver mirrors upstream install.sh: follow the releases/latest
 * redirect and read the final URL instead of hitting api.github.com,
 * whose unauthenticated limit (60 req/h) returns 403 on shared hosts.
 */

const LATEST_RELEASE_URL = 'https://github.com/colbymchenry/codegraph/releases/latest';

/** Extract the semver from a GitHub tag URL like .../releases/tag/v1.6.0 → '1.6.0'; null when unparseable. */
export function parseLatestVersionFromUrl(url: string): string | null {
  const match = url.match(/\/releases\/tag\/v?(\d+\.\d+\.\d+)/);
  return match ? match[1] : null;
}

/** Resolve the latest upstream version via the releases/latest redirect; null when offline or unparseable. */
export async function resolveLatestCodegraphVersion(): Promise<string | null> {
  try {
    const response = await fetch(LATEST_RELEASE_URL);
    return parseLatestVersionFromUrl(response.url);
  } catch {
    return null;
  }
}

/** Numeric segment comparison; missing segments count as 0, so 1.10.0 > 1.9.9. */
export function isNewerVersion(candidate: string, current: string): boolean {
  const candidateSegments = candidate.split('.').map(Number);
  const currentSegments = current.split('.').map(Number);
  const length = Math.max(candidateSegments.length, currentSegments.length);
  for (let i = 0; i < length; i++) {
    const candidateSegment = candidateSegments[i] ?? 0;
    const currentSegment = currentSegments[i] ?? 0;
    if (candidateSegment !== currentSegment) return candidateSegment > currentSegment;
  }
  return false;
}

/**
 * Parse sha256sum-style lines (`<hash>` whitespace `<archiveName>`) and return
 * the hash for archiveName; null when the entry is missing or malformed.
 */
export function parseSha256SumFor(text: string, archiveName: string): string | null {
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (trimmed === '') continue;
    const [hash, name] = trimmed.split(/\s+/);
    if (name === archiveName && /^[0-9a-f]{64}$/i.test(hash)) return hash.toLowerCase();
  }
  return null;
}
