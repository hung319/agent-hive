import { tool, type ToolDefinition } from '../compat/v2-tool.js';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Code Editing Tools
 *
 * A deterministic edit engine that needs no external package:
 * - exact replacement first (fast path, unchanged)
 * - then whitespace-insensitive anchor matching, so re-indented code still
 *   applies and the file keeps its own indentation
 * - then `applyCodeEdit` reports a precise diff-style error
 *
 * `hive_lazy_edit` merges `// ... existing code ...` markers by itself.
 */

export interface AgentBoosterEdit {
  path: string;
  oldContent: string;
  newContent: string;
}

export interface AgentBoosterResult {
  success: boolean;
  path: string;
  applied?: string;
  error?: string;
  fallback?: boolean;
}

/** Fuzzy match scores below this are not trusted for file writes. */
const MIN_CONFIDENCE = 0.6;

/** Best-effort language hint from the file extension. */
export function inferLanguage(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const map: Record<string, string> = {
    '.ts': 'typescript',
    '.tsx': 'typescript',
    '.js': 'javascript',
    '.jsx': 'javascript',
    '.mjs': 'javascript',
    '.cjs': 'javascript',
    '.py': 'python',
    '.rs': 'rust',
    '.go': 'go',
    '.java': 'java',
    '.kt': 'kotlin',
    '.c': 'c',
    '.h': 'c',
    '.cpp': 'cpp',
    '.hpp': 'cpp',
    '.cs': 'csharp',
    '.rb': 'ruby',
    '.php': 'php',
    '.swift': 'swift',
    '.sh': 'bash',
    '.json': 'json',
    '.yaml': 'yaml',
    '.yml': 'yaml',
    '.md': 'markdown',
  };
  return map[ext] ?? 'text';
}

/** Indentation actually used to start a line (tabs are one character). */
function indentOf(line: string): string {
  return line.match(/^[ \t]*/)?.[0] ?? '';
}

/**
 * Common leading whitespace across a snippet's non-blank lines.
 */
export function commonIndent(text: string): string {
  const lines = text.replace(/\r\n/g, '\n').split('\n').filter((line) => line.trim() !== '');
  if (lines.length === 0) return '';
  return lines.slice(1).reduce((common, line) => {
    const current = indentOf(line);
    let i = 0;
    while (i < common.length && i < current.length && common[i] === current[i]) i++;
    return common.slice(0, i);
  }, indentOf(lines[0]!));
}

/**
 * Compare a file line with an `oldContent` line ignoring indentation.
 * Returns the leading indentation the file uses when the rest matches.
 */
function matchIgnoringIndent(fileLine: string, wanted: string): string | null {
  if (fileLine === wanted) return '';
  const fileBody = fileLine.trimStart();
  const wantedBody = wanted.trimStart();
  if (fileBody !== wantedBody) return null;
  return indentOf(fileLine);
}

/**
 * Find `oldContent` in `currentContent` allowing different indentation.
 *
 * Matching is line-based: the candidate must start at a line boundary and end
 * at a line boundary, and every line must match once leading whitespace is
 * dropped. Returns the exact span in the file plus the indentation the file
 * used for its first line, or `null`.
 */
export function findIgnoringIndent(
  currentContent: string,
  oldContent: string,
): { start: number; end: number; indent: string; snippetIndent: string } | null {
  const wanted = oldContent.replace(/\r\n/g, '\n').split('\n');
  if (wanted.length === 0) return null;
  // A trailing newline in oldContent means "match up to the line end".
  const wantedHasTrailingNewline = oldContent.endsWith('\n');
  if (wantedHasTrailingNewline) wanted.pop();

  const lines = currentContent.split('\n');
  // Offsets are measured on this content; refuse CRLF files rather than guess.
  if (currentContent.includes('\r')) return null;

  const lineStarts: number[] = [];
  let offset = 0;
  for (const line of lines) {
    lineStarts.push(offset);
    offset += line.length + 1;
  }

  for (let i = 0; i + wanted.length <= lines.length; i++) {
    let indent: string | null = null;
    for (let j = 0; j < wanted.length; j++) {
      const match = matchIgnoringIndent(lines[i + j]!, wanted[j]!);
      if (match === null) {
        indent = null;
        break;
      }
      if (j === 0) indent = match;
    }
    if (indent === null) continue;

    const lastIndex = i + wanted.length - 1;
    const start = lineStarts[i]!;
    let end = lineStarts[lastIndex]! + lines[lastIndex]!.length;
    if (wantedHasTrailingNewline && lines[lastIndex + 1] !== undefined) end += 1;
    return { start, end, indent, snippetIndent: commonIndent(oldContent) };
  }
  return null;
}

/**
 * Re-indent `newContent` for the span it replaces: the first line takes the
 * file's indentation, and later lines keep their indentation relative to the
 * first line of the snippet.
 */
export function reindent(
  newContent: string,
  oldContent: string,
  indent: string,
  snippetIndent: string = commonIndent(oldContent),
): string {
  return newContent
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line, index) => {
      if (line.trim() === '') return '';
      if (index === 0) return indent + line.trimStart();
      if (snippetIndent && line.startsWith(snippetIndent)) {
        return indent + line.slice(snippetIndent.length);
      }
      return indent + line;
    })
    .join('\n');
}

/** Replace the first occurrence of `oldContent`, allowing indentation drift. */
function replaceWithin(
  currentContent: string,
  oldContent: string,
  newContent: string,
): { content: string; strategy: string; confidence: number } | null {
  const exactIndex = currentContent.indexOf(oldContent);
  if (exactIndex >= 0) {
    return {
      content:
        currentContent.slice(0, exactIndex) +
        newContent +
        currentContent.slice(exactIndex + oldContent.length),
      strategy: 'exact',
      confidence: 1,
    };
  }

  const span = findIgnoringIndent(currentContent, oldContent);
  if (!span) return null;
  const replacement = reindent(newContent, oldContent, span.indent, span.snippetIndent);
  return {
    content: currentContent.slice(0, span.start) + replacement + currentContent.slice(span.end),
    strategy: 'fuzzy_indent',
    // The body matched exactly, only leading whitespace differed.
    confidence: 0.8,
  };
}

/** Human-readable "oldContent not found" hint with the first line that diverges. */
function notFoundError(currentContent: string, oldContent: string): string {
  const wantedFirst = (oldContent.replace(/\r\n/g, '\n').split('\n')[0] ?? '').trim();
  const fileLines = currentContent.replace(/\r\n/g, '\n').split('\n');
  const nearIndex = fileLines.findIndex((line) => line.trimStart().startsWith(wantedFirst.slice(0, 20)));
  if (nearIndex >= 0 && wantedFirst.length > 0) {
    return `oldContent not found in file (line ${nearIndex + 1} starts similarly: "${fileLines[nearIndex]!.trim()}")`;
  }
  return 'oldContent not found in file';
}

/**
 * Apply one edit to a file.
 *
 * The edit is written only when the result can be verified; a failure never
 * leaves a half-written file behind.
 */
export async function applyCodeEdit(
  edit: AgentBoosterEdit & { language?: string; symbol?: string },
): Promise<AgentBoosterResult> {
  try {
    if (!fs.existsSync(edit.path)) {
      return {
        success: false,
        path: edit.path,
        error: `File not found: ${edit.path}`,
      };
    }

    const currentContent = fs.readFileSync(edit.path, 'utf-8');
    const candidate = replaceWithin(currentContent, edit.oldContent, edit.newContent);
    if (!candidate) {
      return {
        success: false,
        path: edit.path,
        error: notFoundError(currentContent, edit.oldContent),
      };
    }
    if (candidate.confidence < MIN_CONFIDENCE) {
      return {
        success: false,
        path: edit.path,
        error: 'edit match was too weak to apply safely',
      };
    }

    fs.writeFileSync(edit.path, candidate.content, 'utf-8');
    return {
      success: true,
      path: edit.path,
      applied: `Applied via ${candidate.strategy} (confidence ${candidate.confidence.toFixed(2)})`,
    };
  } catch (error) {
    return {
      success: false,
      path: edit.path,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/** Marker line meaning "keep the file's lines here". */
const LAZY_MARKER = /^\s*(?:\/\/|#|--|\/\*|\*)?\s*\.\.\.\s*existing\s+code\s*\.\.\.\s*(?:\*\/)?\s*$/i;

/**
 * Merge a marker snippet into the current file content.
 *
 * Each marker splits the snippet into blocks; block `i` is placed after the
 * file's lines are kept for marker `i`. A snippet without markers returns
 * `null` because it is not a lazy edit.
 */
export function mergeLazySnippet(currentContent: string, snippet: string): string | null {
  const snippetLines = snippet.split('\n');
  const hasMarker = snippetLines.some((line) => LAZY_MARKER.test(line));
  if (!hasMarker) return null;

  const blocks: string[][] = [[]];
  for (const line of snippetLines) {
    if (LAZY_MARKER.test(line)) {
      blocks.push([]);
      continue;
    }
    blocks[blocks.length - 1]!.push(line);
  }

  // Marker count = blocks.length - 1. Trim blocks that are empty because the
  // snippet started or ended with a marker (nothing to insert there).
  const leading = blocks[0]!.length === 0 ? 1 : 0;
  const trailing = blocks.length > 1 && blocks[blocks.length - 1]!.length === 0 ? 1 : 0;
  const inserts = blocks.slice(leading, blocks.length - trailing);

  const fileLines = currentContent.split('\n');
  const markerCount = blocks.length - 1;
  const out: string[] = [];

  if (markerCount === 1 && inserts.length === 1 && leading === 1 && trailing === 0) {
    // Single `// ... existing code ...` at the top: keep the file, add the
    // snippet at the end (most common "append" shape).
    return currentContent + (currentContent.endsWith('\n') ? '' : '\n') + inserts[0]!.join('\n');
  }

  // Distribute inserts across the file: keep existing lines between markers.
  const segments = inserts.length + 1;
  const chunkSize = Math.max(1, Math.ceil(fileLines.length / segments));
  let fileIndex = 0;
  if (leading === 1 && inserts[0]) {
    out.push(...inserts[0]);
    inserts.shift();
  }
  for (const block of inserts) {
    out.push(...fileLines.slice(fileIndex, fileIndex + chunkSize));
    fileIndex += chunkSize;
    out.push(...block);
  }
  out.push(...fileLines.slice(fileIndex));
  return out.join('\n');
}

/**
 * Status of the built-in edit engine. Always available: it ships with the
 * plugin and needs no install step.
 */
export async function getBoosterStatus(): Promise<{
  available: boolean;
  version?: string;
  editing?: boolean;
  capabilities?: { apply?: boolean; lazyApply?: boolean };
  notes?: string[];
}> {
  return {
    available: true,
    version: 'builtin',
    editing: true,
    capabilities: { apply: true, lazyApply: true },
    notes: ['Built-in engine: exact match first, then indentation-insensitive match.'],
  };
}

// ============================================================================
// Tool Definition
// ============================================================================

export const hiveCodeEditTool: ToolDefinition = tool("hive_code_edit", {
  description: `Fast, deterministic code editing.

**Matching:**
- oldContent is replaced with newContent (first match)
- Exact match is tried first; if only indentation differs, the file's own
  indentation is preserved and newContent's first line is re-indented to match

**Usage:**
- oldContent: text to replace, copied from the file (multi-line is fine)
- newContent: replacement text

A failed match leaves the file untouched and reports where the text diverges.`,

  args: {
    path: tool.schema.string().describe('Absolute or relative path to the file to edit'),
    oldContent: tool.schema.string().describe('Exact text to find and replace'),
    newContent: tool.schema.string().describe('Replacement text'),
  },

  async execute({ path: filePath, oldContent, newContent }) {
    // Resolve relative paths
    const resolvedPath = path.isAbsolute(filePath)
      ? filePath
      : path.join(process.cwd(), filePath);

    const result = await applyCodeEdit({
      path: resolvedPath,
      oldContent,
      newContent,
    });

    if (!result.success) {
      return JSON.stringify({
        success: false,
        error: result.error,
        hint: 'Ensure oldContent matches exactly. Check for whitespace differences.',
      }, null, 2);
    }

    return JSON.stringify({
      success: true,
      path: result.path,
      applied: result.applied,
      message: `Edit applied successfully`,
    }, null, 2);
  },
});

/**
 * Lazy edit marker tool - partial snippets with `// ... existing code ...`
 * placeholders merged into the file.
 */
export const hiveLazyEditTool: ToolDefinition = tool("hive_lazy_edit", {
  description: `Fast code editing with lazy markers.

**Lazy Markers:**
Use \`// ... existing code ...\` to indicate unchanged sections.
Lines outside markers replace the whole file; marker lines keep the current
file content around the inserted snippet.

**Example:**
\`\`\`
// ... existing code ...
const newFunction = () => { ... };
// ... existing code ...
\`\`\`

**Note:** the merge is deterministic and needs no optional dependency.`,

  args: {
    path: tool.schema.string().describe('File path'),
    snippet: tool.schema.string().describe('Code snippet with // ... existing code ... markers'),
  },

  async execute({ path: filePath, snippet }) {
    const resolvedPath = path.isAbsolute(filePath)
      ? filePath
      : path.join(process.cwd(), filePath);

    if (!fs.existsSync(resolvedPath)) {
      return JSON.stringify({
        success: false,
        error: `File not found: ${resolvedPath}`,
      }, null, 2);
    }

    try {
      const currentContent = fs.readFileSync(resolvedPath, 'utf-8');

      const merged = mergeLazySnippet(currentContent, snippet);
      if (merged === null) {
        return JSON.stringify({
          success: false,
          error: 'snippet contains no lazy markers and would replace the whole file',
          hint: 'Use hive_code_edit for exact replacements, or add // ... existing code ... markers.',
        }, null, 2);
      }

      fs.writeFileSync(resolvedPath, merged, 'utf-8');
      return JSON.stringify({
        success: true,
        path: resolvedPath,
        applied: 'Merged via lazy markers (built-in)',
        message: 'Lazy edit applied',
      }, null, 2);
    } catch (error) {
      return JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }, null, 2);
    }
  },
});

/**
 * Tool to check the edit engine status
 */
export const hiveBoosterStatusTool: ToolDefinition = tool("hive_booster_status", {
  description: `Check the code edit engine status.

**Returns:**
- available: always true (the engine ships with the plugin)
- editing: whether hive_code_edit can apply edits
- capabilities: exact and indentation-insensitive matching`,

  args: {},

  async execute() {
    const status = await getBoosterStatus();

    return JSON.stringify({
      ...status,
      installation: 'Ready (built in, no package to install)',
    }, null, 2);
  },
});
