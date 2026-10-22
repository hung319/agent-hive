import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import * as fs from "fs";

function execSync(cmd: string, opts: { cwd: string }): void {
  const parts = cmd.match(/(?:[^\s"]+|"[^"]*")+/g) ?? [];
  const clean = parts.map(p => p.replace(/^"|"$/g, ''));
  const result = Bun.spawnSync(clean, { cwd: opts.cwd, stdout: "inherit", stderr: "inherit" });
  if (result.exitCode !== 0) {
    throw new Error(`Command failed: ${cmd} exit ${result.exitCode}`);
  }
}
import * as path from "path";
import plugin from "../index";
import {
  runV2PluginSetup,
  execTool,
  createV2ToolContext,
  disposeHarness,
  type V2Harness,
} from "../__tests__/v2-harness.js";
import { BUILTIN_SKILLS } from "../skills/registry.generated.js";
import type { ToolContext } from "../compat/v2-tool.js";

type ToolContext = {
  sessionID: string;
  messageID: string;
  agent: string;
  abort: AbortSignal;
};

const EXPECTED_TOOLS = [
  "hive_feature_create",
  "hive_feature_complete",
  "hive_plan_write",
  "hive_plan_read",
  "hive_plan_approve",
  "hive_tasks_sync",
  "hive_task_create",
  "hive_task_update",
  "hive_worktree_start",
  "hive_worktree_create",
  "hive_worktree_commit",
  "hive_worktree_discard",
  "hive_merge",
  "hive_context_write",
  "hive_status",
  "hive_skill",
] as const;

const TEST_ROOT_BASE = "/tmp/hive-e2e-plugin";

import { createV2ToolContext as makeToolContext } from "../__tests__/v2-harness.js";
function createToolContext(sessionID: string): ToolContext {
  // The V2 compat layer builds the legacy context from these fields.
  return makeToolContext(sessionID) as unknown as ToolContext;
}

describe("e2e: opencode-hive plugin (in-process)", () => {
  let testRoot: string;
  let originalHome: string | undefined;
  let originalHiveDisable: string | undefined;

  beforeEach(() => {
    originalHome = process.env.HOME;
    originalHiveDisable = process.env.HIVE_DISABLE_AUTO_INSTALL;
    process.env.HIVE_DISABLE_AUTO_INSTALL = "1";
    testRoot = fs.mkdtempSync(path.join("/tmp", "hive-e2e-plugin-"));
    process.env.HOME = testRoot;

    execSync("git init", { cwd: testRoot });
    execSync('git config user.email "test@example.com"', { cwd: testRoot });
    execSync('git config user.name "Test"', { cwd: testRoot });
    fs.writeFileSync(path.join(testRoot, "README.md"), "smoke test");
    execSync("git add README.md", { cwd: testRoot });
    execSync('git commit -m "init"', { cwd: testRoot });
  });

  afterEach(() => {
    fs.rmSync(testRoot, { recursive: true, force: true });
    if (originalHome === undefined) {
      delete process.env.HOME;
    } else {
      process.env.HOME = originalHome;
    }
    if (originalHiveDisable === undefined) {
      delete process.env.HIVE_DISABLE_AUTO_INSTALL;
    } else {
      process.env.HIVE_DISABLE_AUTO_INSTALL = originalHiveDisable;
    }
  });

  it("registers expected tools and basic workflow works", async () => {
    const harness = await runV2PluginSetup({ directory: testRoot });
    const execToolRef = (name: string, args: unknown, toolContext: ToolContext) =>
      execTool(harness, name, args, toolContext);

    expect(harness.addedTools.size).toBeGreaterThan(0);

    for (const toolName of EXPECTED_TOOLS) {
      expect(harness.addedTools.get(toolName)).toBeDefined();
      expect(typeof harness.addedTools.get(toolName)?.execute).toBe("function");
    }

    const sessionID = "sess_plugin_smoke";
    const toolContext = createToolContext(sessionID);

    const createOutput = await execToolRef("hive_feature_create", 
      { name: "smoke-feature" },
      toolContext
    );
    expect(createOutput).toContain('Feature "smoke-feature" created');

    const plan = `# Smoke Feature

## Discovery

**Q: Is this a test?**
A: Yes, this is an integration test to validate the basic workflow of feature creation, plan writing, task sync, and worktree operations work correctly end-to-end in the plugin.

## Overview

Test

## Tasks

### 1. First Task
Do it
`;
    const planOutput = await execToolRef("hive_plan_write", 
      { content: plan, feature: "smoke-feature" },
      toolContext
    );
    expect(planOutput).toContain("Plan written");

    const approveOutput = await execToolRef("hive_plan_approve", { feature: "smoke-feature" }, toolContext);
    expect(approveOutput).toContain("Plan approved");

    const syncOutput = await execToolRef("hive_tasks_sync", { feature: "smoke-feature" }, toolContext);
    expect(syncOutput).toContain("Tasks synced");

    const taskFolder = path.join(
      testRoot,
      ".hive",
      "features",
      "smoke-feature",
      "tasks",
      "01-first-task"
    );

    expect(fs.existsSync(taskFolder)).toBe(true);

    // Session is tracked on the feature metadata
    const featureJsonPath = path.join(
      testRoot,
      ".hive",
      "features",
      "smoke-feature",
      "feature.json"
    );

    const featureJson = JSON.parse(fs.readFileSync(featureJsonPath, "utf-8")) as {
      sessionId?: string;
    };

    expect(featureJson.sessionId).toBe(sessionID);

    const statusRaw = await execToolRef("hive_status", 
      { feature: "smoke-feature" },
      toolContext
    );
    const hiveStatus = JSON.parse(statusRaw as string) as {
      tasks?: {
        list?: Array<{
          folder: string;
          dependsOn?: string[] | null;
          worktree?: { branch: string; hasChanges: boolean | null } | null;
        }>;
        runnable?: string[];
        blockedBy?: Record<string, string[]>;
      };
    };

    expect(hiveStatus.tasks?.list?.[0]?.folder).toBe("01-first-task");
    expect(hiveStatus.tasks?.list?.[0]?.dependsOn).toEqual([]);
    expect(hiveStatus.tasks?.list?.[0]?.worktree).toBeNull();
    expect(hiveStatus.tasks?.runnable).toContain("01-first-task");
    expect(hiveStatus.tasks?.blockedBy).toEqual({});

    const execStartOutput = await execToolRef("hive_worktree_start", 
      { feature: "smoke-feature", task: "01-first-task" },
      toolContext
    );
    const execStart = JSON.parse(execStartOutput as string) as {
      instructions?: string;
      backgroundTaskCall?: Record<string, unknown>;
    };
    expect(execStart.backgroundTaskCall).toBeUndefined();

    const specPath = path.join(
      testRoot,
      ".hive",
      "features",
      "smoke-feature",
      "tasks",
      "01-first-task",
      "spec.md"
    );
    const specContent = fs.readFileSync(specPath, "utf-8");
    expect(specContent).toContain("## Dependencies");

    const statusOutput = await execToolRef("hive_status", 
      { feature: "smoke-feature" },
      toolContext
    );
    const status = JSON.parse(statusOutput as string) as {
      tasks?: {
        list?: Array<{ folder: string }>;
      };
    };
    expect(status.tasks?.list?.[0]?.folder).toBe("01-first-task");
  });

  it("returns task tool call using @file prompt", async () => {

    const harness = await runV2PluginSetup({ directory: testRoot });
    const execToolRef = (name: string, args: unknown, toolContext: ToolContext) =>
      execTool(harness, name, args, toolContext);
    const toolContext = createToolContext("sess_task_mode");

    await execToolRef("hive_feature_create", 
      { name: "task-mode-feature" },
      toolContext
    );

    const plan = `# Task Mode Feature

## Discovery

**Q: Is this a test?**
A: Yes, this is an integration test to validate task mode with @file prompts. Testing that worker prompt files are correctly generated and used.

## Overview

Test

## Tasks

### 1. First Task
Do it
`;
    await execToolRef("hive_plan_write", 
      { content: plan, feature: "task-mode-feature" },
      toolContext
    );
    await execToolRef("hive_plan_approve", 
      { feature: "task-mode-feature" },
      toolContext
    );
    await execToolRef("hive_tasks_sync", 
      { feature: "task-mode-feature" },
      toolContext
    );

    const execStartOutput = await execToolRef("hive_worktree_start", 
      { feature: "task-mode-feature", task: "01-first-task" },
      toolContext
    );
    const execStart = JSON.parse(execStartOutput as string) as {
      defaultAgent?: string;
      eligibleAgents?: Array<{
        name: string;
        baseAgent: string;
        description: string;
      }>;
      instructions?: string;
      taskToolCall?: {
        subagent_type?: string;
        description?: string;
        prompt?: string;
      };
    };

    const expectedPromptPath = path.posix.join(
      ".hive",
      "features",
      "task-mode-feature",
      "tasks",
      "01-first-task",
      "worker-prompt.md"
    );

    expect(execStart.taskToolCall).toBeDefined();
    expect(execStart.defaultAgent).toBe("forager-worker");
    expect(execStart.eligibleAgents).toEqual([
      {
        name: "forager-worker",
        baseAgent: "forager-worker",
        description: "Default implementation worker",
      },
      {
        name: "forager-example-template",
        baseAgent: "forager-worker",
        description: "Example template only: rename or delete this entry before use. Do not expect planners/orchestrators to select this placeholder agent as configured.",
      },
    ]);
    expect(execStart.taskToolCall?.subagent_type).toBeDefined();
    expect(execStart.taskToolCall?.description).toBe("Hive: 01-first-task");
    expect(execStart.taskToolCall?.prompt).toContain(`@${expectedPromptPath}`);
    expect(execStart.instructions).toContain("task({");
    expect(execStart.instructions).toContain(
      "prompt: \"Follow instructions in @.hive/features/task-mode-feature/tasks/01-first-task/worker-prompt.md\""
    );
    expect(execStart.instructions).toContain(
      "Use the `@path` attachment syntax in the prompt to reference the file. Do not inline the file contents."
    );
    expect(execStart.instructions).not.toContain("Read the prompt file");
  });

  it("returns forager-derived eligible agents for worktree execution delegation", async () => {
    const configPath = path.join(process.env.HOME || "", ".config", "opencode", "agent_hive.json");
    fs.mkdirSync(path.dirname(configPath), { recursive: true });
    fs.writeFileSync(
      configPath,
      JSON.stringify({
        customAgents: {
          "forager-ui": {
            baseAgent: "forager-worker",
            description: "Use for UI-heavy implementation tasks.",
            autoLoadSkills: [],
          },
          "reviewer-security": {
            baseAgent: "hygienic-reviewer",
            description: "Use for security-focused review passes.",
            autoLoadSkills: [],
          },
        },
      }),
    );

    const harness = await runV2PluginSetup({ directory: testRoot });
    const execToolRef = (name: string, args: unknown, toolContext: ToolContext) =>
      execTool(harness, name, args, toolContext);
    const toolContext = createToolContext("sess_task_mode_custom_agents");

    await execToolRef("hive_feature_create", 
      { name: "task-mode-custom-agents-feature" },
      toolContext
    );

    const plan = `# Task Mode Custom Agents Feature

## Discovery

**Q: Is this a test?**
A: Yes, this is an integration test to validate eligible forager-derived worker options and default fallback behavior in hive_worktree_start.

## Overview

Test

## Tasks

### 1. First Task
Do it
`;
    await execToolRef("hive_plan_write", 
      { content: plan, feature: "task-mode-custom-agents-feature" },
      toolContext
    );
    await execToolRef("hive_plan_approve", 
      { feature: "task-mode-custom-agents-feature" },
      toolContext
    );
    await execToolRef("hive_tasks_sync", 
      { feature: "task-mode-custom-agents-feature" },
      toolContext
    );

    const execStartOutput = await execToolRef("hive_worktree_start", 
      { feature: "task-mode-custom-agents-feature", task: "01-first-task" },
      toolContext
    );
    const execStart = JSON.parse(execStartOutput as string) as {
      defaultAgent?: string;
      eligibleAgents?: Array<{
        name: string;
        baseAgent: string;
        description: string;
      }>;
      instructions?: string;
      taskToolCall?: {
        subagent_type?: string;
      };
    };

    expect(execStart.defaultAgent).toBe("forager-worker");
    expect(execStart.eligibleAgents).toEqual([
      {
        name: "forager-worker",
        baseAgent: "forager-worker",
        description: "Default implementation worker",
      },
      {
        name: "forager-example-template",
        baseAgent: "forager-worker",
        description: "Example template only: rename or delete this entry before use. Do not expect planners/orchestrators to select this placeholder agent as configured.",
      },
      {
        name: "forager-ui",
        baseAgent: "forager-worker",
        description: "Use for UI-heavy implementation tasks.",
      },
    ]);
    expect(execStart.eligibleAgents?.find((agent) => agent.name === "reviewer-security")).toBeUndefined();
    expect(execStart.instructions).toContain("Choose one of the eligible forager-derived agents below.");
    expect(execStart.instructions).toContain("Default to `forager-worker` if no specialist is a better match.");
    expect(execStart.instructions).toContain("`taskToolCall.subagent_type` is prefilled with the default for convenience");
    expect(execStart.instructions).toContain("`forager-ui` — Use for UI-heavy implementation tasks.");
    expect(execStart.taskToolCall?.subagent_type).toBe("forager-worker");
  });

  it("returns structured JSON when hive_worktree_create is called without a feature", async () => {
    const harness = await runV2PluginSetup({ directory: testRoot });
    const execToolRef = (name: string, args: unknown, toolContext: ToolContext) =>
      execTool(harness, name, args, toolContext);
    const toolContext = createToolContext("sess_missing_feature");

    const raw = await execToolRef("hive_worktree_create", 
      { task: "01-missing-task" },
      toolContext
    );

    const result = JSON.parse(raw as string) as {
      success?: boolean;
      terminal?: boolean;
      error?: string;
      hints?: string[];
    };

    expect(result.success).toBe(false);
    expect(result.terminal).toBe(true);
    expect(result.error).toContain("No feature specified");
    expect(Array.isArray(result.hints)).toBe(true);
  });

  it("returns structured JSON when hive_worktree_create task is missing", async () => {
    const harness = await runV2PluginSetup({ directory: testRoot });
    const execToolRef = (name: string, args: unknown, toolContext: ToolContext) =>
      execTool(harness, name, args, toolContext);
    const toolContext = createToolContext("sess_missing_task");

    await execToolRef("hive_feature_create", 
      { name: "missing-task-feature" },
      toolContext
    );

    const raw = await execToolRef("hive_worktree_create", 
      { feature: "missing-task-feature", task: "99-nope" },
      toolContext
    );

    const result = JSON.parse(raw as string) as {
      success?: boolean;
      terminal?: boolean;
      error?: string;
      hints?: string[];
    };

    expect(result.success).toBe(false);
    expect(result.terminal).toBe(true);
    expect(result.error).toContain('Task "99-nope" not found');
    expect(Array.isArray(result.hints)).toBe(true);
  });

  it("returns structured JSON when hive_worktree_create feature is blocked", async () => {
    const harness = await runV2PluginSetup({ directory: testRoot });
    const execToolRef = (name: string, args: unknown, toolContext: ToolContext) =>
      execTool(harness, name, args, toolContext);
    const toolContext = createToolContext("sess_blocked_feature");

    await execToolRef("hive_feature_create", 
      { name: "blocked-feature" },
      toolContext
    );

    const blockedPath = path.join(
      testRoot,
      ".hive",
      "features",
      "blocked-feature",
      "BLOCKED"
    );
    fs.writeFileSync(blockedPath, "Need approval from Beekeeper.");

    const raw = await execToolRef("hive_worktree_create", 
      { feature: "blocked-feature", task: "01-first-task" },
      toolContext
    );

    const result = JSON.parse(raw as string) as {
      success?: boolean;
      terminal?: boolean;
      error?: string;
      hints?: string[];
    };

    expect(result.success).toBe(false);
    expect(result.terminal).toBe(true);
    expect(result.error).toContain("BLOCKED by Beekeeper");
    expect(Array.isArray(result.hints)).toBe(true);
  });

  it("returns structured JSON when hive_status feature is blocked", async () => {
    const harness = await runV2PluginSetup({ directory: testRoot });
    const execToolRef = (name: string, args: unknown, toolContext: ToolContext) =>
      execTool(harness, name, args, toolContext);
    const toolContext = createToolContext("sess_blocked_status");

    await execToolRef("hive_feature_create", 
      { name: "blocked-status-feature" },
      toolContext
    );

    const plan = `# Blocked Status Feature

## Discovery

**Q: Is this a test?**
A: Yes, this regression test validates that hive_status returns terminal JSON instead of plain text when a feature is blocked.

## Tasks

### 1. First Task
Do it
`;

    await execToolRef("hive_plan_write", 
      { content: plan, feature: "blocked-status-feature" },
      toolContext
    );

    await execToolRef("hive_context_write", 
      {
        feature: "blocked-status-feature",
        name: "BLOCKED",
        content: "Need approval from Beekeeper.",
      },
      toolContext
    );

    const blockedPath = path.join(
      testRoot,
      ".hive",
      "features",
      "blocked-status-feature",
      "BLOCKED"
    );
    const blockedContextPath = path.join(
      testRoot,
      ".hive",
      "features",
      "blocked-status-feature",
      "context",
      "BLOCKED.md"
    );
    fs.copyFileSync(blockedContextPath, blockedPath);

    const raw = await execToolRef("hive_status", 
      { feature: "blocked-status-feature" },
      toolContext
    );

    const result = JSON.parse(raw as string) as {
      success?: boolean;
      terminal?: boolean;
      blocked?: boolean;
      error?: string;
      hints?: string[];
    };

    expect(result.success).toBe(false);
    expect(result.terminal).toBe(true);
    expect(result.blocked).toBe(true);
    expect(result.error).toContain("BLOCKED by Beekeeper");
    expect(Array.isArray(result.hints)).toBe(true);
    expect(result.hints?.length).toBeGreaterThan(0);
  });

  it("returns structured terminal JSON when hive_status has no active feature", async () => {
    const harness = await runV2PluginSetup({ directory: testRoot });
    const execToolRef = (name: string, args: unknown, toolContext: ToolContext) =>
      execTool(harness, name, args, toolContext);
    const toolContext = createToolContext("sess_status_no_feature");

    const raw = await execToolRef("hive_status", {}, toolContext);

    const result = JSON.parse(raw as string) as {
      success?: boolean;
      terminal?: boolean;
      reason?: string;
      error?: string;
    };

    expect(result.success).toBe(false);
    expect(result.terminal).toBe(true);
    expect(result.reason).toBe("feature_required");
    expect(result.error).toContain("No feature specified");
  });

  it("returns structured terminal JSON when hive_status feature is missing", async () => {
    const harness = await runV2PluginSetup({ directory: testRoot });
    const execToolRef = (name: string, args: unknown, toolContext: ToolContext) =>
      execTool(harness, name, args, toolContext);
    const toolContext = createToolContext("sess_status_missing_feature");

    const raw = await execToolRef("hive_status", 
      { feature: "does-not-exist" },
      toolContext
    );

    const result = JSON.parse(raw as string) as {
      success?: boolean;
      terminal?: boolean;
      reason?: string;
      error?: string;
      availableFeatures?: unknown[];
    };

    expect(result.success).toBe(false);
    expect(result.terminal).toBe(true);
    expect(result.reason).toBe("feature_not_found");
    expect(result.error).toContain("Feature 'does-not-exist' not found");
    expect(Array.isArray(result.availableFeatures)).toBe(true);
  });

  it("returns explicit success and non-terminal contract fields on worktree start", async () => {
    const harness = await runV2PluginSetup({ directory: testRoot });
    const execToolRef = (name: string, args: unknown, toolContext: ToolContext) =>
      execTool(harness, name, args, toolContext);
    const toolContext = createToolContext("sess_success_contract");

    await execToolRef("hive_feature_create", 
      { name: "success-contract-feature" },
      toolContext
    );

    const plan = `# Success Contract Feature

## Discovery

**Q: Is this a test?**
A: Yes, this test validates that successful hive_worktree_start responses include explicit success and terminal contract fields for machine-readable orchestration.

## Tasks

### 1. First Task
Do it
`;

    await execToolRef("hive_plan_write", 
      { content: plan, feature: "success-contract-feature" },
      toolContext
    );
    await execToolRef("hive_plan_approve", 
      { feature: "success-contract-feature" },
      toolContext
    );
    await execToolRef("hive_tasks_sync", 
      { feature: "success-contract-feature" },
      toolContext
    );

    const raw = await execToolRef("hive_worktree_start", 
      { feature: "success-contract-feature", task: "01-first-task" },
      toolContext
    );

    const result = JSON.parse(raw as string) as {
      success?: boolean;
      terminal?: boolean;
      worktreePath?: string;
      taskToolCall?: { prompt?: string };
    };

    expect(result.success).toBe(true);
    expect(result.terminal).toBe(false);
    expect(result.worktreePath).toBeDefined();
    expect(result.taskToolCall?.prompt).toContain("worker-prompt.md");
  });

  it("system prompt hook injects Hive instructions", async () => {
    const configPath = path.join(process.env.HOME || "", ".config", "opencode", "agent_hive.json");
    fs.mkdirSync(path.dirname(configPath), { recursive: true });
    fs.writeFileSync(
      configPath,
      JSON.stringify({
        agents: {
          "zetta": {
            autoLoadSkills: ["brainstorming"],
          },
        },
        customAgents: {
          "forager-ui": {
            baseAgent: "forager-worker",
            description: "Use for UI-heavy implementation tasks.",
            autoLoadSkills: [],
          },
          "reviewer-security": {
            baseAgent: "hygienic-reviewer",
            description: "Use for security-focused review passes.",
            autoLoadSkills: [],
          },
        },
      }),
    );
    const harness = await runV2PluginSetup({ directory: testRoot });
    const execToolRef = (name: string, args: unknown, toolContext: ToolContext) =>
      execTool(harness, name, args, toolContext);

    await execToolRef("hive_feature_create", { name: "active" }, createToolContext("sess"));

    // system.transform should still inject HIVE_SYSTEM_PROMPT and status hint
    // Was V1 hooks["experimental.chat.system.transform"] → V2 session 'context' hook.
    const system: Array<{ type: "text"; text: string }> = [];
    const contextHook = harness.sessionHooks.get("context")?.[0];
    await contextHook?.({ agent: "zetta", system } as never);
    system.push({ type: "text", text: "## Base Agent Prompt" });

    const joined = system.map((part) => part.text).join("\n");
    expect(joined).toContain("## Hive — Active Session");
    expect(joined).not.toContain("Use hive_status to check feature state before starting work");
    expect(joined).not.toContain("Use hive_plan_read to see plan comments");

    // Auto-loaded skills/custom subagents land in the generated agent definition body
    const agentMd = (name: string) =>
      fs.readFileSync(path.join(harness.projectDir, ".opencode", "agents", `${name}.md`), "utf-8");
    const agentBody = (name: string) => agentMd(name).split("---").slice(2).join("---");

    // Skills are referenced via hive_skill("...") - on-demand loading
    expect(agentBody("zetta")).toContain(`\`hive_skill("brainstorming")\``);
    expect(agentBody("zetta")).toContain("Configured Custom Subagents");
    expect(agentBody("zetta")).toContain("`reviewer-security`");
    expect(agentBody("zetta")).toContain("default to built-in `hygienic-reviewer`");
    expect(agentBody("zetta")).toContain("Configured Custom Subagents` is a better match");
    expect(agentBody("zetta")).toContain(`subagent({ subagent_type: \"<chosen-reviewer>\"`);

    // All agents are registered as generated definitions in V2
    expect(agentMd("forager-worker")).toBeTruthy();
    expect(agentMd("hygienic-reviewer")).toBeTruthy();
    expect(agentMd("forager-ui")).toBeTruthy();
    expect(agentMd("reviewer-security")).toBeTruthy();

    // Verify status hint is in the context hook (this is still there)
    expect(joined).toContain("### Current Hive Status");
  });

  it("blocks hive_worktree_create when dependencies are not done", async () => {
    const harness = await runV2PluginSetup({ directory: testRoot });
    const execToolRef = (name: string, args: unknown, toolContext: ToolContext) =>
      execTool(harness, name, args, toolContext);
    const toolContext = createToolContext("sess_dependency_block");

    await execToolRef("hive_feature_create", 
      { name: "dep-block-feature" },
      toolContext
    );

    const plan = `# Dep Block Feature

## Discovery

**Q: Is this a test?**
A: Yes, this integration test validates dependency blocking. Testing that task 2 cannot start until task 1 completes, ensuring proper dependency enforcement.

## Overview

Test

## Tasks

### 1. First Task
Do it

### 2. Second Task

**Depends on**: 1

Do it later
`;

    await execToolRef("hive_plan_write", 
      { content: plan, feature: "dep-block-feature" },
      toolContext
    );
    await execToolRef("hive_plan_approve", 
      { feature: "dep-block-feature" },
      toolContext
    );
    await execToolRef("hive_tasks_sync", 
      { feature: "dep-block-feature" },
      toolContext
    );

    const execStartOutput = await execToolRef("hive_worktree_start", 
      { feature: "dep-block-feature", task: "02-second-task" },
      toolContext
    );

    const execStart = JSON.parse(execStartOutput as string) as {
      success?: boolean;
      terminal?: boolean;
      reason?: string;
      error?: string;
    };

    expect(execStart.success).toBe(false);
    expect(execStart.terminal).toBe(true);
    expect(execStart.reason).toBe("dependencies_not_done");
    expect(execStart.error).toContain("dependencies not done");
  });

  it("returns terminal JSON when blocked resume is retried from in_progress", async () => {
    const harness = await runV2PluginSetup({ directory: testRoot });
    const execToolRef = (name: string, args: unknown, toolContext: ToolContext) =>
      execTool(harness, name, args, toolContext);
    const toolContext = createToolContext("sess_invalid_blocked_retry");

    await execToolRef("hive_feature_create", 
      { name: "invalid-blocked-retry-feature" },
      toolContext
    );

    const plan = `# Invalid Blocked Retry Feature

## Discovery

**Q: Is this a test?**
A: Yes, this regression test validates that retrying continueFrom:'blocked' while a task is still in_progress returns terminal guidance instead of re-entering the blocked resume flow.

## Tasks

### 1. First Task
Do it
`;

    await execToolRef("hive_plan_write", 
      { content: plan, feature: "invalid-blocked-retry-feature" },
      toolContext
    );
    await execToolRef("hive_plan_approve", 
      { feature: "invalid-blocked-retry-feature" },
      toolContext
    );
    await execToolRef("hive_tasks_sync", 
      { feature: "invalid-blocked-retry-feature" },
      toolContext
    );

    await execToolRef("hive_worktree_start", 
      { feature: "invalid-blocked-retry-feature", task: "01-first-task" },
      toolContext
    );

    const statusRaw = await execToolRef("hive_status", 
      { feature: "invalid-blocked-retry-feature" },
      toolContext
    );
    const status = JSON.parse(statusRaw as string) as {
      tasks?: {
        list?: Array<{ folder: string; status: string }>;
      };
    };

    const taskStatus = status.tasks?.list?.find(
      (task) => task.folder === "01-first-task"
    );
    expect(taskStatus?.status).toBe("in_progress");

    const invalidRetryRaw = await execToolRef("hive_worktree_create", 
      {
        feature: "invalid-blocked-retry-feature",
        task: "01-first-task",
        continueFrom: "blocked",
        decision: "Retry with the same approach.",
      },
      toolContext
    );

    const invalidRetry = JSON.parse(invalidRetryRaw as string) as {
      success?: boolean;
      terminal?: boolean;
      currentStatus?: string;
      hints?: string[];
    };

    expect(invalidRetry.success).toBe(false);
    expect(invalidRetry.terminal).toBe(true);
    expect(invalidRetry.currentStatus).toBe("in_progress");
    expect(Array.isArray(invalidRetry.hints)).toBe(true);
    expect(invalidRetry.hints?.length).toBeGreaterThan(0);
    expect(invalidRetry.hints?.some((hint) => /start|resume/i.test(hint))).toBe(true);
    expect(invalidRetry.hints?.some((hint) => /hive_status|status/i.test(hint))).toBe(true);
  });

  it("starts a pending task with hive_worktree_start without continueFrom", async () => {
    const harness = await runV2PluginSetup({ directory: testRoot });
    const execToolRef = (name: string, args: unknown, toolContext: ToolContext) =>
      execTool(harness, name, args, toolContext);
    const toolContext = createToolContext("sess_pending_start");

    await execToolRef("hive_feature_create", 
      { name: "pending-start-feature" },
      toolContext
    );

    const plan = `# Pending Start Feature

## Discovery

**Q: Is this a test?**
A: Yes, this regression test validates that pending tasks can start via hive_worktree_start without a continueFrom flag.

## Tasks

### 1. First Task
Do it
`;

    await execToolRef("hive_plan_write", 
      { content: plan, feature: "pending-start-feature" },
      toolContext
    );
    await execToolRef("hive_plan_approve", 
      { feature: "pending-start-feature" },
      toolContext
    );
    await execToolRef("hive_tasks_sync", 
      { feature: "pending-start-feature" },
      toolContext
    );

    const raw = await execToolRef("hive_worktree_start", 
      { feature: "pending-start-feature", task: "01-first-task" },
      toolContext
    );

    const result = JSON.parse(raw as string) as {
      success?: boolean;
      terminal?: boolean;
      worktreePath?: string;
    };

    expect(result.success).toBe(true);
    expect(result.terminal).toBe(false);
    expect(result.worktreePath).toBeDefined();
  });

  it("returns terminal JSON with advisory note when verification evidence is missing", async () => {
    const harness = await runV2PluginSetup({ directory: testRoot });
    const execToolRef = (name: string, args: unknown, toolContext: ToolContext) =>
      execTool(harness, name, args, toolContext);
    const toolContext = createToolContext("sess_commit_gate");

    await execToolRef("hive_feature_create", 
      { name: "commit-gate-feature" },
      toolContext
    );

    const plan = `# Commit Gate Feature

## Discovery

**Q: Is this a test?**
A: Yes, this test validates non-terminal completion responses when verification evidence is missing from summary.

## Tasks

### 1. First Task
Do it
`;

    await execToolRef("hive_plan_write", 
      { content: plan, feature: "commit-gate-feature" },
      toolContext
    );
    await execToolRef("hive_plan_approve", 
      { feature: "commit-gate-feature" },
      toolContext
    );
    await execToolRef("hive_tasks_sync", 
      { feature: "commit-gate-feature" },
      toolContext
    );

    await execToolRef("hive_worktree_start", 
      { feature: "commit-gate-feature", task: "01-first-task" },
      toolContext
    );

    const commitRaw = await execToolRef("hive_worktree_commit", 
      {
        feature: "commit-gate-feature",
        task: "01-first-task",
        status: "completed",
        summary: "Implemented feature changes.",
      },
      toolContext
    );

    const commitResult = JSON.parse(commitRaw as string) as {
      ok: boolean;
      terminal: boolean;
      status: string;
      taskState?: string;
      verificationNote?: string;
      nextAction?: string;
    };

    expect(commitResult.ok).toBe(true);
    expect(commitResult.terminal).toBe(true);
    expect(commitResult.status).toBe("completed");
    expect(commitResult.taskState).toBe("done");
    expect(commitResult.verificationNote).toContain("No verification evidence in summary");
    expect(commitResult.nextAction).toContain("hive_merge");
  });

  it("returns terminal JSON response when commit completes", async () => {
    const harness = await runV2PluginSetup({ directory: testRoot });
    const execToolRef = (name: string, args: unknown, toolContext: ToolContext) =>
      execTool(harness, name, args, toolContext);
    const toolContext = createToolContext("sess_commit_success");

    await execToolRef("hive_feature_create", 
      { name: "commit-success-feature" },
      toolContext
    );

    const plan = `# Commit Success Feature

## Discovery

**Q: Is this a test?**
A: Yes, this test validates terminal completion responses when commit succeeds.

## Tasks

### 1. First Task
Do it
`;

    await execToolRef("hive_plan_write", 
      { content: plan, feature: "commit-success-feature" },
      toolContext
    );
    await execToolRef("hive_plan_approve", 
      { feature: "commit-success-feature" },
      toolContext
    );
    await execToolRef("hive_tasks_sync", 
      { feature: "commit-success-feature" },
      toolContext
    );

    const worktreeRaw = await execToolRef("hive_worktree_start", 
      { feature: "commit-success-feature", task: "01-first-task" },
      toolContext
    );
    const worktreeResult = JSON.parse(worktreeRaw as string) as {
      worktreePath?: string;
    };

    expect(worktreeResult.worktreePath).toBeDefined();
    const worktreePath = worktreeResult.worktreePath!;
    fs.writeFileSync(path.join(worktreePath, "task-note.txt"), "commit test\n");

    const commitRaw = await execToolRef("hive_worktree_commit", 
      {
        feature: "commit-success-feature",
        task: "01-first-task",
        status: "completed",
        summary: "Added task note file. Tests pass (bun test). Build succeeds (bun run build).",
      },
      toolContext
    );

    const commitResult = JSON.parse(commitRaw as string) as {
      ok: boolean;
      terminal: boolean;
      status: string;
      taskState?: string;
      commit?: { sha?: string };
      nextAction?: string;
    };

    expect(commitResult.ok).toBe(true);
    expect(commitResult.terminal).toBe(true);
    expect(commitResult.status).toBe("completed");
    expect(commitResult.taskState).toBe("done");
    expect(commitResult.commit?.sha).toBeDefined();
    expect(commitResult.nextAction).toContain("hive_merge");
  });

  it("auto-loads parallel exploration for planner agents by default", async () => {
    // Test unified mode agents
    const harness = await runV2PluginSetup({ directory: testRoot });
    const execToolRef = (name: string, args: unknown, toolContext: ToolContext) =>
      execTool(harness, name, args, toolContext);

    const onboardingSnippet = "# Onboarding Preferences";
    const parallelExplorationSkill = BUILTIN_SKILLS.find(
      (skill) => skill.name === "parallel-exploration",
    );
    expect(parallelExplorationSkill).toBeDefined();

    // V2: agent prompts are generated into .opencode/agents/*.md bodies
    const agentsDir = path.join(harness.projectDir, ".opencode", "agents");
    const agentBody = (id: string) =>
      fs.readFileSync(path.join(agentsDir, `${id}.md`), "utf-8").split("---").slice(2).join("---");

    // Skills are referenced via hive_skill("...") - on-demand loading
    // zetta should have parallel-exploration reference in prompt (unified mode)
    expect(agentBody("zetta")).toContain(`\`hive_skill("parallel-exploration")\``);
    expect(agentBody("zetta")).not.toContain(onboardingSnippet);

    // scout-researcher should NOT have parallel-exploration in prompt (unified mode)
    // (removed to prevent recursive delegation - scout cannot spawn scouts)
    expect(agentBody("scout-researcher")).not.toContain(`\`hive_skill("parallel-exploration")\``);
    expect(agentBody("scout-researcher")).not.toContain(onboardingSnippet);

    // forager-worker should NOT have parallel-exploration in prompt
    expect(agentBody("forager-worker")).not.toContain(`\`hive_skill("parallel-exploration")\``);
    expect(agentBody("forager-worker")).not.toContain(onboardingSnippet);
  });

  it("includes task prompt mode", async () => {

    const harness = await runV2PluginSetup({ directory: testRoot });
    const execToolRef = (name: string, args: unknown, toolContext: ToolContext) =>
      execTool(harness, name, args, toolContext);
    const toolContext = createToolContext("sess_task_prompt_mode");

    await execToolRef("hive_feature_create", 
      { name: "prompt-mode-feature" },
      toolContext
    );

    const plan = `# Prompt Mode Feature

## Discovery

**Q: Is this a test?**
A: Yes, this integration test validates task prompt mode functionality. Ensures worker-prompt.md files are correctly generated with mission context.

## Tasks

### 1. First Task
Do it
`;

    await execToolRef("hive_plan_write", 
      { content: plan, feature: "prompt-mode-feature" },
      toolContext
    );
    await execToolRef("hive_plan_approve", 
      { feature: "prompt-mode-feature" },
      toolContext
    );
    await execToolRef("hive_tasks_sync", 
      { feature: "prompt-mode-feature" },
      toolContext
    );

    const execStartOutput = await execToolRef("hive_worktree_start", 
      { feature: "prompt-mode-feature", task: "01-first-task" },
      toolContext
    );

    const execStart = JSON.parse(execStartOutput as string) as {
      taskPromptMode?: string;
    };

    expect(execStart.taskPromptMode).toBe("opencode-at-file");
  });
});
