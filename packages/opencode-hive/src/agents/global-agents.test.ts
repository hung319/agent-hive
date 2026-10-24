import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { runV2PluginSetup, disposeHarness, type V2Harness } from '../__tests__/v2-harness';

/**
 * Agent definitions are installed once per machine in the global config dir
 * (V1 parity) instead of inside each project. Earlier 2.x builds wrote them to
 * `<project>/.opencode/agents/`, which pollutes every repository; setup must
 * migrate that layout away without touching user-authored agents.
 */
describe('global agent installation (V2 bootstrap)', () => {
  let testRoot: string;
  let previousHome: string | undefined;
  let previousDisable: string | undefined;
  let harness: V2Harness | undefined;

  beforeEach(() => {
    previousHome = process.env.HOME;
    previousDisable = process.env.HIVE_DISABLE_AUTO_INSTALL;
    process.env.HIVE_DISABLE_AUTO_INSTALL = '1';
    testRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'hive-global-agents-'));
    process.env.HOME = testRoot;
  });

  afterEach(() => {
    if (harness) disposeHarness(harness);
    harness = undefined;
    if (previousHome === undefined) delete process.env.HOME;
    else process.env.HOME = previousHome;
    if (previousDisable === undefined) delete process.env.HIVE_DISABLE_AUTO_INSTALL;
    else process.env.HIVE_DISABLE_AUTO_INSTALL = previousDisable;
    fs.rmSync(testRoot, { recursive: true, force: true });
  });

  test('writes definitions to the global config dir, not the project', async () => {
    harness = await runV2PluginSetup({ directory: path.join(testRoot, 'project') });

    const globalDir = path.join(testRoot, '.config', 'opencode', 'agents');
    expect(fs.existsSync(path.join(globalDir, 'zetta.md'))).toBe(true);
    expect(fs.existsSync(path.join(globalDir, 'forager-worker.md'))).toBe(true);
    expect(fs.existsSync(path.join(harness.projectDir, '.opencode', 'agents'))).toBe(false);
  });

  test('reuses one global install across projects', async () => {
    harness = await runV2PluginSetup({ directory: path.join(testRoot, 'project-a') });
    const globalZetta = path.join(testRoot, '.config', 'opencode', 'agents', 'zetta.md');
    expect(fs.existsSync(globalZetta)).toBe(true);

    disposeHarness(harness);
    harness = await runV2PluginSetup({ directory: path.join(testRoot, 'project-b') });

    expect(fs.existsSync(globalZetta)).toBe(true);
    expect(fs.existsSync(path.join(harness.projectDir, '.opencode'))).toBe(false);
  });

  test('removes project-local copies left by earlier 2.x builds', async () => {
    const projectDir = path.join(testRoot, 'legacy-project');
    const legacyDir = path.join(projectDir, '.opencode', 'agents');
    fs.mkdirSync(legacyDir, { recursive: true });
    fs.writeFileSync(path.join(legacyDir, 'zetta.md'), '---\nmode: primary\n---\nold\n');
    fs.writeFileSync(path.join(legacyDir, 'forager-worker.md'), '---\nmode: subagent\n---\nold\n');
    fs.writeFileSync(path.join(legacyDir, 'my-own-agent.md'), '---\nmode: subagent\n---\nmine\n');

    harness = await runV2PluginSetup({ directory: projectDir });

    expect(fs.existsSync(path.join(legacyDir, 'zetta.md'))).toBe(false);
    expect(fs.existsSync(path.join(legacyDir, 'forager-worker.md'))).toBe(false);
    // User-authored agents in the same directory are preserved.
    expect(fs.existsSync(path.join(legacyDir, 'my-own-agent.md'))).toBe(true);
    expect(fs.existsSync(path.join(testRoot, '.config', 'opencode', 'agents', 'zetta.md'))).toBe(true);
  });

  test('prunes an emptied legacy agents directory', async () => {
    const projectDir = path.join(testRoot, 'legacy-empty-project');
    const legacyDir = path.join(projectDir, '.opencode', 'agents');
    fs.mkdirSync(legacyDir, { recursive: true });
    fs.writeFileSync(path.join(legacyDir, 'zetta.md'), '---\nmode: primary\n---\nold\n');

    harness = await runV2PluginSetup({ directory: projectDir });

    expect(fs.existsSync(legacyDir)).toBe(false);
    // Only the emptied `agents` folder goes away, `.opencode` stays for config.
    expect(fs.existsSync(path.join(projectDir, '.opencode'))).toBe(true);
  });

  test('emits one permission rule per V2 action (no aliased duplicates)', async () => {
    harness = await runV2PluginSetup({ directory: path.join(testRoot, 'perm-project') });

    const zetta = fs.readFileSync(
      path.join(testRoot, '.config', 'opencode', 'agents', 'zetta.md'),
      'utf-8',
    );
    const rules = zetta
      .split('\n')
      .filter((line) => line.trim().startsWith('- { action:'));
    const keys = rules.map((line) => line.trim());
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys.some((line) => line.includes('"edit"'))).toBe(true);
    expect(keys.some((line) => line.includes('"subagent"'))).toBe(true);
    expect(keys.some((line) => line.includes('"shell"'))).toBe(true);
    // V1 alias names must not leak into V2 frontmatter.
    expect(keys.some((line) => /"(write|bash|task|delegate)"/.test(line))).toBe(false);
  });
});
