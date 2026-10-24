import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import * as fs from 'fs';
import * as path from 'path';
import { runV2PluginSetup, type V2Harness } from '../__tests__/v2-harness.js';

const TEST_ROOT_BASE = '/tmp/hive-custom-agent-docs-example-test';
const README_PATH = path.resolve(import.meta.dir, '..', '..', 'README.md');

const publishedExample = {
  agents: {
    'forager-worker': { variant: 'medium' },
    'hygienic-reviewer': { model: 'github-copilot/gpt-5.2-codex' },
  },
  customAgents: {
    'forager-ui': {
      baseAgent: 'forager-worker',
      description: 'Use for UI-heavy implementation tasks.',
      model: 'anthropic/claude-sonnet-4-20250514',
      temperature: 0.2,
      variant: 'high',
    },
    'reviewer-security': {
      baseAgent: 'hygienic-reviewer',
      description: 'Use for security-focused review passes.',
    },
  },
};

/**
 * V2 port: agents are generated into `<config>/agents/<id>.md` (global, inside
 * the harness's isolated HOME). Read the frontmatter fields (`model`,
 * `temperature`) and the body (= prompt).
 */
function agentMd(harness: V2Harness, id: string): string | undefined {
  const file = path.join(harness.homeDir, '.config', 'opencode', 'agents', `${id}.md`);
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf-8') : undefined;
}

function frontmatterField(md: string, key: string): string | undefined {
  const frontmatter = md.split('---')[1] ?? '';
  const m = frontmatter.match(new RegExp(`^\\s*${key}:\\s*(.*?)\\s*$`, 'm'));
  return m ? m[1] : undefined;
}

function agentBody(md: string): string {
  return md.split('---').slice(2).join('---');
}

describe('e2e: published custom-agent docs example (V2)', () => {
  let testRoot: string;
  let originalHome: string | undefined;
  let originalHiveDisable: string | undefined;

  beforeEach(() => {
    originalHome = process.env.HOME;
    originalHiveDisable = process.env.HIVE_DISABLE_AUTO_INSTALL;
    process.env.HIVE_DISABLE_AUTO_INSTALL = '1';
    testRoot = fs.mkdtempSync(path.join('/tmp', 'hive-custom-agent-'));
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

  it('keeps docs example in sync with runtime behavior', async () => {
    const configPath = path.join(testRoot, '.config', 'opencode', 'agent_hive.json');
    fs.mkdirSync(path.dirname(configPath), { recursive: true });
    fs.writeFileSync(configPath, JSON.stringify(publishedExample, null, 2));

    const harness = await runV2PluginSetup({ directory: testRoot });

    // Built-in agent overrides are honored: hygienic-reviewer's model override
    // lands in its generated definition.
    const hygienic = agentMd(harness, 'hygienic-reviewer')!;
    expect(hygienic).toBeTruthy();
    expect(frontmatterField(hygienic, 'model')).toBe('github-copilot/gpt-5.2-codex');

    // Custom subagents are registered as generated agent definitions.
    const foragerUi = agentMd(harness, 'forager-ui');
    const reviewerSecurity = agentMd(harness, 'reviewer-security');
    expect(foragerUi).toBeTruthy();
    expect(reviewerSecurity).toBeTruthy();

    // V2 model refs merge variant into `provider/model#variant`.
    expect(frontmatterField(foragerUi!, 'model')).toBe('anthropic/claude-sonnet-4-20250514#high');
    // OpenCode 2.1 no longer supports agent temperature, so it must not be
    // emitted (the field only produced "ignored unsupported agent fields").
    expect(frontmatterField(foragerUi!, 'temperature')).toBeUndefined();
    expect(frontmatterField(foragerUi!, 'description')).toBe(
      JSON.stringify('Use for UI-heavy implementation tasks.'),
    );

    // reviewer-security inherits the base agent's model; temperature is not emitted.
    expect(frontmatterField(reviewerSecurity!, 'model')).toBe('github-copilot/gpt-5.2-codex');
    expect(frontmatterField(reviewerSecurity!, 'temperature')).toBeUndefined();
    expect(frontmatterField(reviewerSecurity!, 'description')).toBe(
      JSON.stringify('Use for security-focused review passes.'),
    );

    const zettaPrompt = agentBody(agentMd(harness, 'zetta')!);
    expect(zettaPrompt).toContain('## Configured Custom Subagents');
    expect(zettaPrompt).toContain('`forager-ui`');
    expect(zettaPrompt).toContain('`reviewer-security`');

    const readmeContent = fs.readFileSync(README_PATH, 'utf-8');
    const sectionMatch = readmeContent.match(/### Custom Derived Subagents[\s\S]*?```json\n([\s\S]*?)\n```/);
    expect(sectionMatch).not.toBeNull();

    const docsJson = sectionMatch![1].trim();
    expect(docsJson).toBe(JSON.stringify(publishedExample, null, 2));
    expect(JSON.parse(docsJson)).toEqual(publishedExample);
  });
});
