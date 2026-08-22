import * as fs from 'fs';
import * as path from 'path';
import { LspTransport } from './transport.js';
import { LspClient } from './client.js';
import { getLanguageFromPath, getLspInstallDir, type LspServerConfig } from '../tools/lsp-manager.js';

/**
 * LSP Manager — manages LSP client instances per workspace and language.
 *
 * Features:
 * - Client pooling: one client per workspace::language combination
 * - Idle reaper: kills clients idle for more than 5 minutes
 * - Graceful shutdown: closes all clients on shutdown
 */
export class LspManager {
  private clients = new Map<string, { client: LspClient; lastUsed: number }>();

  /**
   * Get or create an LSP client for the given workspace and server.
   */
  async getClient(workspaceRoot: string, serverId: string): Promise<LspClient> {
    const key = LspManager.getClientKey(workspaceRoot, serverId);

    const existing = this.clients.get(key);
    if (existing) {
      existing.lastUsed = Date.now();
      return existing.client;
    }

    // Find the server command for this language
    const serverPath = await resolveServerPath(serverId);
    if (!serverPath) {
      throw new Error(`No LSP server found for language: ${serverId}. Install one with lsp_install.`);
    }

    // Create transport and client
    const transport = new LspTransport(serverPath.path, serverPath.args);
    transport.start();

    const client = new LspClient(transport);

    try {
      await client.initialize(workspaceRoot);
    } catch (err: any) {
      transport.close();
      throw new Error(`Failed to initialize LSP for ${serverId}: ${err.message}`);
    }

    this.clients.set(key, { client, lastUsed: Date.now() });
    return client;
  }

  /**
   * Release a client (does not close it, just removes from pool).
   */
  releaseClient(key: string): void {
    this.clients.delete(key);
  }

  /**
   * Kill clients that have been idle for more than 5 minutes.
   */
  reapIdleClients(): void {
    const now = Date.now();
    const IDLE_TIMEOUT = 5 * 60 * 1000; // 5 minutes

    for (const [key, entry] of this.clients) {
      if (now - entry.lastUsed > IDLE_TIMEOUT) {
        entry.client.close().catch(() => {});
        this.clients.delete(key);
      }
    }
  }

  /**
   * Get the number of active clients.
   */
  getActiveClients(): number {
    return this.clients.size;
  }

  /**
   * Shut down all clients gracefully.
   */
  async shutdownAll(): Promise<void> {
    const shutdowns = [...this.clients.values()].map((entry) =>
      entry.client.close().catch(() => {})
    );
    await Promise.all(shutdowns);
    this.clients.clear();
  }

  /**
   * Generate a unique key for a workspace::server combination.
   */
  static getClientKey(workspaceRoot: string, serverId: string): string {
    return `${workspaceRoot}::${serverId}`;
  }
}

/**
 * Resolved server path info.
 */
interface ResolvedServer {
  path: string;
  args: string[];
}

/**
 * Server command definitions per language (bare command names).
 * Local install directories are probed before falling back to system PATH.
 */
const SERVER_COMMANDS: Record<string, { command: string; args: string[] }> = {
  typescript: { command: 'typescript-language-server', args: ['--stdio'] },
  python: { command: 'pyright', args: ['--stdio'] },
  rust: { command: 'rust-analyzer', args: [] },
  go: { command: 'gopls', args: [] },
  java: { command: 'jdtls', args: [] },
  cpp: { command: 'clangd', args: [] },
  c: { command: 'clangd', args: [] },
  csharp: { command: 'omniSharp', args: ['--languageserver', '--hostPID', String(process.pid)] },
  ruby: { command: 'solargraph', args: ['stdio'] },
  php: { command: 'phpactor', args: ['--stdio'] },
  vue: { command: 'vue-language-server', args: ['--stdio'] },
  svelte: { command: 'svelte-language-server', args: ['--stdio'] },
};

/**
 * Check whether a file exists and is executable.
 */
function isExecutable(candidate: string): boolean {
  try {
    fs.accessSync(candidate, fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Find a command on the system PATH.
 */
function findOnPath(command: string): string | null {
  const dirs = (process.env.PATH ?? '').split(path.delimiter).filter(Boolean);
  for (const dir of dirs) {
    const candidate = path.join(dir, command);
    if (isExecutable(candidate)) return candidate;
  }
  return null;
}

/**
 * Resolve the LSP server binary path for a given language.
 *
 * Checks in order, returning the first candidate that actually exists:
 * 1. Local npm-style install (~/.config/opencode/hive/lsp/node_modules/.bin/)
 * 2. Legacy local bin dir (~/.config/opencode/hive/lsp/bin/)
 * 3. System PATH
 */
async function resolveServerPath(serverId: string): Promise<ResolvedServer | null> {
  const installDir = getLspInstallDir();
  const nodeBinDir = path.join(installDir, 'node_modules', '.bin');
  const legacyBinDir = path.join(installDir, 'bin');

  const server = SERVER_COMMANDS[serverId];
  if (!server) return null;

  const localCandidates = [
    path.join(nodeBinDir, server.command),
    path.join(legacyBinDir, server.command),
  ];

  for (const candidate of localCandidates) {
    if (isExecutable(candidate)) {
      return { path: candidate, args: server.args };
    }
  }

  const onPath = findOnPath(server.command);
  return onPath ? { path: onPath, args: server.args } : null;
}

/**
 * Get LSP client for a file path (convenience wrapper).
 */
export async function getLspClientForFile(
  filePath: string,
  workspaceRoot: string,
  manager: LspManager
): Promise<{ client: LspClient; language: string } | null> {
  const lang = getLanguageFromPath(filePath);
  if (!lang) return null;

  try {
    const client = await manager.getClient(workspaceRoot, lang);
    return { client, language: lang };
  } catch {
    return null;
  }
}

// Export singleton for convenience
export const lspClientManager = new LspManager();
