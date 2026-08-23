import type { LocalMcpConfig } from './types.js';

/**
 * CodeGraph MCP - Pre-indexed code knowledge graph for semantic code intelligence.
 *
 * Runs `<codegraph> serve --mcp` locally, which exposes tools:
 * - codegraph_explore: Query the knowledge graph for symbols, call paths, and blast radius
 *
 * Hive manages the auto-updated CodeGraph bundle (checked at most daily) under
 * ~/.config/opencode/hive/codegraph on plugin boot; the MCP is registered only
 * when the binary is available (installed bundle or on PATH), so OpenCode never
 * spawns a missing binary.
 *
 * 100% local - no API keys needed. Auto-syncs on file changes.
 *
 * @see https://github.com/colbymchenry/codegraph
 */
export const createCodegraphMcp = (codegraphCommand: string): LocalMcpConfig => ({
  type: 'local',
  command: [codegraphCommand, 'serve', '--mcp'],
  environment: {
    CODEGRAPH_NO_DOWNLOAD: '1',     // prevent self-update, we manage the binary
    CODEGRAPH_TELEMETRY: '0',       // disable telemetry
    DO_NOT_TRACK: '1',
  },
});
