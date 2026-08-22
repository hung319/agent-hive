/**
 * Memory Filter Config — single source of truth.
 *
 * The sensitive-data filter (`utils/sensitive-data-filter.ts`) is applied to
 * every memory write path: block memory, typed memory, journal, vector memory,
 * and auto-capture. Its runtime configuration used to be duplicated as
 * module-level state in both `tools/memory.ts` (block/typed/journal) and
 * `services/vector-memory.ts`, each with its own setter — two sources of truth
 * wired separately from the plugin config hook.
 *
 * This module owns that state once. Import `setMemoryFilterConfig` /
 * `getMemoryFilterConfig` from here; do not re-create local copies.
 *
 * Wired from the plugin config hook: agent_hive.json → vectorMemory.memoryFilter.
 */

import type { MemoryFilterConfig } from '../utils/sensitive-data-filter.js';

let memoryFilterConfig: MemoryFilterConfig | undefined;

/**
 * Override memory filter configuration at runtime.
 * Call with `undefined` to reset to defaults (filter enabled, no custom patterns).
 */
export function setMemoryFilterConfig(config: MemoryFilterConfig | undefined): void {
  memoryFilterConfig = config;
}

/** Current filter config, or undefined when running on defaults. */
export function getMemoryFilterConfig(): MemoryFilterConfig | undefined {
  return memoryFilterConfig;
}
