import type { LocalMcpConfig } from './types';

/**
 * CodeGraph MCP - Pre-indexed code knowledge graph for semantic code intelligence.
 *
 * Runs `codegraph serve --mcp` locally, which exposes tools:
 * - codegraph_explore: Query the knowledge graph for symbols, call paths, and blast radius
 *
 * Auto-provisions and auto-inits like oh-my-openagent:
 * - Downloads binary if not present
 * - Runs `codegraph init` on first session start
 * - Global store with symlinks for deduplication
 *
 * 100% local - no API keys needed. Auto-syncs on file changes.
 *
 * @see https://github.com/colbymchenry/codegraph
 * @see oh-my-openagent/packages/utils/src/codegraph/
 */
export const codegraphMcp: LocalMcpConfig = {
  type: 'local',
  command: ['codegraph', 'serve', '--mcp'],
  environment: {
    CODEGRAPH_NO_DOWNLOAD: '1',     // prevent self-update, we manage the binary
    CODEGRAPH_TELEMETRY: '0',       // disable telemetry
    DO_NOT_TRACK: '1',
  },
};
