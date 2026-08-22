import * as os from 'os';
import * as path from 'path';

/**
 * LSP install path helpers — single source of truth for where local
 * LSP servers live. Imported by the registry, both installers and the
 * server resolver; never duplicate these paths elsewhere.
 */

/**
 * Get the local LSP install directory (~/.config/opencode/hive/lsp)
 */
export function getLspInstallDir(): string {
  return path.join(os.homedir(), '.config', 'opencode', 'hive', 'lsp');
}

/**
 * npm-style local bin dir (~/.config/opencode/hive/lsp/node_modules/.bin)
 */
export function getLspNodeBinDir(): string {
  return path.join(getLspInstallDir(), 'node_modules', '.bin');
}

/**
 * Legacy local bin dir (~/.config/opencode/hive/lsp/bin)
 */
export function getLspLegacyBinDir(): string {
  return path.join(getLspInstallDir(), 'bin');
}
