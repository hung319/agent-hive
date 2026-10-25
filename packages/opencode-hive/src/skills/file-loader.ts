/**
 * File-based Skill Loader
 *
 * Resolves and loads skill files from OpenCode and Claude-compatible paths.
 * Implements strict skill ID validation and deterministic search order.
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { SkillLoadResult, SkillDefinition } from './types.js';

/**
 * Validate skill ID for safety.
 *
 * Rejects:
 * - Empty IDs
 * - IDs containing `/`, `\\`, `..`, or `.`
 *
 * @param skillId - The skill ID to validate
 * @returns Error message if invalid, undefined if valid
 */
function validateSkillId(skillId: string): string | undefined {
  if (!skillId || skillId.trim() === '') {
    return 'Skill ID cannot be empty';
  }

  // Reject path traversal characters and separators
  if (skillId.includes('/')) {
    return `Invalid skill ID "${skillId}": contains path traversal character "/"`;
  }
  if (skillId.includes('\\')) {
    return `Invalid skill ID "${skillId}": contains path traversal character "\\"`;
  }
  if (skillId.includes('..')) {
    return `Invalid skill ID "${skillId}": contains path traversal sequence ".."`;
  }
  if (skillId === '.' || skillId.includes('.')) {
    return `Invalid skill ID "${skillId}": contains path traversal character "."`;
  }

  return undefined;
}

/**
 * Strip quotes from a string value.
 */
function stripQuotes(value: string): string {
  const trimmed = value.trim();
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

/**
 * Read one frontmatter key, including YAML block scalars.
 *
 * `description: |` followed by indented lines is valid YAML. Reading only the
 * key's own line returned the literal string "|", so a user skill written that
 * way had no usable description. A description is a one-line summary, so block
 * content is folded into a single line here.
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

/**
 * Parse YAML frontmatter from skill file content.
 *
 * @param content - The file content
 * @returns Parsed frontmatter or null if invalid
 */
function parseFrontmatter(content: string): { name: string; description: string; body: string } | null {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) return null;

  const frontmatter = match[1];
  const body = match[2];

  const name = readFrontmatterKey(frontmatter, 'name');
  const description = readFrontmatterKey(frontmatter, 'description');

  if (!name || !description) return null;

  return { name, description, body };
}


/**
 * Get the search paths for a skill ID in priority order.
 *
 * Order (OpenCode-doc aligned):
 * 1. Project OpenCode: `<projectRoot>/.opencode/skills/<skillId>/SKILL.md`
 * 2. Global OpenCode: `~/.config/opencode/skills/<skillId>/SKILL.md`
 * 3. Project Claude-compatible: `<projectRoot>/.claude/skills/<skillId>/SKILL.md`
 * 4. Global Claude-compatible: `~/.claude/skills/<skillId>/SKILL.md`
 *
 * @param skillId - The skill ID
 * @param projectRoot - The project root directory
 * @param homeDir - The user's home directory
 * @returns Array of paths to search in priority order
 */
function getSearchPaths(skillId: string, projectRoot: string, homeDir: string): string[] {
  return [
    path.join(projectRoot, '.opencode', 'skills', skillId, 'SKILL.md'),
    path.join(homeDir, '.config', 'opencode', 'skills', skillId, 'SKILL.md'),
    path.join(projectRoot, '.claude', 'skills', skillId, 'SKILL.md'),
    path.join(homeDir, '.claude', 'skills', skillId, 'SKILL.md'),
  ];
}

/**
 * Try to read a file, returning null if it doesn't exist or can't be read.
 */
async function tryReadFile(filePath: string): Promise<string | null> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return content;
  } catch {
    return null;
  }
}

/**
 * Load a skill from file-based locations.
 *
 * Searches for skill files in the following order:
 * 1. Project OpenCode: `<projectRoot>/.opencode/skills/<skillId>/SKILL.md`
 * 2. Global OpenCode: `~/.config/opencode/skills/<skillId>/SKILL.md`
 * 3. Project Claude-compatible: `<projectRoot>/.claude/skills/<skillId>/SKILL.md`
 * 4. Global Claude-compatible: `~/.claude/skills/<skillId>/SKILL.md`
 *
 * @param skillId - The skill ID to load
 * @param projectRoot - The project root directory
 * @param homeDir - The user's home directory
 * @returns The skill load result
 */
export async function loadFileSkill(
  skillId: string,
  projectRoot: string,
  homeDir: string
): Promise<SkillLoadResult> {
  // Validate skill ID
  const validationError = validateSkillId(skillId);
  if (validationError) {
    return { found: false, error: validationError };
  }

  // Get search paths in priority order
  const searchPaths = getSearchPaths(skillId, projectRoot, homeDir);

  // Try each path in order
  for (const skillPath of searchPaths) {
    const content = await tryReadFile(skillPath);
    if (content === null) {
      continue;
    }

    // Parse frontmatter
    const parsed = parseFrontmatter(content);
    if (!parsed) {
      return {
        found: false,
        error: `Invalid frontmatter in skill file: ${skillPath}. Expected YAML frontmatter with "name" and "description" fields.`,
      };
    }

    // Validate name matches skill ID
    if (parsed.name !== skillId) {
      return {
        found: false,
        error: `Skill name mismatch in ${skillPath}: frontmatter name "${parsed.name}" does not match skill ID "${skillId}"`,
      };
    }

    // Build skill definition
    const skill: SkillDefinition = {
      name: parsed.name,
      description: parsed.description,
      template: parsed.body,
    };

    return {
      found: true,
      skill,
      source: skillPath,
    };
  }

  // Not found in any location
  return {
    found: false,
    error: `Skill "${skillId}" not found in any of the search paths`,
  };
}
