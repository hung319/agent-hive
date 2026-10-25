import { describe, it, expect } from 'bun:test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { BUILTIN_SKILLS } from './registry.generated.js';

describe('skill content', () => {
  it('documents task() fan-out paths for parallel-exploration', () => {
    const skill = BUILTIN_SKILLS.find((entry) => entry.name === 'parallel-exploration');

    expect(skill).toBeDefined();
    expect(skill!.template).toContain('task({');
    expect(skill!.template).toContain(
      'Parallelize by issuing multiple task() calls in the same assistant message.'
    );
  });

  it('includes task() parallel guidance for dispatching-parallel-agents', () => {
    const skill = BUILTIN_SKILLS.find((entry) => entry.name === 'dispatching-parallel-agents');

    expect(skill).toBeDefined();
    expect(skill!.template).toContain('task({');
    expect(skill!.template).toContain(
      'Parallelize by issuing multiple task() calls in the same assistant message.'
    );
  });

  it('maps every intent in using-hive to a skill that exists', () => {
    const skill = BUILTIN_SKILLS.find((entry) => entry.name === 'using-hive');
    expect(skill).toBeDefined();

    const catalog = [
      'brainstorming', 'ask-questions-if-underspecified', 'writing-plans',
      'executing-plans', 'systematic-debugging', 'test-driven-development',
      'dispatching-parallel-agents', 'parallel-exploration', 'code-reviewer',
      'receiving-code-review', 'verification-before-completion',
      'finishing-a-development-branch', 'docker-mastery', 'agents-md-mastery',
      'skill-creator', 'caveman',
    ];

    // A map that names a skill the registry does not have sends the agent to
    // a failed hive_skill() call, which reads as "no guidance exists".
    const known = new Set(BUILTIN_SKILLS.map((entry) => entry.name));
    const mapped = catalog.filter((name) => skill!.template.includes(`\`${name}\``));

    expect(mapped.sort()).toEqual([...catalog].sort());
    expect(catalog.filter((name) => !known.has(name))).toEqual([]);
  });

  it('records where progress lives, so compaction cannot lose it', () => {
    const skill = BUILTIN_SKILLS.find((entry) => entry.name === 'executing-plans');
    expect(skill).toBeDefined();
    expect(skill!.template).toContain('.hive/features/<feature>/progress.md');
    expect(skill!.template).toContain('Record the base commit before dispatching');
  });

  it('bounds the review fix loop and forbids pre-judging in code-reviewer', () => {
    const skill = BUILTIN_SKILLS.find((entry) => entry.name === 'code-reviewer');
    expect(skill).toBeDefined();
    expect(skill!.template).toContain('Five rounds maximum');
    expect(skill!.template).toContain('Do Not Pre-Judge');
  });

  it('requires verification before the integration menu in finishing-a-development-branch', () => {
    const skill = BUILTIN_SKILLS.find((entry) => entry.name === 'finishing-a-development-branch');
    expect(skill).toBeDefined();
    expect(skill!.template).toContain('The menu comes after a\ngreen suite');
  });

  it('gives every builtin skill a description that names its trigger', () => {
    // The description is what an agent sees in available_skills; the body is
    // invisible until it loads. A description that does not start with a
    // trigger sentence, or that is a raw YAML marker, is a skill that cannot
    // be selected. `ponytail` shipped with the description "|" exactly this way.
    const bad = BUILTIN_SKILLS.filter(
      (skill) => skill.description.trim().length < 20 || !/^Use (when|before|after|during)\b/.test(skill.description),
    ).map((skill) => `${skill.name}: ${JSON.stringify(skill.description.slice(0, 40))}`);

    expect(bad).toEqual([]);
  });

  it('never lets an agent prompt name a skill that does not exist', () => {
    // A prompt sending the agent to hive_skill("x") for a missing x produces a
    // failed tool call, which reads to the agent as "no guidance exists".
    const known = new Set(BUILTIN_SKILLS.map((entry) => entry.name));
    const promptsDir = path.resolve(import.meta.dir, '..', '..', 'src', 'agents');
    const referenced: Array<{ file: string; name: string }> = [];

    for (const file of fs.readdirSync(promptsDir)) {
      if (!file.endsWith('.ts') || file.endsWith('.test.ts')) continue;
      const source = fs.readFileSync(path.join(promptsDir, file), 'utf-8');
      for (const match of source.matchAll(/hive_skill\(\\?"([a-z0-9-]+)\\?"\)/g)) {
        referenced.push({ file, name: match[1]! });
      }
    }

    const missing = referenced
      .filter((entry) => !known.has(entry.name))
      .map((entry) => `${entry.file} -> ${entry.name}`);

    expect(referenced.length).toBeGreaterThan(10);
    expect(missing).toEqual([]);
  });
});
