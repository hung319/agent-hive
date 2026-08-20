/**
 * RTK (Rust Token Killer) Auto-Installer
 * Downloads RTK binary from https://github.com/rtk-ai/rtk
 * RTK reduces LLM token usage by 60-90% by filtering shell output.
 * 
 * Features:
 * - 100+ hand-tuned command filters (git, cargo, npm, etc.)
 * - Transparent proxy - zero agent-side changes needed
 * - Analytics dashboard with `rtk gain`
 * - 16 AI coding tools supported
 */
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

const RTK_REPO = 'rtk-ai/rtk';
const FALLBACK_VERSION = '1.0.0';
const BINARY_NAME = process.platform === 'win32' ? 'rtk.exe' : 'rtk';

const OS_MAP: Record<string, string> = {
  darwin: 'darwin',
  linux: 'linux',
  win32: 'windows',
};

const ARCH_MAP: Record<string, string> = {
  x64: 'amd64',
  arm64: 'arm64',
};

function getInstallDir(): string {
  return path.join(process.env.HOME || '/root', '.config', 'opencode', 'hive', 'bin');
}

export function getRtkBinaryPath(): string {
  return path.join(getInstallDir(), BINARY_NAME);
}

export function isRtkInstalled(): boolean {
  return fs.existsSync(getRtkBinaryPath());
}

/**
 * Check if RTK is available on PATH (e.g., globally installed).
 */
export function isRtkOnPath(): boolean {
  try {
    execSync('which rtk 2>/dev/null', { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if RTK is available (either auto-installed or on PATH).
 */
export function isRtkAvailable(): boolean {
  return isRtkInstalled() || isRtkOnPath();
}

async function getLatestVersion(): Promise<string> {
  const response = await fetch(
    `https://api.github.com/repos/${RTK_REPO}/releases/latest`,
    { headers: { 'Accept': 'application/vnd.github.v3+json' } },
  );
  if (!response.ok) {
    throw new Error(`GitHub API responded with ${response.status}`);
  }
  const data = await response.json() as { tag_name: string };
  return data.tag_name.replace(/^v/, '');
}

/**
 * Ensure RTK binary is installed.
 * Downloads from GitHub releases if not present.
 * Falls back to 'rtk' (PATH lookup) if installation fails.
 */
export async function ensureRtkInstalled(): Promise<string> {
  const binaryPath = getRtkBinaryPath();

  if (isRtkInstalled()) {
    return binaryPath;
  }

  console.log('[hive:rtk] Auto-installing RTK binary for 60-90% token reduction...');

  const os = OS_MAP[process.platform] || 'linux';
  const arch = ARCH_MAP[process.arch] || 'amd64';

  let version: string;
  try {
    version = await getLatestVersion();
  } catch {
    version = FALLBACK_VERSION;
  }

  const url = `https://github.com/${RTK_REPO}/releases/download/v${version}/rtk_${version}_${os}_${arch}.tar.gz`;
  const installDir = getInstallDir();
  const tmpDir = path.join(installDir, '.rtk-tmp');

  try {
    if (!fs.existsSync(installDir)) {
      fs.mkdirSync(installDir, { recursive: true });
    }
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true });
    }

    console.log(`[hive:rtk] Downloading ${os}/${arch} v${version}...`);
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Download failed with HTTP ${response.status} for ${url}`);
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    fs.writeFileSync(path.join(tmpDir, 'rtk.tar.gz'), buffer);

    execSync(`tar xzf "${path.join(tmpDir, 'rtk.tar.gz')}" -C "${tmpDir}"`, { stdio: 'pipe' });

    const extractedBin = path.join(tmpDir, BINARY_NAME);
    if (!fs.existsSync(extractedBin)) {
      throw new Error('Binary not found in extracted archive');
    }

    fs.renameSync(extractedBin, binaryPath);
    fs.chmodSync(binaryPath, 0o755);
    console.log(`[hive:rtk] Installed to ${binaryPath}`);

    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch (error) {
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[hive:rtk] Auto-install failed: ${message}`);
    
    // Fallback: check if RTK is on PATH (globally installed)
    if (isRtkOnPath()) {
      console.log('[hive:rtk] Found RTK on PATH, will use it');
      return 'rtk';  // let PATH resolve it
    }
    
    console.warn('[hive:rtk] Commands will pass through without filtering - no impact on functionality');
    return '';  // RTK not available
  }

  return binaryPath;
}

/**
 * Get the RTK command to use.
 * Returns the binary path or 'rtk' if on PATH.
 */
export function getRtkCommand(): string {
  if (isRtkInstalled()) {
    return getRtkBinaryPath();
  }
  if (isRtkOnPath()) {
    return 'rtk';
  }
  return '';
}

/**
 * Prefix a command with RTK to reduce output token usage.
 * RTK: https://github.com/rtk-ai/rtk
 */
export function prefixWithRtk(command: string, rtkCommand = 'rtk'): string {
  // Don't double-prefix already rtk'd commands
  if (command.startsWith(`${rtkCommand} `)) {
    return command;
  }

  // Extract env var prefixes (like EXA_API_KEY=xxx)
  const envPrefix = command.match(/^([A-Z_]+=\S+\s+)*/)?.[0] || '';
  const bareCmd = command.slice(envPrefix.length);

  // Handle cd + command (e.g., "cd /path && git status")
  if (bareCmd.includes(' && ')) {
    const parts = bareCmd.split(' && ');
    if (parts.length > 1) {
      const lastCmd = parts[parts.length - 1];
      const prefix = parts.slice(0, -1).join(' && ');
      return `${envPrefix}${prefix} && ${rtkCommand} ${lastCmd}`;
    }
  }

  return `${envPrefix}${rtkCommand} ${bareCmd}`;
}
