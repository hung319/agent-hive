import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { runV2PluginSetup, type V2Harness } from "../__tests__/v2-harness.js";

const TEST_ROOT_BASE = "/tmp/hive-agent-mode-test";

/**
 * V2 port: the plugin no longer mutates an `opencodeConfig.agent` map through
 * a `hooks.config` hook — it writes `<config>/agents/<id>.md` definitions
 * (global, inside the harness's isolated HOME). These helpers rebuild the V1
 * view: presence from the md file, prompt from the md body, mode/variant/
 * model/temperature from the frontmatter.
 */
function agentEntry(harness: V2Harness, id: string): Record<string, unknown> | undefined {
  const file = path.join(harness.homeDir, ".config", "opencode", "agents", `${id}.md`);
  if (!fs.existsSync(file)) return undefined;
  const raw = fs.readFileSync(file, "utf-8");
  const frontmatter = raw.split("---")[1] ?? "";
  const field = (key: string): string | undefined => {
    const m = frontmatter.match(new RegExp(`^\\s*${key}:\\s*"?([^"\\n]*)"?,?\\s*$`, "m"));
    return m ? (m[1] === "" ? undefined : m[1]) : undefined;
  };
  return {
    mode: field("mode") === "subagent" ? "subagent" : undefined,
    prompt: raw.split("---").slice(2).join("---"),
    model: field("model"),
    variant: field("variant"),
    temperature: field("temperature") ? Number(field("temperature")) : undefined,
  };
};

describe("agentMode gating (V2 bootstrap)", () => {
  let testRoot: string;
  let originalHome: string | undefined;
  let originalHiveDisable: string | undefined;

  beforeEach(() => {
    originalHome = process.env.HOME;
    originalHiveDisable = process.env.HIVE_DISABLE_AUTO_INSTALL;
    process.env.HIVE_DISABLE_AUTO_INSTALL = "1";
    testRoot = fs.mkdtempSync(path.join(os.tmpdir(), "hive-agent-mode-"));
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

  it("registers hive, scout, forager, and hygienic in unified mode", async () => {
    const configPath = path.join(testRoot, ".config", "opencode", "agent_hive.json");
    fs.mkdirSync(path.dirname(configPath), { recursive: true });
    fs.writeFileSync(
      configPath,
      JSON.stringify({
        agentMode: "unified",
      }),
    );

    const harness = await runV2PluginSetup({ directory: testRoot });

    expect(agentEntry(harness, "zetta")).toBeDefined();
    expect(agentEntry(harness, "architect-planner")).toBeUndefined();
    expect(agentEntry(harness, "swarm-orchestrator")).toBeUndefined();
    expect(agentEntry(harness, "scout-researcher")).toBeDefined();
    expect(agentEntry(harness, "forager-worker")).toBeDefined();
    expect(agentEntry(harness, "hygienic-reviewer")).toBeDefined();
    expect(harness.agentDefaults).toContain("zetta");
  });

  it("registers dedicated agents in dedicated mode", async () => {
    const configPath = path.join(testRoot, ".config", "opencode", "agent_hive.json");
    fs.mkdirSync(path.dirname(configPath), { recursive: true });
    fs.writeFileSync(
      configPath,
      JSON.stringify({
        agentMode: "dedicated",
      }),
    );

    const harness = await runV2PluginSetup({ directory: testRoot });

    expect(agentEntry(harness, "zetta")).toBeDefined();
    expect(agentEntry(harness, "scout-researcher")).toBeDefined();
    expect(agentEntry(harness, "forager-worker")).toBeDefined();
    expect(agentEntry(harness, "hygienic-reviewer")).toBeDefined();
    expect(agentEntry(harness, "codebase-locator")).toBeDefined();
    expect(agentEntry(harness, "codebase-analyzer")).toBeDefined();
    expect(harness.agentDefaults).toContain("zetta");
  });

  it("injects custom-subagent appendix into dedicated-mode primary prompts and registers custom agents", async () => {
    const configPath = path.join(testRoot, ".config", "opencode", "agent_hive.json");
    fs.mkdirSync(path.dirname(configPath), { recursive: true });
    fs.writeFileSync(
      configPath,
      JSON.stringify({
        agentMode: "dedicated",
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

    expect(agentEntry(harness, "forager-ui")).toBeDefined();
    expect(agentEntry(harness, "reviewer-security")).toBeDefined();

    const zettaPrompt = agentEntry(harness, "zetta")!.prompt as string;
    expect(zettaPrompt).toContain("## Configured Custom Subagents");
    expect(zettaPrompt).toContain("forager-ui");
    expect(zettaPrompt).toContain("reviewer-security");
  });

  it("demotes built-in build/plan to subagents and registers zetta as primary default", async () => {
    const configPath = path.join(testRoot, ".config", "opencode", "agent_hive.json");
    fs.mkdirSync(path.dirname(configPath), { recursive: true });
    fs.writeFileSync(
      configPath,
      JSON.stringify({
        agentMode: "unified",
      }),
    );

    const harness = await runV2PluginSetup({ directory: testRoot });

    // V1 parity: `build` and `plan` are demoted so zetta is the only
    // user-facing primary agent. They are updated in the agent catalog, not
    // written as definition files.
    const agentFile = (id: string) =>
      fs.existsSync(path.join(harness.homeDir, ".config", "opencode", "agents", `${id}.md`));
    expect(agentFile("build")).toBe(false);
    expect(agentFile("plan")).toBe(false);

    const demoted = (id: string) => {
      const entries = harness.agentUpdates.filter(([agentId]) => agentId === id);
      expect(entries.length).toBe(1);
      const agent: Record<string, unknown> = { mode: "primary", hidden: false };
      entries[0]![1](agent);
      return agent;
    };
    expect(demoted("build").mode).toBe("subagent");
    expect(demoted("plan").mode).toBe("subagent");

    // OpenCode's hidden system agents must stay primary: demoting them makes
    // `opencode run` fail with AgentNotFoundError.
    for (const systemAgent of ["compaction", "title", "summary"]) {
      expect(harness.agentUpdates.some(([agentId]) => agentId === systemAgent)).toBe(false);
    }

    // zetta is the primary default (no mode field → primary)
    expect(agentEntry(harness, "zetta")).toBeDefined();
    expect(agentEntry(harness, "zetta")!.mode).toBeUndefined();
    expect(harness.agentDefaults).toContain("zetta");
  });
});
