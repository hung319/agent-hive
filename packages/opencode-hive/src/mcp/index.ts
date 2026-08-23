import type { McpConfig } from './types.js';
import { websearchMcp } from './websearch';
import { context7Mcp } from './context7';
import { grepAppMcp } from './grep-app';
import { createCodegraphMcp } from './codegraph';
import { isCodegraphAvailable, getCodegraphCommand } from '../utils/codegraph-installer.js';

/**
 * Built-in MCP configurations
 *
 * Priority: Remote MCPs are preferred (no local installation needed)
 * - websearch: Remote (Exa AI) - supports EXA_API_KEY env var
 * - context7: Remote (Context7) - supports CONTEXT7_API_KEY env var
 * - grep_app: Remote (GitHub code search)
 *
 * Local MCPs:
 * - codegraph: Pre-indexed code knowledge graph. Registered ONLY when the
 *   binary is available (Hive manages an auto-updated bundle there — checked
 *   at most daily — installed to ~/.config/opencode/hive/codegraph on boot;
 *   until then it is omitted so OpenCode never spawns a missing binary). The
 *   install runs in the background, so the MCP appears on the next session.
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
  /** Readiness probe for the local codegraph MCP (defaults to installer check). */
  isCodegraphReady?: () => boolean;
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
    const isReady = opts.isCodegraphReady ?? isCodegraphAvailable;
    if (isReady()) {
      const codegraphCommand = getCodegraphCommand();
      if (codegraphCommand !== '') {
        result.codegraph = createCodegraphMcp(codegraphCommand);
      }
    }
  }

  return result;
};

// Backward compatibility alias
export const createBuiltinMcps = getBuiltinMcps;
