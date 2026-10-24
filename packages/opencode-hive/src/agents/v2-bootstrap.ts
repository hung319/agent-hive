/**
 * V2 agent bootstrap.
 *
 * OpenCode V2 does not let plugins add new agents through `ctx.agent.transform`
 * (that editor can only update existing agents). New agents must be discovered
 * from `.opencode/agents/*.md` files or an `agents` configuration entry.
 *
 * At plugin setup we therefore generate one Markdown agent file per Hive
 * agent from the V1-shaped runtime configs (prompt, model, variant,
 * permission map) accumulated in `index.ts`. The plugin then wires the
 * default agent selection and demotes the built-in `build`/`plan` primaries
 * through `ctx.agent.transform`, leaving OpenCode's hidden system agents
 * (compaction, title, summary) untouched.
 *
 * OpenCode 2.1 no longer accepts a `temperature` field on agent definitions
 * (it logs "ignored unsupported agent fields"), so the generated frontmatter
 * omits it. The config option is still parsed for forward compatibility.
 */
import * as fs from 'fs';
import * as path from 'path';
import type { McpConfig } from '../mcp/types.js';

/**
 * The V1-shaped runtime agent config produced inside `index.ts`.
 */
export interface RuntimeAgentConfig {
  mode?: 'subagent';
  description: string;
  prompt: string;
  model?: string;
  variant?: string;
  /** Accepted for config compatibility; OpenCode 2.1 ignores agent temperature. */
  temperature?: number;
  tools?: Record<string, boolean>;
  permission?: Record<string, string>;
}

/** V1 permission keys that renamed in the V2 permission actions. */
const V2_ACTION_ALIASES: Record<string, string> = {
  task: 'subagent',
  delegate: 'subagent',
  bash: 'shell',
  write: 'edit',
  patch: 'edit',
};

interface V2PermissionRule {
  action: string;
  resource: string;
  effect: string;
}

function toV2Permissions(permission?: Record<string, string>): V2PermissionRule[] {
  if (!permission) return [];
  const rules: V2PermissionRule[] = [];
  for (const [action, effect] of Object.entries(permission)) {
    const v2Action = V2_ACTION_ALIASES[action] ?? action;
    // V1 maps often list several aliases for one V2 action (write/edit/patch),
    // which would emit duplicate rules once aliased. Keep the first effect.
    if (rules.some((rule) => rule.action === v2Action && rule.resource === '*')) continue;
    rules.push({ action: v2Action, resource: '*', effect });
  }
  return rules;
}

/**
 * Convert model/variant to the V2 `provider/model#variant` reference.
 * Returns undefined when no model is configured so the agent inherits the
 * session model (same semantics the V1 model sanitization provided).
 */
export function toV2ModelRef(config: { model?: string; variant?: string }): string | undefined {
  if (typeof config.model !== 'string' || config.model.trim() === '') return undefined;
  const variant = normalizeTrimmed(config.variant);
  return variant ? `${config.model}#${variant}` : config.model;
}

function normalizeTrimmed(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export interface V2AgentDefinition {
  description: string;
  mode: 'primary' | 'subagent';
  system: string;
  model?: string;
  permissions: V2PermissionRule[];
}

/** Convert a V1-shaped runtime agent config into a native V2 definition. */
export function toV2AgentDefinition(config: RuntimeAgentConfig): V2AgentDefinition {
  return {
    description: config.description,
    mode: 'subagent',
    system: config.prompt,
    model: toV2ModelRef(config),
    permissions: toV2Permissions(config.permission),
  };
}

function frontmatterValue(value: string): string {
  // JSON.stringify output is a valid YAML double-quoted scalar.
  return JSON.stringify(value);
}

export function renderAgentMarkdown(
  agentName: string,
  definition: V2AgentDefinition,
): string {
  const lines: string[] = ['---'];
  lines.push(`description: ${frontmatterValue(definition.description)}`);
  lines.push(`mode: ${definition.mode}`);
  if (definition.model) {
    lines.push(`model: ${definition.model}`);
  }
  if (definition.permissions.length > 0) {
    lines.push('permissions:');
    for (const rule of definition.permissions) {
      const parts = [`action: ${frontmatterValue(rule.action)}`];
      if (rule.resource) parts.push(`resource: ${frontmatterValue(rule.resource)}`);
      parts.push(`effect: ${frontmatterValue(rule.effect)}`);
      lines.push('  - { ' + parts.join(', ') + ' }');
    }
  }
  lines.push('---');
  lines.push('');
  lines.push(definition.system);
  return lines.join('\n') + '\n';
}

export interface WriteAgentDefinitionsInput {
  /** Project location; only used to clean up legacy project-local agent files. */
  directory: string;
  primaryAgent: string;
  /** Final agent map (agent id → V1-shaped runtime config). */
  agents: Record<string, RuntimeAgentConfig>;
  /** Global config root (`$XDG_CONFIG_HOME/opencode` or `~/.config/opencode`). */
  configRoot: string;
}

/**
 * V1 installed agents once, globally; Hive now keeps every agent definition in
 * the OpenCode config dir (next to `agent_hive.json`), so one plugin install
 * serves every project. `OPENCODE_AGENTS_DIR` overrides the location.
 */
export function resolveGlobalAgentsDir(configRoot: string, env: NodeJS.ProcessEnv = process.env): string {
  const override = normalizeTrimmed(env.OPENCODE_AGENTS_DIR);
  if (override) return override;
  return path.join(configRoot, 'agents');
}

/**
 * Global OpenCode config root (`$XDG_CONFIG_HOME/opencode` or `~/.config/opencode`),
 * matching where Hive keeps `agent_hive.json`, skills and installed packages.
 */
export function resolveConfigRoot(env: NodeJS.ProcessEnv = process.env): string {
  const xdg = normalizeTrimmed(env.XDG_CONFIG_HOME);
  if (xdg) return path.join(xdg, 'opencode');
  const home = normalizeTrimmed(env.HOME) ?? normalizeTrimmed(env.USERPROFILE) ?? '';
  return path.join(home, '.config', 'opencode');
}

/**
 * Project-local agent files written by earlier 2.x builds. They shadow the
 * global definitions, so they are removed once the global ones are in place.
 */
export function legacyProjectAgentsDir(directory: string): string {
  return path.join(directory, '.opencode', 'agents');
}

/**
 * Remove project-local copies of Hive agents and prune the directory.
 * Only files matching a Hive agent id are touched; user-authored agents in
 * the same folder stay. Returns the paths that were removed.
 */
export function removeLegacyProjectAgents(
  projectDirectory: string,
  agentNames: Iterable<string>,
): string[] {
  const dir = legacyProjectAgentsDir(projectDirectory);
  if (!fs.existsSync(dir)) return [];

  const removed: string[] = [];
  for (const agentName of agentNames) {
    if (!agentName || agentName.includes('/') || agentName.includes('\\')) continue;
    const filePath = path.join(dir, `${agentName}.md`);
    if (!fs.existsSync(filePath)) continue;
    try {
      fs.rmSync(filePath);
      removed.push(filePath);
    } catch {
      // Best-effort cleanup: a read-only file must not break plugin setup.
    }
  }

  try {
    if (fs.readdirSync(dir).length === 0) {
      fs.rmdirSync(dir);
    }
  } catch {
    // Directory may be in use or already gone.
  }
  return removed;
}

/**
 * Write one `<id>.md` file per agent into the global agents directory.
 * Idempotent: setup regenerated the files on every load so config changes
 * (model, custom agents, auto-loaded skills) are reflected next session.
 */
export function writeAgentDefinitions(input: WriteAgentDefinitionsInput): {
  directory: string;
  written: string[];
  removedLegacy: string[];
} {
  const agentsDir = resolveGlobalAgentsDir(input.configRoot);
  fs.mkdirSync(agentsDir, { recursive: true });

  const written: string[] = [];
  for (const [agentName, runtimeConfig] of Object.entries(input.agents)) {
    if (!runtimeConfig || typeof runtimeConfig !== 'object') continue;
    const definition = toV2AgentDefinition(runtimeConfig);
    definition.mode = agentName === input.primaryAgent ? 'primary' : 'subagent';
    const filePath = path.join(agentsDir, `${agentName}.md`);
    fs.writeFileSync(filePath, renderAgentMarkdown(agentName, definition));
    written.push(filePath);
  }

  const removedLegacy = removeLegacyProjectAgents(input.directory, Object.keys(input.agents));
  return { directory: agentsDir, written, removedLegacy };
}

/**
 * Convert the plugin's V1 MCP config into the native V2 shape:
 * `enabled` is replaced with the inverse `disabled`; local/remote field names
 * stay the same; `timeout` gains split purposes (left absent when not set).
 */
export function toV2McpConfig(config: McpConfig | Record<string, unknown>): Record<string, unknown> {
  const source = config as Record<string, unknown>;
  const out: Record<string, unknown> = {
    type: (source.type as string | undefined) ?? 'remote',
  };
  if (out.type === 'local') {
    const command = (source.command as unknown) ?? [];
    out.command = Array.isArray(command) ? (command as string[]) : [];
    if (source.environment && typeof source.environment === 'object') {
      out.environment = source.environment;
    }
  } else {
    if (typeof source.url === 'string') out.url = source.url;
    if (source.headers && typeof source.headers === 'object') out.headers = source.headers;
  }
  out.disabled = source.enabled === false;
  return out;
}
