import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';
import { filterSensitiveData } from '../utils/sensitive-data-filter.js';
import { safeStageAsync } from '../utils/safe-stage.js';
import { setMemoryFilterConfig, getMemoryFilterConfig } from './memory-config.js';

/**
 * Memory Service
 *
 * Stores project knowledge as sharded JSON files under
 * `~/.config/opencode/hive/vector-memory/fallback` and searches them with
 * text matching. No third-party memory package is involved.
 *
 * The layout and the `type: 'fallback'` status value are kept for
 * compatibility: memories written by earlier 2.x builds stay readable, and
 * `hive_vector_status` keeps the same shape.
 *
 * Features:
 * - **Sharding**: auto-rotate shards when max entries per shard is reached
 * - **Quality guards**: min content length, reject repeated chars
 * - **Deduplication**: exact hash-based dedup, optional near-duplicate detection
 */

export interface MemoryMetadata {
  type?: 'decision' | 'learning' | 'preference' | 'blocker' | 'context' | 'pattern';
  scope?: string;
  tags?: string[];
  source?: string;
}

export interface VectorMemoryEntry {
  id: string;
  content: string;
  /** Present only on entries written when a vector backend existed. */
  embedding?: number[];
  metadata: MemoryMetadata;
  createdAt: string;
  updatedAt: string;
}

export interface SearchResult {
  id: string;
  content: string;
  score: number;
  metadata: MemoryMetadata;
}

// ============================================================================
// Config defaults (can be overridden via setShardingConfig / setQualityConfig)
// ============================================================================

let shardingConfig = {
  maxEntriesPerShard: 500,
};

let qualityConfig = {
  minContentLength: 10,
  rejectRepeatedChars: true,
  enableDedup: true,
  enableNearDedup: false,
};

/**
 * Override sharding configuration at runtime.
 * Called from the plugin config hook with values from agent_hive.json.
 */
export function setShardingConfig(config: { maxEntriesPerShard?: number }): void {
  if (config.maxEntriesPerShard !== undefined && config.maxEntriesPerShard > 0) {
    shardingConfig.maxEntriesPerShard = config.maxEntriesPerShard;
  }
}

/**
 * Override quality configuration at runtime.
 * Called from the plugin config hook with values from agent_hive.json.
 */
export function setQualityConfig(config: {
  minContentLength?: number;
  rejectRepeatedChars?: boolean;
  enableDedup?: boolean;
  enableNearDedup?: boolean;
}): void {
  if (config.minContentLength !== undefined) qualityConfig.minContentLength = config.minContentLength;
  if (config.rejectRepeatedChars !== undefined) qualityConfig.rejectRepeatedChars = config.rejectRepeatedChars;
  if (config.enableDedup !== undefined) qualityConfig.enableDedup = config.enableDedup;
  if (config.enableNearDedup !== undefined) qualityConfig.enableNearDedup = config.enableNearDedup;
}

// Filter config is owned by memory-config.ts; setMemoryFilterConfig below is a compat re-export.

/**
 * Kept for API compatibility: there is no backend to initialize.
 */
export async function initMemory(_options?: {
  indexPath?: string;
  dimensions?: number;
}): Promise<void> {
  ensureFallbackDir();
}

/**
 * Add a memory entry to the store
 */
export async function addMemory(
  content: string,
  metadata: MemoryMetadata = {}
): Promise<{ id: string; success: boolean; fallback?: boolean; rejected?: boolean; reason?: string }> {
  // Apply sensitive data filter before saving (if configured)
  const filteredContent = filterSensitiveData(content, getMemoryFilterConfig());
  return addMemoryEntry(filteredContent, metadata);
}

/**
 * Search memories by text
 */
export async function searchMemories(
  query: string,
  options: {
    limit?: number;
    type?: string;
    scope?: string;
    minScore?: number;
  } = {}
): Promise<{ results: SearchResult[]; fallback?: boolean }> {
  const { limit = 10, type, scope } = options;
  return searchMemoriesWithin(query, { limit, type, scope });
}

/**
 * List recent memories by recency (no text query needed).
 * Used by auto-recall to inject relevant context into system prompt.
 */
export async function listMemories(
  options: {
    limit?: number;
    type?: string;
    scope?: string;
  } = {}
): Promise<{ results: SearchResult[]; fallback?: boolean }> {
  const { limit = 10, type, scope } = options;
  return listMemoriesRecent({ limit, type, scope });
}

/**
 * Get a memory entry by ID
 */
export async function getMemory(id: string): Promise<VectorMemoryEntry | null> {
  return getMemoryEntry(id);
}

/**
 * Delete a memory entry
 */
export async function deleteMemory(id: string): Promise<boolean> {
  return deleteMemoryEntry(id);
}

/**
 * Get memory status
 */
export async function getMemoryStatus(): Promise<{
  available: boolean;
  type: 'vector' | 'fallback';
  stats?: {
    total: number;
    byType?: Record<string, number>;
  };
  shard?: {
    index: number;
    entryCount: number;
    maxEntries: number;
  };
}> {
  ensureFallbackDir();
  try {
    const fallbackStats = getFallbackStats() as { total: number; byType?: Record<string, number> };
    const shardInfo = getActiveShardInfo();
    return {
      available: false,
      type: 'fallback',
      stats: fallbackStats,
      shard: shardInfo,
    };
  } catch (error) {
    // Never throw from status — a throw here would surface the wrapper's
    // generic error object and contradict persisted data.
    console.warn('[vector-memory] stats failed:', error instanceof Error ? error.message : error);
    return {
      available: false,
      type: 'fallback',
      stats: { total: 0 },
    };
  }
}

// ============================================================================
// Sharded storage (with Quality Guards + Dedup)
// ============================================================================

// ---------------------------------------------------------------------------
// Sharding helpers
// ---------------------------------------------------------------------------

/** Root fallback directory containing numbered shard sub-directories */
function getFallbackDir(): string {
  return path.join(os.homedir(), '.config', 'opencode', 'hive', 'vector-memory', 'fallback');
}

function ensureFallbackDir(): void {
  const dir = getFallbackDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/** Path to a specific shard directory */
function getShardDir(shardIndex: number): string {
  const padded = String(shardIndex).padStart(4, '0');
  return path.join(getFallbackDir(), `shard_${padded}`);
}

/** Ensure a specific shard directory exists */
function ensureShardDir(shardIndex: number): string {
  const dir = getShardDir(shardIndex);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/** Get all shard directory paths, sorted by index ascending */
function getAllShardDirs(): string[] {
  ensureFallbackDir();
  const entries = fs.readdirSync(getFallbackDir(), { withFileTypes: true });
  const dirs = entries
    .filter(e => e.isDirectory() && e.name.startsWith('shard_'))
    .map(e => path.join(getFallbackDir(), e.name))
    .sort();
  return dirs;
}

/** Migrate legacy files (directly in fallback dir) to shard_0001 */
function migrateLegacyFiles(): void {
  const root = getFallbackDir();
  ensureFallbackDir();

  const files = fs.readdirSync(root).filter(f => f.endsWith('.json'));
  if (files.length === 0) return;

  const targetDir = ensureShardDir(1);
  for (const file of files) {
    const src = path.join(root, file);
    const dst = path.join(targetDir, file);
    try {
      fs.renameSync(src, dst);
    } catch {
      // If rename fails (cross-device), copy + delete
      fs.copyFileSync(src, dst);
      fs.unlinkSync(src);
    }
  }
}

/** Find the active shard (latest one with room), rotate if needed */
function getActiveShard(): { index: number; path: string } {
  migrateLegacyFiles();

  const dirs = getAllShardDirs();

  // No shards yet → create shard_0001
  if (dirs.length === 0) {
    const idx = 1;
    return { index: idx, path: ensureShardDir(idx) };
  }

  // Check latest shard for room
  const lastDir = dirs[dirs.length - 1];
  const lastIndex = parseInt(path.basename(lastDir).replace('shard_', ''), 10);
  const count = fs.readdirSync(lastDir).filter(f => f.endsWith('.json')).length;

  if (count < shardingConfig.maxEntriesPerShard) {
    return { index: lastIndex, path: lastDir };
  }

  // Full → rotate to next shard
  const newIndex = lastIndex + 1;
  return { index: newIndex, path: ensureShardDir(newIndex) };
}

/** Read all .json files across all shards, newest-first */
function readAllShardFiles(): Array<{ filePath: string; mtime: Date }> {
  migrateLegacyFiles();
  const dirs = getAllShardDirs();
  if (dirs.length === 0) return [];

  const files: Array<{ filePath: string; mtime: Date }> = [];
  for (const dir of dirs) {
    const entries = fs.readdirSync(dir);
    for (const entry of entries) {
      if (!entry.endsWith('.json')) continue;
      const filePath = path.join(dir, entry);
      try {
        const stat = fs.statSync(filePath);
        files.push({ filePath, mtime: stat.mtime });
      } catch {
        // Skip inaccessible files
      }
    }
  }

  // Sort newest-first (for list) or leave as-is (for search)
  return files.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());
}

/** Find a file by its ID across all shards */
function findFileById(id: string): string | null {
  const dirs = getAllShardDirs();
  for (const dir of dirs) {
    const filePath = path.join(dir, `${id}.json`);
    if (fs.existsSync(filePath)) return filePath;
  }
  return null;
}

// ---------------------------------------------------------------------------
// ID generation
// ---------------------------------------------------------------------------

function generateId(): string {
  return `mem_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

// ---------------------------------------------------------------------------
// Quality guards + Dedup
// ---------------------------------------------------------------------------

function computeContentHash(content: string): string {
  return crypto.createHash('sha256').update(content, 'utf-8').digest('hex');
}

/** Check if content is low quality (too short, repeated chars, etc.) */
function isLowQualityContent(content: string): { valid: boolean; reason?: string } {
  if (qualityConfig.minContentLength > 0 && content.length < qualityConfig.minContentLength) {
    return { valid: false, reason: `content too short (${content.length} < ${qualityConfig.minContentLength} chars)` };
  }

  if (qualityConfig.rejectRepeatedChars) {
    // Check for single char repeated many times (e.g., "aaaaaa...")
    const repeatedPattern = /^(.)\1{9,}$/;
    if (repeatedPattern.test(content.trim())) {
      return { valid: false, reason: 'content is mostly repeated characters' };
    }
  }

  return { valid: true };
}

/** Check for exact (hash-based) or near duplicates across all shards */
function checkDuplicate(
  content: string,
  type?: string,
  scope?: string,
): { isDuplicate: boolean; existingId?: string; existingContent?: string } {
  const hash = computeContentHash(content);
  const dirs = getAllShardDirs();

  for (const dir of dirs) {
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
    for (const file of files) {
      try {
        const raw = fs.readFileSync(path.join(dir, file), 'utf-8');
        const entry: VectorMemoryEntry = JSON.parse(raw);

        // Exact dedup: compare hash within matching context (type + scope)
        // An entry is only a duplicate if it shares the SAME type AND scope.
        // This prevents false dedup across different contexts.
        if (qualityConfig.enableDedup) {
          if (entry.metadata.type === type && entry.metadata.scope === scope) {
            const entryHash = computeContentHash(entry.content);
            if (entryHash === hash) {
              return {
                isDuplicate: true,
                existingId: entry.id,
                existingContent: entry.content,
              };
            }
          }
        }

        // Near-duplicate: check if type and scope match + high content overlap
        if (qualityConfig.enableNearDedup) {
          if (type && entry.metadata.type === type && scope && entry.metadata.scope === scope) {
            // Simple overlap: check if one contains the other
            const a = content.toLowerCase();
            const b = entry.content.toLowerCase();
            if ((a.length > 20 && b.length > 20) && (a.includes(b) || b.includes(a))) {
              return {
                isDuplicate: true,
                existingId: entry.id,
                existingContent: entry.content,
              };
            }
          }
        }
      } catch {
        // Skip invalid entries
      }
    }
  }

  return { isDuplicate: false };
}

// ---------------------------------------------------------------------------
// CRUD operations (sharded)
// ---------------------------------------------------------------------------

async function addMemoryEntry(
  content: string,
  metadata: MemoryMetadata
): Promise<{ id: string; success: boolean; fallback: true; rejected?: boolean; reason?: string }> {
  // Quality guard: check content quality
  const qualityCheck = isLowQualityContent(content);
  if (!qualityCheck.valid) {
    return { id: '', success: false, fallback: true, rejected: true, reason: qualityCheck.reason };
  }

  // Dedup: check for existing duplicates
  const dupCheck = checkDuplicate(content, metadata.type, metadata.scope);
  if (dupCheck.isDuplicate) {
    return { id: dupCheck.existingId || '', success: true, fallback: true, rejected: true, reason: 'duplicate content' };
  }

  const activeShard = getActiveShard();
  const id = generateId();
  const entry: VectorMemoryEntry = {
    id,
    content,
    metadata,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const filePath = path.join(activeShard.path, `${id}.json`);
  fs.writeFileSync(filePath, JSON.stringify(entry, null, 2), 'utf-8');

  return { id, success: true, fallback: true };
}

async function searchMemoriesWithin(
  query: string,
  options: { limit?: number; type?: string; scope?: string }
): Promise<{ results: SearchResult[]; fallback: true }> {
  const { limit = 10, type, scope } = options;
  const queryLower = query.toLowerCase();
  const results: SearchResult[] = [];

  const files = readAllShardFiles();

  for (const { filePath } of files) {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const entry: VectorMemoryEntry = JSON.parse(content);

      // Filter by type and scope
      if (type && entry.metadata.type !== type) continue;
      if (scope && entry.metadata.scope !== scope) continue;

      // Simple text match scoring
      const contentLower = entry.content.toLowerCase();
      let score = 0;

      if (contentLower.includes(queryLower)) {
        score = queryLower.length / contentLower.length;
      }

      // Check metadata too
      if (entry.metadata.tags) {
        for (const tag of entry.metadata.tags) {
          if (tag.toLowerCase().includes(queryLower)) {
            score = Math.max(score, 0.8);
          }
        }
      }

      if (score > 0) {
        results.push({
          id: entry.id,
          content: entry.content,
          score,
          metadata: entry.metadata,
        });
      }
    } catch {
      // Skip invalid files
    }
  }

  // Sort by score descending
  results.sort((a, b) => b.score - a.score);

  return {
    results: results.slice(0, limit),
    fallback: true,
  };
}

async function listMemoriesRecent(
  options: { limit?: number; type?: string; scope?: string }
): Promise<{ results: SearchResult[]; fallback: true }> {
  const { limit = 10, type, scope } = options;
  const entries: SearchResult[] = [];

  const files = readAllShardFiles(); // already sorted newest-first

  for (const { filePath } of files) {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const entry: VectorMemoryEntry = JSON.parse(content);

      // Filter by type and scope
      if (type && entry.metadata.type !== type) continue;
      if (scope && entry.metadata.scope !== scope) continue;

      entries.push({
        id: entry.id,
        content: entry.content,
        score: 1.0,
        metadata: entry.metadata,
      });

      if (entries.length >= limit) break;
    } catch {
      // Skip invalid files
    }
  }

  return { results: entries, fallback: true };
}

async function getMemoryEntry(id: string): Promise<VectorMemoryEntry | null> {
  const filePath = findFileById(id);
  if (!filePath) return null;

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

async function deleteMemoryEntry(id: string): Promise<boolean> {
  const filePath = findFileById(id);
  if (!filePath) return false;

  try {
    fs.unlinkSync(filePath);
    return true;
  } catch {
    return false;
  }
}

function getFallbackStats(): { total: number; byType: Record<string, number> } {
  const stats = { total: 0, byType: {} as Record<string, number> };

  const files = readAllShardFiles();

  for (const { filePath } of files) {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const entry: VectorMemoryEntry = JSON.parse(content);

      stats.total++;

      const type = entry.metadata.type || 'unknown';
      stats.byType[type] = (stats.byType[type] || 0) + 1;
    } catch {
      // Skip invalid files
    }
  }

  return stats;
}

/** Get active shard info (for status reporting) */
function getActiveShardInfo(): { index: number; entryCount: number; maxEntries: number } {
  const active = getActiveShard();
  const count = fs.readdirSync(active.path).filter(f => f.endsWith('.json')).length;
  return {
    index: active.index,
    entryCount: count,
    maxEntries: shardingConfig.maxEntriesPerShard,
  };
}

// ============================================================================
// Service Export
// ============================================================================

export const VectorMemoryService = {
  init: (options?: { indexPath?: string; dimensions?: number }) =>
    safeStageAsync('memory.init', () => initMemory(options), undefined),
  add: (content: string, metadata: MemoryMetadata) =>
    safeStageAsync('memory.add', () => addMemory(content, metadata),
      { success: false, id: '', fallback: true, rejected: false } as Awaited<ReturnType<typeof addMemory>>),
  search: (query: string, options?: { limit?: number; type?: string; scope?: string; minScore?: number }) =>
    safeStageAsync('memory.search', () => searchMemories(query, options),
      { results: [], fallback: true } as Awaited<ReturnType<typeof searchMemories>>),
  list: (options?: { limit?: number; type?: string; scope?: string }) =>
    safeStageAsync('memory.list', () => listMemories(options),
      { results: [], fallback: true } as Awaited<ReturnType<typeof listMemories>>),
  get: (id: string) =>
    safeStageAsync('memory.get', () => getMemory(id), null as Awaited<ReturnType<typeof getMemory>>),
  delete: (id: string) =>
    safeStageAsync('memory.delete', () => deleteMemory(id), false as Awaited<ReturnType<typeof deleteMemory>>),
  status: () =>
    safeStageAsync('memory.status', () => getMemoryStatus(),
      { available: false, type: 'fallback' as const, stats: { total: 0 } }),
  setShardingConfig,
  setQualityConfig,
  setMemoryFilterConfig,
};

export default VectorMemoryService;

export { setMemoryFilterConfig, getMemoryFilterConfig };
