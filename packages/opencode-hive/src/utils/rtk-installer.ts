/**
 * RTK (Rust Token Killer) integration.
 *
 * RTK filters shell output (100+ command filters for git, cargo, npm, …) and
 * cuts output tokens by 60-90%. Hive does not ship or download it: the user
 * installs the binary (https://github.com/rtk-ai/rtk), and Hive only prefixes
 * commands with it when it is on PATH.
 *
 * Earlier versions downloaded a release tarball from GitHub into
 * ~/.config/opencode/hive/bin on every plugin load. That had two problems:
 * a plugin load reached the network (the same class of bug that made CI red),
 * and it rewrote `event.command` to point at a binary that was never verified —
 * which silently broke the shell hook when the download failed mid-way.
 */
import * as fs from 'fs';
import * as path from 'path';

const BINARY_NAME = process.platform === 'win32' ? 'rtk.exe' : 'rtk';

/** Directory older Hive versions downloaded the binary into. */
function getLegacyInstallDir(): string {
  return path.join(process.env.HOME || '/root', '.config', 'opencode', 'hive', 'bin');
}

/**
 * Path of a binary left behind by an earlier auto-download, if any.
 *
 * Read-only: this never downloads. The file is used only when it exists, so
 * upgrades keep working on machines that already have it.
 */
export function getRtkBinaryPath(): string {
  return path.join(getLegacyInstallDir(), BINARY_NAME);
}

/** True when an earlier Hive version left an RTK binary on disk. */
export function isRtkInstalled(): boolean {
  try {
    fs.accessSync(getRtkBinaryPath(), fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if RTK is available on PATH.
 *
 * Scans PATH directly instead of spawning `which`: Bun snapshots the
 * environment at startup, so a child process would not see a PATH the user
 * changed during the session, and this avoids a fork per shell command.
 */
export function isRtkOnPath(): boolean {
  const pathVar = process.env.PATH;
  if (pathVar === undefined || pathVar === '') {
    return false;
  }
  const names = process.platform === 'win32'
    ? ['rtk.exe', 'rtk.cmd', 'rtk.bat']
    : ['rtk'];
  for (const dir of pathVar.split(path.delimiter)) {
    if (dir === '') continue;
    for (const name of names) {
      try {
        fs.accessSync(path.join(dir, name), fs.constants.X_OK);
        return true;
      } catch {
        // try the next candidate
      }
    }
  }
  return false;
}

/**
 * Resolve the RTK command at boot.
 *
 * Returns '' when RTK is unavailable, and never touches the network: Hive
 * simply stops prefixing commands and everything keeps working unfiltered.
 */
export async function ensureRtkInstalled(): Promise<string> {
  return getRtkCommand();
}

/**
 * Get the RTK command to use.
 * Returns the leftover binary path, 'rtk' if on PATH, or '' if unavailable.
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
