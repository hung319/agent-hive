import type { McpConfig } from './types.js';
import { websearchMcp } from './websearch';
import { context7Mcp } from './context7';
import { grepAppMcp } from './grep-app';
import { createCodegraphMcp } from './codegraph';
import {
  resolveCodegraphMcpCommand,
  type CodegraphMcpResolution,
} from '../utils/codegraph-installer.js';

/**
 * Built-in MCP configurations
 *
 * Priority: Remote MCPs are preferred (no local installation needed)
 * - websearch: Remote (Exa AI) - supports EXA_API_KEY env var
 * - context7: Remote (Context7) - supports CONTEXT7_API_KEY env var
 * - grep_app: Remote (GitHub code search)
 *
 * Local MCPs:
 * - codegraph: Pre-indexed code knowledge graph backed by the npm dependency's
 *   self-healing shim (resolves its platform bundle, downloads on first spawn
 *   when missing), with a legacy managed-bundle marker and a PATH executable
 *   as fallbacks. Registered whenever any source resolves — no restart needed.
 *
 * Note: ast_grep and gitingest are registered as native tools (not MCP)
 */

// Remote MCPs are static — resolved once, lazily.
let cachedRemoteMcps: Record<string, McpConfig> | null = null;

function getRemoteMcps(): Record<string, McpConfig> {
  if (!cachedRemoteMcps) {
    cachedRemoteMcps = {
      websearch: websearchMcp,
      context7: context7Mcp,
      grep_app: grepAppMcp,
    };
  }
  return cachedRemoteMcps;
}

export interface BuiltinMcpOptions {
  /** Command resolver for the local codegraph MCP (defaults to installer check). */
  resolveCodegraph?: () => CodegraphMcpResolution | null;
}

export const getBuiltinMcps = (
  disabledMcps: string[] = [],
  opts: BuiltinMcpOptions = {},
): Record<string, McpConfig> => {
  const disabled = new Set(disabledMcps);
  const result: Record<string, McpConfig> = {};
  for (const [name, config] of Object.entries(getRemoteMcps())) {
    if (!disabled.has(name)) {
      result[name] = config;
    }
  }

  if (!disabled.has('codegraph')) {
    const resolution = (opts.resolveCodegraph ?? resolveCodegraphMcpCommand)();
    if (resolution !== null) {
      result.codegraph = createCodegraphMcp(resolution.command);
    }
  }

  return result;
};

// Backward compatibility alias
export const createBuiltinMcps = getBuiltinMcps;
