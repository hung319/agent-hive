/**
 * LSP module — real LSP client using JSON-RPC 2.0 over stdio.
 *
 * Exports:
 * - LspTransport: JSON-RPC transport layer
 * - LspClient: LSP protocol client
 * - LspManager: Client lifecycle management
 * - LSP_REGISTRY: single source of truth for language → server mappings
 */
export { LspTransport, createLspTransport } from './transport.js';
export { LspClient, pathToUri, uriToPath } from './client.js';
export type { Location, Diagnostic, Hover, WorkspaceEdit } from './client.js';
export {
  LSP_REGISTRY,
  getLanguageFromPath,
  detectLanguage,
  resolveRegistryEntry,
  getInstallableLanguages,
} from './registry.js';
export type { LspRegistryEntry, LspInstallCommand } from './registry.js';
export { LspManager, lspClientManager, getLspClientForFile } from './manager.js';
