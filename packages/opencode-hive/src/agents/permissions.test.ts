import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test';
import { ConfigService } from 'hive-core';
import * as fs from 'fs';
import * as path from 'path';
import { runV2PluginSetup, agentsDirOf, type V2Harness } from '../__tests__/v2-harness';

/**
 * V2 note: agents are contributed as generated `.opencode/agents/*.md`
 * definitions and per-agent hive-tool filtering happens in a session
 * `context` hook (V2 agent definitions carry no `tools` map or
 * `permission` object). These tests run the plugin through the shared V2
 * harness and assert on the generated markdown + captured hooks.
 */

type MdFile = string | undefined;

function readAgentMd(harness: V2Harness, id: string): MdFile {
  // Agent files are global; resolve the dir like setup does so an ambient
  // XDG_CONFIG_HOME cannot move them out from under the assertion.
  const file = path.join(agentsDirOf(harness), `${id}.md`);
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf-8') : undefined;
}

function permissionRules(md: MdFile): string[] {
  const match = md?.match(/permissions:\n((?:  - \{[^\n]*\}\n?)+)/);
  if (!match) return [];
  return match[1].trim().split('\n').map((l) => l.trim());
}

function hasDeny(md: MdFile, action: string): boolean {
  // Rules render as: - { action: "<action>", resource: "*", effect: "<effect>" }
  return permissionRules(md).some((rule) => rule.includes(`action: "${action}"`) && rule.includes('effect: "deny"'));
}

const TOOLS_UNIVERSE: Record<string, unknown> = {
  hive_feature_create: {},
  hive_plan_write: {},
  hive_plan_read: {},
  hive_tasks_sync: {},
  hive_task_create: {},
  hive_task_update: {},
  hive_worktree_start: {},
  hive_worktree_create: {},
  hive_worktree_commit: {},
  hive_merge: {},
  hive_context_write: {},
  hive_status: {},
  hive_skill: {},
  read: {},
};

/** Invoke the plugin's captured session `context` hook as V2 would. */
function applyToolGate(harness: V2Harness, agent: string): Record<string, unknown> {
  const handler = harness.sessionHooks.get('context')?.at(-1);
  expect(handler).toBeDefined();
  const tools = { ...TOOLS_UNIVERSE };
  const event = { agent, tools };
  const result = handler!(event as never);
  return (result as { tools?: Record<string, unknown> })?.tools ?? (event as { tools: Record<string, unknown> }).tools;
}

describe('Agent permissions (V2 bootstrap)', () => {
  let originalHiveDisable: string | undefined;
  let harness: V2Harness | null = null;

  beforeEach(() => {
    originalHiveDisable = process.env.HIVE_DISABLE_AUTO_INSTALL;
    process.env.HIVE_DISABLE_AUTO_INSTALL = '1';
  });

  afterEach(() => {
    mock.restore();
    if (harness) {
      harness.restoreHome();
      fs.rmSync(harness.projectDir, { recursive: true, force: true });
      harness = null;
    }
    if (originalHiveDisable === undefined) delete process.env.HIVE_DISABLE_AUTO_INSTALL;
    else process.env.HIVE_DISABLE_AUTO_INSTALL = originalHiveDisable;
  });

  async function setupWith(config: Record<string, unknown>): Promise<V2Harness> {
    harness = await runV2PluginSetup({ config });
    return harness;
  }

  it('registers zetta, scout, forager, and hygienic in unified mode', async () => {
    const h = await setupWith({ agentMode: 'unified', agents: { zetta: {} } });

    // Agents are generated into `<config>/agents` in V2
    expect(readAgentMd(h, 'zetta')).toBeTruthy();
    expect(readAgentMd(h, 'swarm-orchestrator')).toBeUndefined();
    expect(readAgentMd(h, 'architect-planner')).toBeUndefined();
    expect(readAgentMd(h, 'scout-researcher')).toBeTruthy();
    expect(readAgentMd(h, 'forager-worker')).toBeTruthy();
    expect(readAgentMd(h, 'hygienic-reviewer')).toBeTruthy();

    // zetta is the primary/default agent
    expect(readAgentMd(h, 'zetta')).toContain('mode: primary');
    expect(h.agentDefaults).toContain('zetta');

    // zetta keeps permission rules in its generated definition
    expect(permissionRules(readAgentMd(h, 'zetta')).length).toBeGreaterThan(0);
  });

  it('registers dedicated agents in dedicated mode', async () => {
    const h = await setupWith({ agentMode: 'dedicated', agents: { zetta: {} } });

    for (const id of ['zetta', 'scout-researcher', 'forager-worker', 'hygienic-reviewer', 'codebase-locator', 'codebase-analyzer']) {
      expect(readAgentMd(h, id)).toBeTruthy();
    }
    expect(h.agentDefaults).toContain('zetta');
  });

  it('explicitly denies delegation tools for subagents', async () => {
    const h = await setupWith({ agentMode: 'unified', agents: { zetta: {} } });

    for (const id of ['scout-researcher', 'forager-worker', 'hygienic-reviewer']) {
      // V1 `task`/`delegate` → V2 `subagent` action deny
      expect(hasDeny(readAgentMd(h, id), 'subagent')).toBe(true);
    }
    // zetta must be able to launch subagents
    expect(hasDeny(readAgentMd(h, 'zetta'), 'subagent')).toBe(false);
  });

  it('inherits subagent safety restrictions for custom forager and hygienic families', async () => {
    const h = await setupWith({
      agentMode: 'unified',
      agents: { zetta: {} },
      customAgents: {
        'forager-ui': { baseAgent: 'forager-worker', description: 'UI-focused forager', variant: 'high' },
        'reviewer-security': { baseAgent: 'hygienic-reviewer', description: 'Security-focused reviewer', variant: 'medium' },
      },
    });

    expect(readAgentMd(h, 'forager-ui')).toBeTruthy();
    expect(readAgentMd(h, 'reviewer-security')).toBeTruthy();

    // forager family: no subagent launches
    expect(hasDeny(readAgentMd(h, 'forager-ui'), 'subagent')).toBe(true);
    // reviewer family: no edits
    expect(hasDeny(readAgentMd(h, 'reviewer-security'), 'edit')).toBe(true);

    // The context hook applies the same gate to custom agents
    const foragerUi = applyToolGate(h, 'forager-ui');
    expect(Object.hasOwn(foragerUi, 'hive_worktree_commit')).toBe(true);
    expect(Object.hasOwn(foragerUi, 'hive_merge')).toBe(false);
    expect(Object.hasOwn(foragerUi, 'hive_status')).toBe(false);

    const reviewer = applyToolGate(h, 'reviewer-security');
    expect(Object.hasOwn(reviewer, 'hive_plan_read')).toBe(true);
    expect(Object.hasOwn(reviewer, 'hive_worktree_commit')).toBe(false);
  });
});

describe('Per-agent tool filtering (V2 context hook)', () => {
  let originalHiveDisable2: string | undefined;
  let harness: V2Harness | null = null;

  beforeEach(() => {
    originalHiveDisable2 = process.env.HIVE_DISABLE_AUTO_INSTALL;
    process.env.HIVE_DISABLE_AUTO_INSTALL = '1';
  });

  afterEach(() => {
    mock.restore();
    if (harness) {
      harness.restoreHome();
      fs.rmSync(harness.projectDir, { recursive: true, force: true });
      harness = null;
    }
    if (originalHiveDisable2 === undefined) delete process.env.HIVE_DISABLE_AUTO_INSTALL;
    else process.env.HIVE_DISABLE_AUTO_INSTALL = originalHiveDisable2;
  });

  async function gateFor(agent: string): Promise<Record<string, unknown>> {
    if (!harness) {
      harness = await runV2PluginSetup({ config: { agentMode: 'unified', agents: { zetta: {} } } });
    }
    const tools = { ...TOOLS_UNIVERSE };
    const handler = harness.sessionHooks.get('context')?.at(-1);
    expect(handler).toBeDefined();
    await handler!({ agent, tools } as never);
    return tools;
  }

  it('forager has hive_worktree_commit allowed and hive_merge disabled', async () => {
    const tools = await gateFor('forager-worker');
    expect(tools['hive_worktree_commit']).toBeDefined();
    expect(tools['hive_merge']).toBeUndefined();
  });

  it('forager tool list is exactly [hive_plan_read, hive_worktree_commit, hive_context_write, hive_skill] and excludes hive_status', async () => {
    const tools = await gateFor('forager-worker');
    expect(tools['hive_status']).toBeUndefined();
    expect(tools['hive_plan_read']).toBeDefined();
    expect(tools['hive_worktree_commit']).toBeDefined();
    expect(tools['hive_context_write']).toBeDefined();
    expect(tools['hive_skill']).toBeDefined();
  });

  it('scout has only read-only hive tools (no worktree_commit, no merge)', async () => {
    const tools = await gateFor('scout-researcher');
    expect(tools['hive_worktree_commit']).toBeUndefined();
    expect(tools['hive_merge']).toBeUndefined();
    expect(tools['hive_plan_read']).toBeDefined();
    expect(tools['hive_context_write']).toBeDefined();
  });

  it('hygienic has same tool set as scout', async () => {
    const hygienic = Object.keys(await gateFor('hygienic-reviewer')).filter((k) => k.startsWith('hive_')).sort();
    harness = null;
    const scout = Object.keys(await gateFor('scout-researcher')).filter((k) => k.startsWith('hive_')).sort();
    expect(hygienic).toEqual(scout);
  });

  it('zetta has no tools filter (all tools allowed)', async () => {
    const tools = await gateFor('zetta');
    expect(tools['hive_merge']).toBeDefined();
    expect(tools['hive_worktree_commit']).toBeDefined();
    expect(tools['hive_status']).toBeDefined();
  });

  it('codebase-locator has read-only hive tools (hive_plan_read, hive_skill)', async () => {
    const tools = await gateFor('codebase-locator');
    expect(tools['hive_plan_read']).toBeDefined();
    expect(tools['hive_skill']).toBeDefined();
    expect(tools['hive_worktree_commit']).toBeUndefined();
    expect(tools['hive_merge']).toBeUndefined();
    expect(tools['hive_worktree_start']).toBeUndefined();
  });

  it('codebase-analyzer has read-only hive tools (hive_plan_read, hive_skill)', async () => {
    const tools = await gateFor('codebase-analyzer');
    expect(tools['hive_plan_read']).toBeDefined();
    expect(tools['hive_skill']).toBeDefined();
    expect(tools['hive_worktree_commit']).toBeUndefined();
    expect(tools['hive_merge']).toBeUndefined();
  });

  it('6 core agents are registered in both unified and dedicated modes', async () => {
    const coreAgents = ['zetta', 'codebase-locator', 'codebase-analyzer', 'scout-researcher', 'forager-worker', 'hygienic-reviewer'];

    for (const agentMode of ['unified', 'dedicated']) {
      const h = await runV2PluginSetup({ config: { agentMode, agents: { zetta: {} } } });
      for (const name of coreAgents) {
        expect(readAgentMd(h, name)).toBeTruthy();
      }
      h.restoreHome();
      fs.rmSync(h.projectDir, { recursive: true, force: true });
    }
  });
});
