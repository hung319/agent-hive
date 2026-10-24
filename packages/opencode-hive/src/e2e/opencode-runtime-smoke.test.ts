import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

function execSync(cmd: string, opts: { cwd: string }): void {
  const parts = cmd.match(/(?:[^\s"]+|"[^"]*")+/g) ?? [];
  const clean = parts.map(p => p.replace(/^"|"$/g, ''));
  const result = Bun.spawnSync(clean, { cwd: opts.cwd, stdout: "inherit", stderr: "inherit" });
  if (result.exitCode !== 0) throw new Error(`Command failed: ${cmd}`);
}
import {
  runV2PluginSetup,
  execTool,
  createV2ToolContext,
} from "../__tests__/v2-harness.js";
import { buildCompactionPrompt } from "../utils/compaction-prompt.js";

// Note: the real-runtime e2e suite (spawning an OpenCode server via the SDK)
// was removed — plugins are now verified against the real runtime manually
// (see docs/releases/v2.0.0.md) and the in-process V2 harness below covers
// the compaction-loop regressions without the legacy SDK dependency.

const TEST_ROOT_BASE_LOOP = "/tmp/hive-e2e-loop-mitigation";

describe("e2e: Forager compaction loop mitigation (in-process)", () => {
  let testRoot: string;
  let originalHome: string | undefined;
  let originalHiveDisable: string | undefined;

  beforeEach(() => {
    originalHome = process.env.HOME;
    originalHiveDisable = process.env.HIVE_DISABLE_AUTO_INSTALL;
    process.env.HIVE_DISABLE_AUTO_INSTALL = "1";
    testRoot = fs.mkdtempSync(path.join(os.tmpdir(), "hive-e2e-loop-"));
    process.env.HOME = testRoot;
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

  it("forager resumes after compaction without rediscovery prompt", async () => {
    const compactionPrompt = buildCompactionPrompt();
    expect(compactionPrompt).not.toMatch(/hive_status/);
    expect(compactionPrompt).toMatch(/worker-prompt\.md|task spec|spec file/i);
    expect(compactionPrompt).toMatch(/continue/i);
    expect(compactionPrompt).not.toMatch(/use hive_status to check feature state/i);
  });

  it("system transform does not reintroduce broad startup instruction after compaction", async () => {
    execSync("git init", { cwd: testRoot });
    execSync('git config user.email "test@example.com"', { cwd: testRoot });
    execSync('git config user.name "Test"', { cwd: testRoot });

    const harness = await runV2PluginSetup({ directory: testRoot });

    // Was V1 hooks["experimental.chat.system.transform"] → V2 session 'context'
    // hook (first registered); entries are { type: "text", text } chunks.
    const system: Array<{ type: "text"; text: string }> = [];
    await harness.sessionHooks.get("context")?.[0]?.({ agent: "forager-worker", system } as never);

    const joined = system.map((entry) => entry.text).join("\n");
    expect(joined).not.toMatch(/use hive_status to check feature state before starting work/i);
    expect(joined).not.toMatch(/use hive_plan_read to see plan comments/i);
  });

  it("compacted forager flow reaches commit-capable step without hive_status stall", async () => {
    execSync("git init", { cwd: testRoot });
    execSync('git config user.email "test@example.com"', { cwd: testRoot });
    execSync('git config user.name "Test"', { cwd: testRoot });
    fs.writeFileSync(path.join(testRoot, "README.md"), "test");
    execSync("git add README.md", { cwd: testRoot });
    execSync('git commit -m "init"', { cwd: testRoot });

    const harness = await runV2PluginSetup({ directory: testRoot });
    const toolContext = createV2ToolContext("sess_compaction_loop");

    await execTool(harness, "hive_feature_create", { name: "compaction-test-feature" }, toolContext);

    const plan = `# Compaction Test Feature

## Discovery

**Q: Is this a test?**
A: Yes, this is a regression test for the compaction loop mitigation. Validates that after a compaction event, the Forager worker can resume its task without calling hive_status or re-reading the codebase.

## Tasks

### 1. Compaction Task
Test compaction resume flow.
`;
    await execTool(harness, "hive_plan_write", { content: plan, feature: "compaction-test-feature" }, toolContext);
    await execTool(harness, "hive_plan_approve", { feature: "compaction-test-feature" }, toolContext);
    await execTool(harness, "hive_tasks_sync", { feature: "compaction-test-feature" }, toolContext);

    const worktreeRaw = await execTool(
      harness,
      "hive_worktree_start",
      { feature: "compaction-test-feature", task: "01-compaction-task" },
      toolContext,
    );
    const worktreeResult = JSON.parse(worktreeRaw as string) as { worktreePath?: string };
    expect(worktreeResult.worktreePath).toBeDefined();

    const worktreePath = worktreeResult.worktreePath!;
    fs.writeFileSync(path.join(worktreePath, "change.txt"), "compaction resume test\n");

    const commitRaw = await execTool(
      harness,
      "hive_worktree_commit",
      {
        feature: "compaction-test-feature",
        task: "01-compaction-task",
        status: "completed",
        summary: "Compaction resume test complete. Tests pass (bun test).",
      },
      toolContext,
    );
    const commitResult = JSON.parse(commitRaw as string) as { ok: boolean; terminal: boolean; status: string };

    expect(commitResult.ok).toBe(true);
    expect(commitResult.terminal).toBe(true);
    expect(commitResult.status).toBe("completed");
  });

  it("compaction hook output appended to session context does not contain hive_status", async () => {
    execSync("git init", { cwd: testRoot });
    execSync('git config user.email "test@example.com"', { cwd: testRoot });
    execSync('git config user.name "Test"', { cwd: testRoot });

    const harness = await runV2PluginSetup({ directory: testRoot });

    // Was V1 hooks["experimental.session.compacting"] → V2 session 'compaction'
    // hook; injected context entries are { type: "text", text } chunks.
    const compactionSystem: Array<{ type: "text"; text: string }> = [];
    await harness.sessionHooks.get("compaction")?.[0]?.({
      sessionID: "sess_compaction",
      system: compactionSystem,
      messages: [],
    } as never);

    const joined = compactionSystem.map((entry) => entry.text).join("\n");
    expect(joined).not.toMatch(/hive_status/);
    expect(joined).toMatch(/continue/i);
    expect(joined).toMatch(/worker-prompt\.md|task spec|spec file/i);
  });
});
