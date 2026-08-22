/**
 * LSP Registry — single source of truth for language → LSP server mappings.
 *
 * Every LSP feature reads from this one table:
 * - Language detection from file paths (`getLanguageFromPath`, `detectLanguage`)
 * - On-demand installation (`ensureLspInstalled` in tools/lsp-manager.ts)
 * - Server binary resolution & launch (`resolveServerPath` in lsp/manager.ts)
 * - Startup fire-and-forget auto-install (`ensureLspServers` in services/lsp-autoinstall.ts)
 *
 * Do NOT add parallel language tables elsewhere — extend this registry instead.
 */
import * as path from 'path';
import { getLspInstallDir, getLspNodeBinDir } from '../utils/lsp-path.js';

/**
 * A single install attempt: the command to run and how to verify it worked.
 */
export interface LspInstallCommand {
  /** Executable to run (e.g. 'npm', 'uv', 'rustup') */
  command: string;
  /** Arguments passed to the command */
  args: string[];
  /**
   * Command that succeeds iff the server is usable.
   * Defaults to `<command> --version` when omitted.
   */
  verifyCommand?: string;
}

/**
 * Registry entry for one language.
 */
export interface LspRegistryEntry {
  /** Human-readable name (used in startup installer logs/results) */
  displayName: string;
  /** File extensions owned by this language */
  extensions: string[];
  /** Binary used to LAUNCH the LSP server */
  serverBinary: string;
  /** Args passed when launching the server (e.g. ['--stdio']) */
  args: string[];
  /** Primary install command. Omitted for launch-only alias entries. */
  install?: LspInstallCommand;
  /** Fallback install commands tried in order when the primary fails */
  alternatives?: LspInstallCommand[];
  /**
   * Launch-only alias: resolve launch config from another entry.
   * Alias entries are excluded from install/status listings and language
   * detection (they own no extensions).
   */
  aliasOf?: string;
  /**
   * Extra fallback used ONLY by the startup fire-and-forget installer
   * (which checks once and installs once, without post-install verify).
   */
  startupFallbackCommand?: string;
  /**
   * Per-extension LSP languageId overrides for textDocument/didOpen.
   * Extensions not listed here default to the registry key.
   */
  languageIds?: Record<string, string>;
}

const installDir = getLspInstallDir();
const nodeBinDir = getLspNodeBinDir();

/**
 * The single language → LSP server table.
 */
export const LSP_REGISTRY: Record<string, LspRegistryEntry> = {
  typescript: {
    displayName: 'TypeScript',
    extensions: ['ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs'],
    serverBinary: 'typescript-language-server',
    args: ['--stdio'],
    install: {
      command: 'npm',
      args: ['install', '--prefix', installDir, 'typescript-language-server', 'typescript'],
      verifyCommand: `${path.join(nodeBinDir, 'typescript-language-server')} --version`,
    },
    alternatives: [
      {
        command: 'npm',
        args: ['install', '--prefix', installDir, '@volarjs/typescript-language-server'],
        verifyCommand: `${path.join(nodeBinDir, 'volar-server')} --version`,
      },
    ],
    languageIds: {
      tsx: 'typescriptreact',
      js: 'javascript',
      jsx: 'javascriptreact',
      mjs: 'javascript',
      cjs: 'javascript',
    },
  },
  python: {
    displayName: 'Python',
    extensions: ['py', 'pyw', 'pyi'],
    serverBinary: 'pyright',
    args: ['--stdio'],
    install: {
      command: 'uv',
      args: ['pip', 'install', '--user', 'pyright'],
      verifyCommand: 'pyright --version',
    },
    alternatives: [
      {
        command: 'pip',
        args: ['install', '--user', 'ruff-lsp'],
        verifyCommand: 'ruff-lsp --version',
      },
      {
        command: 'pip',
        args: ['install', '--user', 'jedi-language-server'],
        verifyCommand: 'jedi-language-server --version',
      },
    ],
    startupFallbackCommand: 'pip install --user pyright',
  },
  rust: {
    displayName: 'Rust',
    extensions: ['rs'],
    serverBinary: 'rust-analyzer',
    args: [],
    install: {
      command: 'rustup',
      args: ['component', 'add', 'rust-analyzer'],
      verifyCommand: 'rust-analyzer --version',
    },
  },
  go: {
    displayName: 'Go',
    extensions: ['go'],
    serverBinary: 'gopls',
    args: [],
    install: {
      command: 'go',
      args: ['install', 'golang.org/x/tools/gopls@latest'],
      verifyCommand: 'gopls version',
    },
  },
  java: {
    displayName: 'Java',
    extensions: ['java'],
    serverBinary: 'jdtls',
    args: [],
    install: {
      command: 'sdk',
      args: ['install', 'java', '21.0.3-tem'],
      verifyCommand: 'jdtls --version',
    },
  },
  cpp: {
    displayName: 'C/C++',
    extensions: ['cpp', 'cc', 'cxx', 'c', 'h', 'hpp', 'hh'],
    serverBinary: 'clangd',
    args: [],
    install: {
      command: 'apt',
      args: ['install', 'clangd'],
      verifyCommand: 'clangd --version',
    },
    alternatives: [
      {
        command: 'apt',
        args: ['install', 'ccls'],
        verifyCommand: 'ccls --version',
      },
    ],
    // C headers detect as the 'c' language ID for didOpen, but route to cpp for install/launch
    languageIds: { c: 'c', h: 'c' },
  },
  // Launch-only alias so serverId 'c' resolves to clangd; installs/status use 'cpp'
  c: {
    displayName: 'C',
    extensions: [],
    serverBinary: 'clangd',
    args: [],
    aliasOf: 'cpp',
  },
  csharp: {
    displayName: 'C#',
    extensions: ['cs'],
    serverBinary: 'omniSharp',
    args: ['--languageserver', '--hostPID', String(process.pid)],
    install: {
      command: 'dotnet',
      args: ['tool', 'install', '--global', 'OmniSharp'],
      verifyCommand: 'omniSharp --version',
    },
  },
  ruby: {
    displayName: 'Ruby',
    extensions: ['rb'],
    serverBinary: 'solargraph',
    args: ['stdio'],
    install: {
      command: 'gem',
      args: ['install', 'solargraph'],
      verifyCommand: 'solargraph --version',
    },
  },
  php: {
    displayName: 'PHP',
    extensions: ['php'],
    serverBinary: 'phpactor',
    args: ['--stdio'],
    install: {
      command: 'composer',
      args: ['global', 'require', 'phpactor/phpactor'],
      verifyCommand: 'phpactor --version',
    },
  },
  vue: {
    displayName: 'Vue',
    extensions: ['vue'],
    serverBinary: 'vue-language-server',
    args: ['--stdio'],
    install: {
      command: 'npm',
      args: ['install', '--prefix', installDir, 'volar'],
      verifyCommand: `${path.join(nodeBinDir, 'volar-server')} --version`,
    },
  },
  svelte: {
    displayName: 'Svelte',
    extensions: ['svelte'],
    serverBinary: 'svelte-language-server',
    args: ['--stdio'],
    install: {
      command: 'npm',
      args: ['install', '--prefix', installDir, 'svelte-language-server'],
      verifyCommand: `${path.join(nodeBinDir, 'svelte-language-server')} --version`,
    },
  },
};

// ---------------------------------------------------------------------------
// Derived extension lookup tables (built once from the registry)
// ---------------------------------------------------------------------------

/** ext → registry key (e.g. 'tsx' → 'typescript') */
const EXT_TO_LANGUAGE: Record<string, string> = {};
/** ext → LSP languageId for didOpen (e.g. 'tsx' → 'typescriptreact') */
const EXT_TO_LANGUAGE_ID: Record<string, string> = {};

for (const [lang, entry] of Object.entries(LSP_REGISTRY)) {
  if (entry.aliasOf) continue;
  for (const ext of entry.extensions) {
    EXT_TO_LANGUAGE[ext] = lang;
    EXT_TO_LANGUAGE_ID[ext] = entry.languageIds?.[ext] ?? lang;
  }
}

/**
 * Get the registry language key for a file path (e.g. 'foo.ts' → 'typescript').
 * Returns null for unsupported extensions.
 */
export function getLanguageFromPath(filePath: string): string | null {
  const ext = path.extname(filePath).slice(1).toLowerCase();
  return EXT_TO_LANGUAGE[ext] ?? null;
}

/**
 * Detect the LSP language ID for a file path (e.g. 'foo.tsx' → 'typescriptreact').
 * Used as the languageId in textDocument/didOpen. Returns null if unknown.
 */
export function detectLanguage(filePath: string): string | null {
  const ext = filePath.split('.').pop()?.toLowerCase();
  if (!ext) return null;
  return EXT_TO_LANGUAGE_ID[ext] ?? null;
}

/**
 * Resolve a registry entry by id, following aliasOf links.
 * Returns undefined for unknown ids.
 */
export function resolveRegistryEntry(languageId: string): LspRegistryEntry | undefined {
  const entry = LSP_REGISTRY[languageId];
  if (!entry) return undefined;
  return entry.aliasOf ? LSP_REGISTRY[entry.aliasOf] : entry;
}

/**
 * Registry keys available for installation/status listings
 * (excludes launch-only aliases like 'c').
 */
export function getInstallableLanguages(): string[] {
  return Object.keys(LSP_REGISTRY).filter((key) => !LSP_REGISTRY[key].aliasOf);
}
