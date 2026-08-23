/**
 * CodeGraph Auto-Installer (auto-update mode)
 * Installs the self-contained CodeGraph bundle from
 * https://github.com/colbymchenry/codegraph releases under
 * ~/.config/opencode/hive/codegraph and keeps it current.
 *
 * Version strategy: instead of a hardcoded pin (which goes stale), the latest
 * upstream release is resolved by following the releases/latest redirect, and
 * an installed bundle is re-checked at most once per day (UPDATE_CHECK_TTL_MS)
 * so startup stays cheap and offline-safe.
 *
 * Integrity: archives are verified against the SHA256SUMS file published with
 * the SAME release tag (or an explicitly injected checksum map in tests).
 * Honest caveat: SHA256SUMS comes from the same release channel as the
 * archive itself, so this protects against truncated/corrupt downloads, not
 * against a compromised upstream release.
 *
 * The release archive is NOT a single binary — it is a bundle directory
 * (bundled Node runtime + launcher + compiled JS), so the whole directory is
 * kept and commands point at <bundle>/bin/codegraph. No symlinks are used
 * (Windows privilege issues); a `current.json` marker records the active
 * version, launcher path, and last update check time. After any successful
 * install/upgrade, older semver-named bundle directories are swept (~280MB each).
 */
import * as fs from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';
import * as childProcess from 'child_process';
import { shouldSkipAutoInstall } from './skip-install.js';
import { isNewerVersion, parseSha256SumFor, resolveLatestCodegraphVersion } from './codegraph-version.js';

// Lazy namespace read so tests can spy on childProcess.execSync.
const execSync = (...args: Parameters<typeof childProcess.execSync>) =>
  (childProcess as unknown as { execSync: typeof childProcess.execSync }).execSync(...args);

const CODEGRAPH_REPO = 'colbymchenry/codegraph';
const RELEASE_DOWNLOAD_BASE = `https://github.com/${CODEGRAPH_REPO}/releases/download`;

/** Re-check upstream for a newer release at most this often (zero network within the window). */
const UPDATE_CHECK_TTL_MS = 24 * 60 * 60 * 1000;

/** Only exact semver-named bundle dirs are swept; concurrent-run tmp dirs (`.X-tmp`) never match. */
const SEMVER_DIR_RE = /^\d+\.\d+\.\d+$/;

interface CodegraphMarker {
  version: string;
  bin: string;
  /** Epoch ms of the last update check; absent in legacy markers (treated as stale). */
  lastCheckedAt?: number;
}

export interface CodegraphInstallOptions {
  /** Explicit target version — bypasses resolution AND the update-check TTL (tests / forced install). */
  version?: string;
  /** Explicit checksums keyed by archive name (tests). When omitted, the release's SHA256SUMS is used. */
  checksums?: Record<string, string>;
  /** Version resolver injection point (tests); defaults to resolveLatestCodegraphVersion(). */
  resolveVersion?: () => Promise<string | null>;
}

/** Archive filename for a platform/arch combo, or null when unsupported. */
function getArchiveName(platform: string, arch: string): string | null {
  const supportedPlatform = platform === 'linux' || platform === 'darwin' || platform === 'win32';
  if (!supportedPlatform || (arch !== 'x64' && arch !== 'arm64')) {
    return null;
  }
  const ext = platform === 'win32' ? '.zip' : '.tar.gz';
  return `codegraph-${platform}-${arch}${ext}`;
}

/**
 * Build the release download URL for a platform/arch combo.
 * Returns '' for combos outside the supported set.
 */
export function getCodegraphDownloadUrl(
  version: string,
  platform: string = process.platform,
  arch: string = process.arch,
): string {
  const archiveName = getArchiveName(platform, arch);
  return archiveName === null ? '' : `${RELEASE_DOWNLOAD_BASE}/v${version}/${archiveName}`;
}

export function getCodegraphInstallRoot(): string {
  return path.join(process.env.HOME || '/root', '.config', 'opencode', 'hive', 'codegraph');
}

function getMarkerPath(): string {
  return path.join(getCodegraphInstallRoot(), 'current.json');
}

function readMarker(): CodegraphMarker | null {
  try {
    const parsed = JSON.parse(fs.readFileSync(getMarkerPath(), 'utf-8')) as Partial<CodegraphMarker>;
    if (typeof parsed.version !== 'string' || typeof parsed.bin !== 'string') {
      return null;
    }
    return {
      version: parsed.version,
      bin: parsed.bin,
      lastCheckedAt: typeof parsed.lastCheckedAt === 'number' ? parsed.lastCheckedAt : undefined,
    };
  } catch {
    return null;
  }
}

/** Within the TTL window since the last update check? Legacy markers (no timestamp) are stale. */
function isCheckFresh(marker: CodegraphMarker): boolean {
  return marker.lastCheckedAt !== undefined && Date.now() - marker.lastCheckedAt < UPDATE_CHECK_TTL_MS;
}

/** Best-effort timestamp refresh so a failed resolution does not hammer every boot. */
function refreshLastCheckedAt(marker: CodegraphMarker): void {
  try {
    fs.writeFileSync(getMarkerPath(), JSON.stringify({ ...marker, lastCheckedAt: Date.now() }));
  } catch {
    // Worst case we simply re-check on the next boot.
  }
}

/** Installed = marker parses AND its recorded launcher exists (any version). */
export function isCodegraphInstalled(): boolean {
  const marker = readMarker();
  return marker !== null && fs.existsSync(marker.bin);
}

/** Check if codegraph is available on PATH (e.g., globally installed). */
export function isCodegraphOnPath(): boolean {
  try {
    execSync('which codegraph 2>/dev/null', { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

/** Check if codegraph is available (either auto-installed or on PATH). */
export function isCodegraphAvailable(): boolean {
  return isCodegraphInstalled() || isCodegraphOnPath();
}

/**
 * Get the codegraph command to use.
 * Returns the installed launcher path, 'codegraph' if on PATH, or '' if unavailable.
 */
export function getCodegraphCommand(): string {
  const marker = readMarker();
  if (marker !== null && fs.existsSync(marker.bin)) {
    return marker.bin;
  }
  if (isCodegraphOnPath()) {
    return 'codegraph';
  }
  return '';
}

/**
 * Locate the bundle launcher relative to the extracted bundle root.
 * Returns a relative path like 'bin/codegraph', or null when absent.
 */
function findLauncherRel(bundleDir: string): string | null {
  const candidates = process.platform === 'win32'
    ? ['bin/codegraph.exe', 'bin/codegraph.cmd']
    : ['bin/codegraph'];
  for (const rel of candidates) {
    if (fs.existsSync(path.join(bundleDir, rel))) {
      return rel;
    }
  }
  return null;
}

/** Fetch the release's SHA256SUMS and return the hash for our archive; null when unavailable. */
async function fetchExpectedChecksum(version: string, archiveName: string): Promise<string | null> {
  try {
    const response = await fetch(`${RELEASE_DOWNLOAD_BASE}/v${version}/SHA256SUMS`);
    if (!response.ok) {
      return null;
    }
    return parseSha256SumFor(await response.text(), archiveName);
  } catch {
    return null;
  }
}

/** Remove other semver-named bundle dirs after a successful install/upgrade (~280MB each). */
function sweepOldVersionDirs(activeVersion: string): void {
  let entries: string[];
  try {
    entries = fs.readdirSync(getCodegraphInstallRoot());
  } catch {
    return;
  }
  for (const entry of entries) {
    if (entry !== activeVersion && SEMVER_DIR_RE.test(entry)) {
      fs.rmSync(path.join(getCodegraphInstallRoot(), entry), { recursive: true, force: true });
    }
  }
}

/**
 * Download, verify, extract, and activate a specific version.
 * Owns its tmp-dir lifecycle (cleaned on success AND failure). Throws on any failure —
 * callers decide the fallback. Returns the absolute launcher path.
 */
async function downloadAndExtractBundle(params: {
  version: string;
  checksums?: Record<string, string>;
}): Promise<string> {
  const archiveName = getArchiveName(process.platform, process.arch);
  if (archiveName === null) {
    throw new Error(`unsupported platform ${process.platform}-${process.arch}`);
  }

  const expectedSha =
    params.checksums !== undefined
      ? params.checksums[archiveName]
      : await fetchExpectedChecksum(params.version, archiveName);
  if (expectedSha === undefined || expectedSha === null || expectedSha === '') {
    throw new Error(`no checksum available for ${archiveName} v${params.version} — refusing unverified install`);
  }

  const url = getCodegraphDownloadUrl(params.version);
  const installRoot = getCodegraphInstallRoot();
  const versionDir = path.join(installRoot, params.version);
  const tmpDir = path.join(installRoot, `.${params.version}-tmp`);
  const bundleDir = path.join(tmpDir, 'bundle');

  try {
    fs.mkdirSync(bundleDir, { recursive: true });

    console.log(`[hive:codegraph] Downloading ${archiveName} v${params.version}...`);
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Download failed with HTTP ${response.status} for ${url}`);
    }
    const buffer = Buffer.from(await response.arrayBuffer());

    const actualSha = createHash('sha256').update(buffer).digest('hex');
    if (actualSha !== expectedSha.toLowerCase()) {
      throw new Error(`SHA256 mismatch for ${archiveName}: expected ${expectedSha}, got ${actualSha}`);
    }

    const archivePath = path.join(tmpDir, archiveName);
    fs.writeFileSync(archivePath, buffer);

    if (archiveName.endsWith('.zip')) {
      execSync(`tar -xf "${archivePath}" -C "${bundleDir}" --strip-components=1`, { stdio: 'pipe' });
    } else {
      execSync(`tar xzf "${archivePath}" -C "${bundleDir}" --strip-components=1`, { stdio: 'pipe' });
    }

    const launcherRel = findLauncherRel(bundleDir);
    if (launcherRel === null) {
      throw new Error('Launcher not found in extracted bundle (expected bin/codegraph)');
    }

    if (fs.existsSync(versionDir)) {
      fs.rmSync(versionDir, { recursive: true, force: true });
    }
    fs.renameSync(bundleDir, versionDir);
    fs.rmSync(tmpDir, { recursive: true, force: true });

    const launcherPath = path.join(versionDir, launcherRel);
    if (process.platform !== 'win32') {
      fs.chmodSync(launcherPath, 0o755);
    }
    return launcherPath;
  } catch (error) {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    throw error;
  }
}

function fallbackAfterFailure(reason: string): string {
  console.warn(`[hive:codegraph] Auto-install failed: ${reason}`);
  if (isCodegraphOnPath()) {
    console.log('[hive:codegraph] Found codegraph on PATH, will use it');
    return 'codegraph';
  }
  return '';
}

/** Resolve the target version via the injected resolver or the redirect-based default; null on failure. */
async function resolveTargetVersion(options: CodegraphInstallOptions): Promise<string | null> {
  try {
    return options.resolveVersion ? await options.resolveVersion() : await resolveLatestCodegraphVersion();
  } catch {
    return null;
  }
}

/**
 * Ensure the CodeGraph bundle is installed AND up to date.
 *
 * Flow: skip-guard → fresh-marker fast path (zero network within the 24h TTL)
 * → otherwise resolve the latest upstream version once; same/older keeps the
 * current install (timestamp refreshed), newer triggers an upgrade. An
 * explicit options.version overrides resolution entirely.
 *
 * Never throws: on failure it warns and falls back to 'codegraph' when on
 * PATH, otherwise returns ''. Install happens in the background at plugin
 * boot — MCP registration is decided synchronously at config time, so a
 * freshly installed/upgraded codegraph appears on the NEXT OpenCode session.
 */
export async function ensureCodegraphInstalled(options: CodegraphInstallOptions = {}): Promise<string> {
  if (shouldSkipAutoInstall()) {
    return getCodegraphCommand();
  }

  let targetVersion: string;
  if (options.version !== undefined) {
    targetVersion = options.version;
  } else {
    const marker = readMarker();
    if (marker !== null && fs.existsSync(marker.bin)) {
      if (isCheckFresh(marker)) {
        return getCodegraphCommand();
      }
      const resolved = await resolveTargetVersion(options);
      if (resolved === null || !isNewerVersion(resolved, marker.version)) {
        refreshLastCheckedAt(marker);
        return getCodegraphCommand();
      }
      console.log(`[hive:codegraph] Upgrading v${marker.version} → v${resolved}...`);
      targetVersion = resolved;
    } else {
      const resolved = await resolveTargetVersion(options);
      if (resolved === null) {
        return fallbackAfterFailure('could not resolve the latest codegraph version');
      }
      targetVersion = resolved;
    }
  }

  try {
    const launcherPath = await downloadAndExtractBundle({ version: targetVersion, checksums: options.checksums });
    fs.writeFileSync(
      getMarkerPath(),
      JSON.stringify({ version: targetVersion, bin: launcherPath, lastCheckedAt: Date.now() }),
    );
    sweepOldVersionDirs(targetVersion);
    console.log(
      `[hive:codegraph] Installed v${targetVersion} — restart OpenCode to enable the codegraph MCP`,
    );
    return launcherPath;
  } catch (error) {
    return fallbackAfterFailure(error instanceof Error ? error.message : String(error));
  }
}
