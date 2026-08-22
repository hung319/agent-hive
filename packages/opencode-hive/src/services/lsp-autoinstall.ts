import * as childProcess from 'child_process';
import { LSP_REGISTRY } from '../lsp/registry.js';
import { getLspNodeBinDir, getLspLegacyBinDir } from '../utils/lsp-path.js';
import { shouldSkipAutoInstall } from '../utils/skip-install.js';

// Single source of truth for the install dir (re-exported for backward compat)
export { getLspInstallDir } from '../utils/lsp-path.js';

const execSync = (...args: Parameters<typeof childProcess.execSync>) =>
  (childProcess as unknown as { execSync: typeof childProcess.execSync }).execSync(...args);

/**
 * LSP server definition for proactive installation.
 */
interface LspServerDef {
  name: string;
  checkCommand: string;
  installCommand: string;
  fallbackCommand?: string;
}

/**
 * Prepend the local LSP bin directories to PATH
 */
export function prependLspToPath(): void {
  process.env.PATH = `${getLspNodeBinDir()}:${getLspLegacyBinDir()}:${process.env.PATH}`;
}

/**
 * Languages proactively installed at startup (fire-and-forget).
 * Definitions are derived from the shared LSP registry — do not
 * maintain a separate table here.
 */
const STARTUP_LANGUAGES = ['typescript', 'python', 'go', 'rust'] as const;

const LSP_SERVERS: LspServerDef[] = (() => {
  const defs: LspServerDef[] = [];
  for (const lang of STARTUP_LANGUAGES) {
    const entry = LSP_REGISTRY[lang];
    const install = entry?.install;
    if (!entry || !install || !install.verifyCommand) {
      throw new Error(`[lsp-autoinstall] Invalid registry entry for startup language: ${lang}`);
    }
    defs.push({
      name: entry.displayName,
      checkCommand: install.verifyCommand,
      installCommand: [install.command, ...install.args].join(' '),
      fallbackCommand: entry.startupFallbackCommand,
    });
  }
  return defs;
})();

export interface LspServerResult {
  name: string;
  installed: boolean;
  skipped: boolean;
  error?: string;
}

/**
 * Check if an LSP server is already installed by running its version command.
 */
function isInstalled(command: string): boolean {
  try {
    execSync(command, { stdio: 'ignore', timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

/**
 * Install a single LSP server, with optional fallback.
 */
function installServer(def: LspServerDef): boolean {
  const tryInstall = (cmd: string, label: string): boolean => {
    try {
      console.log(`[lsp-autoinstall] Installing ${def.name}: ${cmd}`);
      execSync(cmd, { stdio: 'inherit', timeout: 120000 });
      return true;
    } catch (error: any) {
      console.warn(`[lsp-autoinstall] ${label} failed for ${def.name}: ${error.message}`);
      return false;
    }
  };

  if (tryInstall(def.installCommand, 'Primary install')) {
    return true;
  }

  if (def.fallbackCommand && tryInstall(def.fallbackCommand, 'Fallback install')) {
    return true;
  }

  return false;
}

/**
 * Proactively check and install LSP servers at startup.
 * Fire-and-forget: callers can await or not.
 * Never throws — all errors are caught and logged.
 *
 * This is the batch/startup flavor of the installer; on-demand installs
 * go through `ensureLspInstalled` in tools/lsp-manager.ts. Both read the
 * same shared registry (`../lsp/registry.ts`) and install dir helpers.
 */
export async function ensureLspServers(): Promise<LspServerResult[]> {
  if (shouldSkipAutoInstall()) {
    return [];
  }
  const results: LspServerResult[] = [];

  for (const server of LSP_SERVERS) {
    try {
      if (isInstalled(server.checkCommand)) {
        console.log(`[lsp-autoinstall] ${server.name} already installed, skipping`);
        results.push({ name: server.name, installed: true, skipped: true });
        continue;
      }

      const success = installServer(server);
      results.push({
        name: server.name,
        installed: success,
        skipped: false,
        error: success ? undefined : `${server.name} installation failed after all attempts`,
      });
    } catch (error: any) {
      console.warn(`[lsp-autoinstall] Unexpected error checking ${server.name}: ${error.message}`);
      results.push({
        name: server.name,
        installed: false,
        skipped: false,
        error: error.message,
      });
    }
  }

  const ready = results.filter(r => r.installed).length;
  console.log(`[lsp-autoinstall] Complete: ${ready}/${results.length} servers ready`);
  return results;
}
