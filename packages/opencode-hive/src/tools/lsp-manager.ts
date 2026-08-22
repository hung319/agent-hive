import { execSync } from 'child_process';
import {
  LSP_REGISTRY,
  getLanguageFromPath,
  getInstallableLanguages,
  type LspInstallCommand,
} from '../lsp/registry.js';

/**
 * LSP status & on-demand install helpers.
 *
 * Naming note: the real LSP client pool lives in `../lsp/manager.ts`
 * (`LspManager`). This module only reports server status and installs
 * servers on demand — hence `LspStatusManager`.
 *
 * All language data comes from the shared registry (`../lsp/registry.ts`).
 */

/**
 * Check if an LSP server is installed and working
 */
async function checkLspServer(install: LspInstallCommand): Promise<boolean> {
  const cmd = install.verifyCommand || `${install.command} --version`;
  try {
    execSync(cmd, { stdio: 'ignore', timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if a local install exists for the given language
 */
export function checkLocalInstall(language: string): boolean {
  const entry = LSP_REGISTRY[language];
  if (!entry || entry.aliasOf) return false;

  const verifyCmd = entry.install?.verifyCommand;
  if (!verifyCmd) return false;

  // Check if the local binary exists
  try {
    execSync(verifyCmd, { stdio: 'ignore', timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

/**
 * Install LSP server with fallbacks (on-demand engine)
 */
export async function ensureLspInstalled(language: string): Promise<{
  success: boolean;
  installed: string | null;
  error?: string;
}> {
  const entry = LSP_REGISTRY[language];

  if (!entry || entry.aliasOf || !entry.install) {
    return {
      success: false,
      installed: null,
      error: `No LSP configuration for language: ${language}`,
    };
  }

  const primary = entry.install;
  const alternatives = entry.alternatives ?? [];

  // Try primary first
  if (await checkLspServer(primary)) {
    return { success: true, installed: primary.command };
  }

  // Try to install primary
  try {
    console.log(`[lsp] Installing ${language} LSP: ${primary.command} ${primary.args.join(' ')}`);
    execSync(`${primary.command} ${primary.args.join(' ')}`, {
      stdio: 'inherit',
      timeout: 120000, // 2 minutes
    });

    if (await checkLspServer(primary)) {
      return { success: true, installed: primary.command };
    }
  } catch (error: any) {
    console.warn(`[lsp] Primary installation failed: ${error.message}`);
  }

  // Try alternatives
  for (const alt of alternatives) {
    try {
      console.log(`[lsp] Trying alternative: ${alt.command} ${alt.args.join(' ')}`);
      execSync(`${alt.command} ${alt.args.join(' ')}`, {
        stdio: 'inherit',
        timeout: 120000,
      });

      if (await checkLspServer(alt)) {
        return { success: true, installed: alt.command };
      }
    } catch (error: any) {
      console.warn(`[lsp] Alternative installation failed: ${error.message}`);
    }
  }

  return {
    success: false,
    installed: null,
    error: `Failed to install LSP for ${language}. Tried: ${primary.command} and ${alternatives.map(a => a.command).join(', ')}`,
  };
}

/**
 * LSP Status Report
 */
export interface LspStatus {
  language: string;
  installed: boolean;
  primary: string | null;
  alternatives: string[];
  canInstall: boolean;
  localInstall?: boolean;
}

export async function getLspStatus(filePath?: string): Promise<LspStatus | LspStatus[]> {
  if (filePath) {
    const lang = getLanguageFromPath(filePath);
    if (!lang) {
      return {
        language: 'unknown',
        installed: false,
        primary: null,
        alternatives: [],
        canInstall: false,
      };
    }

    const entry = LSP_REGISTRY[lang];
    if (!entry || !entry.install) {
      return {
        language: lang,
        installed: false,
        primary: null,
        alternatives: [],
        canInstall: false,
      };
    }

    return {
      language: lang,
      installed: await checkLspServer(entry.install),
      primary: entry.install.command,
      alternatives: (entry.alternatives ?? []).map(a => a.command),
      canInstall: (entry.alternatives?.length ?? 0) > 0 || true,
      localInstall: checkLocalInstall(lang),
    };
  }

  // Return status for all languages
  const statuses: LspStatus[] = [];
  for (const lang of getInstallableLanguages()) {
    const entry = LSP_REGISTRY[lang];
    if (!entry || !entry.install) continue;
    statuses.push({
      language: lang,
      installed: await checkLspServer(entry.install),
      primary: entry.install.command,
      alternatives: (entry.alternatives ?? []).map(a => a.command),
      canInstall: (entry.alternatives?.length ?? 0) > 0 || true,
      localInstall: checkLocalInstall(lang),
    });
  }
  return statuses;
}

/**
 * LSP Status Manager — status checks + auto-install orchestration.
 * (Renamed from the misnamed `LspManager` to avoid clashing with the
 * real client pool in ../lsp/manager.ts.)
 */
export class LspStatusManager {
  /**
   * Check LSP status and optionally auto-install
   */
  async checkAndInstall(filePath: string): Promise<{
    language: string;
    ready: boolean;
    installed: boolean;
    message: string;
  }> {
    const lang = getLanguageFromPath(filePath);

    if (!lang) {
      return {
        language: 'unknown',
        ready: false,
        installed: false,
        message: `Unsupported file type. LSP not available.`,
      };
    }

    const entry = LSP_REGISTRY[lang];
    if (!entry || entry.aliasOf || !entry.install) {
      return {
        language: lang,
        ready: false,
        installed: false,
        message: `No LSP configuration for ${lang}.`,
      };
    }

    const isInstalled = await checkLspServer(entry.install);

    if (isInstalled) {
      return {
        language: lang,
        ready: true,
        installed: true,
        message: `${lang} LSP ready (${entry.install.command})`,
      };
    }

    // Try to install
    const result = await ensureLspInstalled(lang);

    return {
      language: lang,
      ready: result.success,
      installed: result.success,
      message: result.success
        ? `${lang} LSP installed successfully`
        : result.error || 'Installation failed',
    };
  }

  /**
   * Get available LSP languages
   */
  getAvailableLanguages(): string[] {
    return getInstallableLanguages();
  }

  /**
   * Get LSP info for a file
   */
  getLspInfo(filePath: string): {
    language: string;
    extensions: string[];
    primaryCommand: string;
    alternativeCommands: string[];
  } | null {
    const lang = getLanguageFromPath(filePath);
    if (!lang) return null;

    const entry = LSP_REGISTRY[lang];
    if (!entry || !entry.install) return null;

    return {
      language: lang,
      extensions: entry.extensions,
      primaryCommand: entry.install.command,
      alternativeCommands: (entry.alternatives ?? []).map(a => a.command),
    };
  }
}

// Export singleton for convenience
export const lspStatusManager = new LspStatusManager();
