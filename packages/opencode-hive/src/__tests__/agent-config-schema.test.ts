import { describe, expect, it } from 'bun:test';
import * as fs from 'node:fs';
import * as path from 'node:path';

const schemaPath = path.resolve(import.meta.dir, '..', '..', 'schema', 'agent_hive.schema.json');
const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf-8')) as Record<string, any>;

const expectReservedNameToFail = (name: string): void => {
  const reservedNames = schema.properties?.customAgents?.propertyNames?.not?.enum;
  expect(Array.isArray(reservedNames)).toBe(true);
  expect(reservedNames).toContain(name);
};

describe('agent_hive schema customAgents contract', () => {
  it('defines customAgents map and custom agent schema', () => {
    expect(schema.properties.customAgents).toBeDefined();
    expect(schema.properties.customAgents.additionalProperties).toEqual({
      $ref: '#/$defs/customAgentConfig',
    });
    expect(schema.$defs.customAgentConfig.required).toEqual(['baseAgent', 'description']);
    expect(schema.$defs.customAgentConfig.properties).not.toHaveProperty('skills');
  });

  it('restricts custom baseAgent to supported base agents', () => {
    expect(schema.$defs.customAgentConfig.properties.baseAgent.enum).toEqual([
      'forager-worker',
      'hygienic-reviewer',
    ]);
  });

  it('reserves built-in and plugin-managed agent names', () => {
    expectReservedNameToFail('zetta');
    expectReservedNameToFail('architect-planner');
    expectReservedNameToFail('swarm-orchestrator');
    expectReservedNameToFail('scout-researcher');
    expectReservedNameToFail('forager-worker');
    expectReservedNameToFail('hygienic-reviewer');
    expectReservedNameToFail('architect');
    expectReservedNameToFail('swarm');
    expectReservedNameToFail('scout');
    expectReservedNameToFail('forager');
    expectReservedNameToFail('hygienic');
    expectReservedNameToFail('receiver');
    expectReservedNameToFail('build');
    expectReservedNameToFail('plan');
    expectReservedNameToFail('code');
  });
});

describe('agent_hive schema covers every HiveConfig key', () => {
  /**
   * The schema sets additionalProperties: false, so any config key the code
   * reads but the schema omits is flagged red by editors — a valid
   * agent_hive.json that VSCode/Zed refuses to accept. This test derives the
   * key list from the type definition so the two cannot drift again.
   */
  const typesPath = path.resolve(
    import.meta.dir, '..', '..', '..', 'hive-core', 'src', 'types.ts',
  );

  function hiveConfigKeys(): string[] {
    const source = fs.readFileSync(typesPath, 'utf-8');
    const body = source.match(/export interface HiveConfig\b[\s\S]*?\n\}/);
    expect(body).not.toBeNull();
    return [...body![0].matchAll(/^ {2}(\w+)\??:/gm)].map((m) => m[1]!);
  }

  it('declares every key read from HiveConfig', () => {
    const declared = new Set(Object.keys(schema.properties ?? {}));
    const missing = hiveConfigKeys().filter((key) => !declared.has(key));
    expect(missing).toEqual([]);
  });

  it('does not declare agentBooster: the package it configured is gone', () => {
    expect(schema.properties).not.toHaveProperty('agentBooster');
    expect(hiveConfigKeys()).not.toContain('agentBooster');
  });

  it('declares rtk and snip is not a config key', () => {
    expect(schema.properties.rtk).toBeDefined();
    // snip was replaced by RTK in 1.20.0; the old key must not come back.
    expect(hiveConfigKeys()).not.toContain('snip');
    expect(schema.properties).not.toHaveProperty('snip');
  });

  it('keeps nested schemas closed too', () => {
    for (const key of ['vectorMemory', 'hiddenJudge', 'userProfile', 'tokenTruncation', 'sessionSnapshot', 'rtk']) {
      expect(schema.properties[key]?.additionalProperties).toBe(false);
    }
  });
});

