import { tool, type ToolDefinition } from '../compat/v2-tool.js';
import * as fs from 'fs';
import * as path from 'path';
import { getHiveNodeModulesPath, getGlobalNpmRoot, ensureToolInstalled } from '../utils/tool-installer.js';

/**
 * Agent Booster Tool
 * 
 * Ultra-fast code editing engine using @sparkleideas/agent-booster.
 * - 52x faster than Morph LLM
 * - FREE (no API key required)
 * - Rust+WASM powered
 * 
 * Uses lazy loading - only initializes when first called.
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

// Lazy-loaded booster instance
let boosterInstance: any = null;
let boosterInitPromise: Promise<void> | null = null;
// Raw module kept separate from boosterInstance, which may be .default-unwrapped.
// `apply` is resolved from here first: the module carries the named `apply`
// export and the `AgentBooster` class, while a class default export is a
// constructor and must never be invoked directly.
let boosterModule: any = null;
let loadedBoosterPath: string | null = null;

const BOOSTER_PACKAGE = '@sparkleideas/agent-booster';

/** Fuzzy booster output below this confidence is not trusted for file writes. */
const MIN_CONFIDENCE = 0.6;

/** A directory counts as a package if it carries an entry point require() can load. */
function isPackageDir(pkgDir: string): boolean {
  if (!fs.existsSync(pkgDir)) return false;
  if (fs.existsSync(path.join(pkgDir, 'package.json'))) return true;
  return (
    fs.existsSync(path.join(pkgDir, 'index.js')) ||
    fs.existsSync(path.join(pkgDir, 'index.cjs')) ||
    fs.existsSync(path.join(pkgDir, 'index.mjs'))
  );
}

/**
 * Resolve booster package path. Precedence: hive packages -> global npm root -> cwd -> require.resolve.
 *
 * The config root is read per call (not cached) because `tool-installer` computes
 * its dirs from HOME at module load: a daemon started with one HOME must not
 * keep serving that HOME's packages to a session started with another.
 */
function boosterPackageRoots(): string[] {
  const roots = new Set<string>([getHiveNodeModulesPath()]);
  const home = process.env.HOME || process.env.USERPROFILE;
  if (home) {
    roots.add(path.join(home, '.config', 'opencode', 'hive', 'packages', 'node_modules'));
  }
  const xdg = process.env.XDG_CONFIG_HOME;
  if (xdg) {
    roots.add(path.join(xdg, 'opencode', 'hive', 'packages', 'node_modules'));
  }
  return [...roots];
}

function resolveBoosterPackage(): string | null {
  const candidates = [...boosterPackageRoots(), getGlobalNpmRoot(), path.join(process.cwd(), 'node_modules')];
  for (const base of candidates) {
    if (!base) continue;
    const pkgDir = path.join(base, BOOSTER_PACKAGE);
    if (isPackageDir(pkgDir)) return pkgDir;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require.resolve(BOOSTER_PACKAGE);
  } catch {
    return null;
  }
}

/**
 * Initialize agent-booster with lazy loading
 */
async function initBooster(): Promise<void> {
  if (boosterInstance !== null) {
    return;
  }
  
  if (boosterInitPromise !== null) {
    await boosterInitPromise;
    return;
  }
  
  boosterInitPromise = (async () => {
    try {
      let booster: any;
      let pkgPath = resolveBoosterPackage();
      if (!pkgPath) {
        // First real use: let the installer fetch the package (no network at
        // plugin load), then re-resolve it from the hive packages directory.
        if (await ensureToolInstalled(BOOSTER_PACKAGE)) pkgPath = resolveBoosterPackage();
      }
      if (pkgPath) {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        booster = require(pkgPath);
        loadedBoosterPath = pkgPath;
      } else {
        // Last resort: dynamic ESM import (covers ESM-only builds require() cannot load)
        try {
          booster = await import(BOOSTER_PACKAGE);
          if (booster && typeof booster === 'object' && 'default' in booster) {
            booster = booster.default ?? booster;
          }
          loadedBoosterPath = null;
        } catch {
          throw new Error(`${BOOSTER_PACKAGE} not found (checked hive packages, global npm root, and local resolution)`);
        }
      }
      boosterModule = booster;
      
      // Initialize the booster
      if (booster && typeof booster.init === 'function') {
        await booster.init();
        boosterInstance = booster;
      } else if (booster && typeof booster.default === 'function') {
        boosterInstance = booster.default;
      } else {
        boosterInstance = booster || {};
      }
      
      console.log(`[agent-booster] Initialized successfully${loadedBoosterPath ? ` from ${loadedBoosterPath}` : ''}`);
    } catch (error) {
      console.warn('[agent-booster] Failed to initialize:', error instanceof Error ? error.message : error);
      boosterInstance = null;
      boosterModule = null;
      loadedBoosterPath = null;
      // Allow a later call to retry (e.g. after the package became available).
      boosterInitPromise = null;
    }
  })();
  
  await boosterInitPromise;
}

/**
 * Resolve the object that exposes `apply({ code, edit, language })`.
 *
 * Every published @sparkleideas/agent-booster version exports a class
 * (`AgentBooster`) and/or a named `apply` function; none ship the
 * `fastApply`/`lazyApply` helpers older Hive builds expected.
 *
 * The class must be instantiated with `new`: its `apply` is a prototype
 * method, so invoking the class as a plain function throws ("Cannot call a
 * class constructor AgentBooster without |new|") and silently disables edits.
 * A raw module object also inherits `Function.prototype.apply`, so module
 * exports are checked for an own `apply` only.
 */
export function resolveBoosterApi(
  moduleExports: any,
): { apply: (request: any) => Promise<any> } | null {
  const mod = moduleExports ?? {};
  const ownApply = Object.prototype.hasOwnProperty.call(mod, 'apply') ? mod.apply : undefined;
  if (typeof ownApply === 'function') {
    return { apply: (request) => ownApply.call(mod, request) };
  }
  const AgentBoosterClass =
    typeof mod.AgentBooster === 'function'
      ? mod.AgentBooster
      : typeof mod.default === 'function' && mod.default.prototype && typeof mod.default.prototype.apply === 'function'
        ? mod.default
        : null;
  if (AgentBoosterClass) {
    try {
      const instance = new AgentBoosterClass();
      return { apply: (request) => instance.apply(request) };
    } catch {
      return null;
    }
  }
  return null;
}

/** Best-effort language hint for agent-booster's language parameter. */
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

/**
 * Capture the current content of a symbol definition, used to seed `code`.
 * The captured snippet includes the opening `{ ... }` body so an edit inside
 * the symbol has real context for agent-booster's fuzzy matcher.
 */
function symbolSnippet(currentContent: string, symbol: string): string | null {
  if (!symbol) return null;
  const escaped = symbol.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const patterns = [
    new RegExp(`^[ \\t]*(?:export\\s+)?(?:default\\s+)?(?:async\\s+)?function\\s*\\*?\\s*${escaped}\\b`, 'm'),
    new RegExp(`^[ \\t]*(?:export\\s+)?(?:default\\s+)?(?:abstract\\s+)?class\\s+${escaped}\\b`, 'm'),
    new RegExp(`^[ \\t]*(?:export\\s+)?(?:const|let|var|type|interface|enum)\\s+${escaped}\\b`, 'm'),
  ];
  const lines = currentContent.split('\n');
  for (const pattern of patterns) {
    const match = pattern.exec(currentContent);
    if (!match || match.index === undefined) continue;
    const startLine = currentContent.slice(0, match.index).split('\n').length - 1;
    // Take the declaration line, then extend until braces balance.
    let depth = 0;
    let seenBrace = false;
    let endLine = startLine;
    for (let i = startLine; i < Math.min(lines.length, startLine + 80); i++) {
      const line = lines[i] ?? '';
      for (const ch of line) {
        if (ch === '{') {
          depth += 1;
          seenBrace = true;
        } else if (ch === '}') {
          depth -= 1;
        }
      }
      endLine = i;
      if (seenBrace && depth <= 0) break;
      if (!seenBrace && i === startLine && !line.trimEnd().endsWith('{')) break;
    }
    return lines.slice(startLine, endLine + 1).join('\n');
  }
  return null;
}

/**
 * Ask agent-booster for its opinion and return its full-file result.
 * Returns `null` when the module has no usable `apply`, the span cannot be
 * located, or the model is not confident enough.
 */
async function boosterCandidate(
  currentContent: string,
  edit: AgentBoosterEdit & { language?: string; symbol?: string },
): Promise<{ code: string; strategy: string; confidence: number } | null> {
  const api = resolveBoosterApi(boosterModule ?? boosterInstance);
  if (!api) return null;

  const spanStart = edit.oldContent ? currentContent.indexOf(edit.oldContent) : -1;
  const snippet = symbolSnippet(currentContent, edit.symbol ?? '')
    ?? (spanStart >= 0 ? edit.oldContent : null);
  if (snippet === null) return null;

  const currentSnippet = currentContent.includes(snippet) ? snippet : edit.oldContent;
  if (!currentSnippet.includes(edit.oldContent)) return null;
  const editedSnippet = currentSnippet.replace(edit.oldContent, edit.newContent);

  const result = await api.apply({
    code: currentSnippet,
    edit: editedSnippet,
    language: edit.language || inferLanguage(edit.path),
  });
  if (process.env.HIVE_BOOSTER_DEBUG) {
    console.log('[agent-booster][debug]', JSON.stringify({
      symbol: edit.symbol,
      snippet: currentSnippet,
      edited: editedSnippet,
      result: { success: result?.success, strategy: result?.strategy, confidence: result?.confidence, hasCode: typeof result?.code, hasOutput: typeof result?.output },
    }));
  }
  if (!result || result.success !== true) return null;

  const confidence = typeof result.confidence === 'number' ? result.confidence : 0;
  // Low-confidence fuzzy output is not trustworthy for a deterministic tool.
  if (confidence > 0 && confidence < MIN_CONFIDENCE) return null;

  const editedCode = typeof result.code === 'string'
    ? result.code
    : typeof result.output === 'string'
      ? result.output
      : editedSnippet;

  // Splice the model's output over exactly the span it was given. Trailing
  // newlines are normalised so the file's line structure is preserved.
  const spanStartIndex = currentContent.indexOf(currentSnippet);
  const normalized = editedCode.replace(/\n+$/, '');
  const replacement = currentSnippet.endsWith('\n') ? normalized + '\n' : normalized;

  return {
    code:
      currentContent.slice(0, spanStartIndex) +
      replacement +
      currentContent.slice(spanStartIndex + currentSnippet.length),
    strategy: String(result.strategy ?? 'apply'),
    confidence,
  };
}

/**
 * Apply edit using agent-booster.
 *
 * Agent Booster takes the code it should edit plus the intended result for a
 * small span. Hive keeps the exact-replace contract: `code` is the line(s)
 * holding `oldContent`, `edit` is the same span with `newContent` substituted.
 * The result is written only when it contains `newContent`; otherwise the
 * deterministic string replacement runs so behavior stays predictable.
 */
async function applyWithBooster(
  edit: AgentBoosterEdit & { language?: string; symbol?: string },
): Promise<AgentBoosterResult> {
  await initBooster();
  
  if (!boosterInstance) {
    return {
      success: false,
      path: edit.path,
      error: 'Agent booster not available',
      fallback: true,
    };
  }
  
  try {
    // Check if file exists
    if (!fs.existsSync(edit.path)) {
      return {
        success: false,
        path: edit.path,
        error: `File not found: ${edit.path}`,
      };
    }
    
    // Read current content
    const currentContent = fs.readFileSync(edit.path, 'utf-8');
    if (!currentContent.includes(edit.oldContent)) {
      return {
        success: false,
        path: edit.path,
        error: 'oldContent not found in file',
      };
    }

    // Use agent-booster's apply({ code, edit, language }) when available
    let candidate: Awaited<ReturnType<typeof boosterCandidate>> = null;
    try {
      candidate = await boosterCandidate(currentContent, edit);
    } catch (error) {
      // A booster failure must never fail the edit; the deterministic path
      // below still runs.
      if (process.env.HIVE_BOOSTER_DEBUG) {
        console.warn('[agent-booster] edit delegation failed:', error instanceof Error ? error.message : error);
      }
      candidate = null;
    }
    if (candidate && candidate.code.includes(edit.newContent)) {
      fs.writeFileSync(edit.path, candidate.code, 'utf-8');
      return {
        success: true,
        path: edit.path,
        applied: `Applied via agent-booster (${candidate.strategy}, confidence ${
          candidate.confidence > 0 ? candidate.confidence.toFixed(2) : 'n/a'
        })`,
      };
    }
    
    // Fallback: simple string replacement
    const newContent = currentContent.replace(edit.oldContent, edit.newContent);
    fs.writeFileSync(edit.path, newContent, 'utf-8');
    
    return {
      success: true,
      path: edit.path,
      applied: 'Applied via fallback (string replace)',
    };
  } catch (error) {
    return {
      success: false,
      path: edit.path,
      error: error instanceof Error ? error.message : String(error),
      fallback: true,
    };
  }
}

/**
 * Apply edit with fallback to native implementation
 */
export async function applyCodeEdit(
  edit: AgentBoosterEdit & { language?: string; symbol?: string },
): Promise<AgentBoosterResult> {
  // Try agent-booster first
  const boosterResult = await applyWithBooster(edit);
  
  if (boosterResult.success) {
    return boosterResult;
  }
  
  // Fallback: native string replace
  try {
    if (!fs.existsSync(edit.path)) {
      return {
        success: false,
        path: edit.path,
        error: `File not found: ${edit.path}`,
      };
    }
    
    const currentContent = fs.readFileSync(edit.path, 'utf-8');
    
    if (!currentContent.includes(edit.oldContent)) {
      return {
        success: false,
        path: edit.path,
        error: 'oldContent not found in file',
      };
    }
    
    const newContent = currentContent.replace(edit.oldContent, edit.newContent);
    fs.writeFileSync(edit.path, newContent, 'utf-8');
    
    return {
      success: true,
      path: edit.path,
      applied: 'Applied via native fallback',
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
 * Check if agent-booster is available
 */
export async function isBoosterAvailable(): Promise<boolean> {
  await initBooster();
  return boosterInstance !== null;
}

/** Whether hive_code_edit can delegate an edit to the loaded module. */
export async function isBoosterEditingAvailable(): Promise<boolean> {
  await initBooster();
  return resolveBoosterApi(boosterModule ?? boosterInstance) !== null;
}

/**
 * Get booster status
 */
export async function getBoosterStatus(): Promise<{
  available: boolean;
  version?: string;
  editing?: boolean;
  capabilities?: { apply?: boolean; lazyApply?: boolean };
  notes?: string[];
}> {
  const available = await isBoosterAvailable();
  
  if (!available) {
    return { available: false };
  }

  const capabilities = {
    apply: resolveBoosterApi(boosterModule ?? boosterInstance) !== null,
    lazyApply: typeof boosterModule?.lazyApply === 'function' || typeof boosterInstance?.lazyApply === 'function',
  };
  const notes: string[] = [];
  if (!capabilities.apply) {
    notes.push('Module loaded but exposes no apply({code, edit, language}); hive_code_edit uses exact string replacement.');
  }
  if (!capabilities.lazyApply) {
    notes.push('No lazyApply entry point; hive_lazy_edit merges markers with its built-in implementation.');
  }
  
  // Version from loaded module / package.json — a bare-name import fails for hive/global installs
  try {
    const raw = boosterModule ?? boosterInstance;
    if (typeof raw?.version === 'string' && raw.version.length > 0) {
      return { available: true, version: raw.version, editing: capabilities.apply, capabilities, notes };
    }
    const pkgJsonPath = loadedBoosterPath
      ? path.join(loadedBoosterPath, 'package.json')
      : require.resolve(`${BOOSTER_PACKAGE}/package.json`);
    const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8'));
    return { available: true, version: pkg.version || 'unknown', editing: capabilities.apply, capabilities, notes };
  } catch {
    return { available: true, editing: capabilities.apply, capabilities, notes };
  }
}

// ============================================================================
// Tool Definition
// ============================================================================

export const hiveCodeEditTool: ToolDefinition = tool("hive_code_edit", {
  description: `Ultra-fast code editing using agent-booster (52x faster than Morph, FREE).

**Features:**
- 52x faster than Morph LLM
- No API key required
- Rust+WASM powered
- Graceful fallback to native edit

**Usage:**
- oldContent: Exact text to replace (must match file content)
- newContent: Replacement text
- Automatically falls back to native edit if agent-booster unavailable`,

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
 *
 * No published @sparkleideas/agent-booster release ships a `lazyApply` entry
 * point, so the merge is implemented by Hive: every marker position keeps the
 * file's existing lines and the user-supplied lines are spliced in between.
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

**Note:** Booster availability only affects reporting; the merge itself is
deterministic and needs no optional dependency.`,

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

      // Newer booster builds may expose lazyApply; prefer it when present.
      const lazyApply = boosterModule?.lazyApply ?? boosterInstance?.lazyApply;
      if (typeof lazyApply === 'function') {
        const result = await lazyApply.call(boosterModule ?? boosterInstance, { path: resolvedPath, snippet });
        return JSON.stringify({
          success: result.success ?? true,
          path: resolvedPath,
          applied: 'agent-booster lazyApply',
          message: result.message || 'Lazy edit applied',
        }, null, 2);
      }

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
 * Tool to check agent-booster status
 */
export const hiveBoosterStatusTool: ToolDefinition = tool("hive_booster_status", {
  description: `Check agent-booster availability, capability and status.

**Returns:**
- available: Whether the module loaded
- editing: Whether hive_code_edit can actually delegate edits to it
- version: Agent-booster version (if available)
- speed: Performance comparison vs native editing`,

  args: {},

  async execute() {
    const status = await getBoosterStatus();

    return JSON.stringify({
      ...status,
      performance: {
        agentBooster: '52x faster than Morph',
        native: 'baseline',
        savings: '60-90% tokens on large files',
      },
      installation: status.available
        ? 'Ready'
        : 'Run: npm install @sparkleideas/agent-booster',
    }, null, 2);
  },
});
