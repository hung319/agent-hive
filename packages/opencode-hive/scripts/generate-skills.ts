#!/usr/bin/env bun
/**
 * Generate skills registry from markdown files.
 * 
 * Reads skill markdown from:
 * - packages/opencode-hive/skills/[dir]/SKILL.md
 * 
 * Outputs: packages/opencode-hive/src/skills/registry.generated.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

interface SkillEntry {
  name: string;
  description: string;
  template: string;
}

/**
 * Strip surrounding quotes from a string value (handles YAML quoted strings).
 */
function stripQuotes(value: string): string {
  const trimmed = value.trim();
  // Handle both single and double quotes
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

/**
 * Read one frontmatter key, including YAML block scalars.
 *
 * `description: |` followed by indented lines is valid YAML, and reading the
 * key's own line alone yielded the literal string "|" — a skill whose
 * description never names its trigger, so it could never be selected. Block
 * scalars are folded here into one line because a description is a summary.
 */
function readFrontmatterKey(frontmatter: string, key: string): string | null {
  const lines = frontmatter.split(/\r?\n/);
  const start = lines.findIndex((line) => new RegExp(`^${key}:`).test(line));
  if (start === -1) return null;

  const firstValue = lines[start].slice(key.length + 1).trim();
  const blockMatch = firstValue.match(/^([|>])[+-]?$/);

  if (!blockMatch) return stripQuotes(firstValue);

  const collected: string[] = [];
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === '') {
      collected.push('');
      continue;
    }
    if (!/^\s/.test(line)) break;
    collected.push(line);
  }

  const nonEmpty = collected.filter((line) => line.trim() !== '');
  const indent = nonEmpty.length
    ? Math.min(...nonEmpty.map((line) => line.length - line.trimStart().length))
    : 0;

  const dedented = collected.map((line) => line.slice(indent));
  const joined = blockMatch[1] === '|' ? dedented.join('\n') : dedented.join(' ');
  return joined.trim().replace(/\s*\n\s*/g, ' ');
}

function parseFrontmatter(content: string): { name: string; description: string; body: string } | null {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) return null;

  const frontmatter = match[1];
  const body = match[2].trim();

  const name = readFrontmatterKey(frontmatter, 'name');
  const description = readFrontmatterKey(frontmatter, 'description');

  if (!name || !description) return null;

  return { name, description, body };
}


function discoverSkillFiles(rootDir: string): string[] {
  const files: string[] = [];

  // 1. opencode-hive/skills/**/SKILL.md
  const localSkillsDir = path.join(rootDir, 'packages/opencode-hive/skills');
  if (fs.existsSync(localSkillsDir)) {
    const entries = fs.readdirSync(localSkillsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const skillPath = path.join(localSkillsDir, entry.name, 'SKILL.md');
        if (fs.existsSync(skillPath)) {
          files.push(skillPath);
        }
      }
    }
  }

  return files;
}

function main() {
  // Find the monorepo root (go up from scripts/ to opencode-hive/ to packages/ to root/)
  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const rootDir = path.resolve(scriptDir, '../../..');

  console.log('[generate-skills] Root directory:', rootDir);

  const skillFiles = discoverSkillFiles(rootDir);
  console.log('[generate-skills] Found skill files:', skillFiles);

  const skills: SkillEntry[] = [];
  const seenNames = new Set<string>();

  for (const filePath of skillFiles) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const parsed = parseFrontmatter(content);

    if (!parsed) {
      console.warn(`[generate-skills] Warning: Could not parse frontmatter in ${filePath}`);
      continue;
    }

    if (seenNames.has(parsed.name)) {
      throw new Error(`[generate-skills] Duplicate skill name "${parsed.name}" found in ${filePath}`);
    }

    seenNames.add(parsed.name);
    skills.push({
      name: parsed.name,
      description: parsed.description,
      template: parsed.body,
    });

    console.log(`[generate-skills] Parsed skill: ${parsed.name}`);
  }

  // Sort by name for consistent output
  skills.sort((a, b) => a.name.localeCompare(b.name));

  // Generate the registry file
  const outputPath = path.join(rootDir, 'packages/opencode-hive/src/skills/registry.generated.ts');

  const namesList = skills.map(s => JSON.stringify(s.name)).join(', ');

  const skillsArray = skills.map(s => {
    return `  {
    name: ${JSON.stringify(s.name)},
    description: ${JSON.stringify(s.description)},
    template: ${JSON.stringify(s.template)},
  }`;
  }).join(',\n');

  const output = `/**
 * AUTO-GENERATED FILE - DO NOT EDIT
 * Generated by: scripts/generate-skills.ts
 * Run: bun run scripts/generate-skills.ts
 */

import type { SkillDefinition } from './types.js';

/**
 * List of builtin skill names.
 */
export const BUILTIN_SKILL_NAMES = [${namesList}] as const;

/**
 * All builtin skill definitions.
 */
export const BUILTIN_SKILLS: SkillDefinition[] = [
${skillsArray}
];
`;

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, output, 'utf-8');
  console.log(`[generate-skills] Generated: ${outputPath}`);
  console.log(`[generate-skills] Total skills: ${skills.length}`);
}

main();
