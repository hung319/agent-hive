import type { LocalMcpConfig } from './types.js';

/**
 * CodeGraph MCP - pre-indexed code knowledge graph served locally.
 *
 * The command comes from resolveCodegraphMcpCommand(): by default the npm
 * dependency's npm-shim.js launcher run under the current runtime. The shim
 * resolves its per-platform bundle and downloads it on first spawn when
 * missing, so the MCP works from the very first session without a restart.
 * Fallbacks: legacy managed-bundle marker, then an executable on PATH.
 *
 * 100% local - no API keys needed. Auto-syncs on file changes.
 *
 * @see https://github.com/colbymchenry/codegraph
 */
export const createCodegraphMcp = (command: string[]): LocalMcpConfig => ({
  type: 'local',
  command: [...command, 'serve', '--mcp'],
  environment: {
    CODEGRAPH_TELEMETRY: '0',       // disable telemetry
    DO_NOT_TRACK: '1',
  },
});
