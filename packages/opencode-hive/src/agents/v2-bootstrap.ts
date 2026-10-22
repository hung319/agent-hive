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
 * default agent selection through `ctx.agent.transform` (built-in agents are
 * left untouched: demoting `build` breaks `opencode run`'s default session).
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
  return Object.entries(permission).map(([action, effect]) => ({
    action: V2_ACTION_ALIASES[action] ?? action,
    resource: '*',
    effect,
  }));
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
  /** Optional sampling temperature (supported in V2 agent md frontmatter). */
  temperature?: number;
  permissions: V2PermissionRule[];
}

/** Convert a V1-shaped runtime agent config into a native V2 definition. */
export function toV2AgentDefinition(config: RuntimeAgentConfig): V2AgentDefinition {
  return {
    description: config.description,
    mode: 'subagent',
    system: config.prompt,
    model: toV2ModelRef(config),
    temperature: config.temperature,
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
  if (definition.temperature !== undefined) {
    lines.push(`temperature: ${definition.temperature}`);
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
  /** Project location where `.opencode/agents/` lives. */
  directory: string;
  primaryAgent: string;
  /** Final agent map (agent id → V1-shaped runtime config). */
  agents: Record<string, RuntimeAgentConfig>;
}

/**
 * Write one `<id>.md` file per agent into `<project>/.opencode/agents/`.
 * Idempotent: setup regenerated the files on every load so config changes
 * (model, custom agents, auto-loaded skills) are reflected next session.
 */
export function writeAgentDefinitions(input: WriteAgentDefinitionsInput): {
  directory: string;
  written: string[];
} {
  const agentsDir = path.join(input.directory, '.opencode', 'agents');
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
  return { directory: agentsDir, written };
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
