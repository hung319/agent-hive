import { describe, it, expect } from 'bun:test';
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
});
