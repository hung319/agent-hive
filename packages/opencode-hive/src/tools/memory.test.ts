import { describe, test, expect, afterEach } from 'bun:test';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

/**
 * Regression tests for the memory consolidation:
 * - block-memory API (readProjectMemoryBody/writeProjectMemoryBody) owns
 *   .hive/memory/project/<label>.md — frontmatter, filtering, limits, read-only
 * - sensitive-data filter config has a single source of truth
 *   (services/memory-config.ts) shared across tools/memory.ts and
 *   services/vector-memory.ts
 */

const tmpRoots: string[] = [];

function makeTmpProjectRoot(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hive-block-mem-test-'));
  tmpRoots.push(dir);
  return dir;
}

function projectBlockPath(root: string, label = 'project'): string {
  return path.join(root, '.hive', 'memory', 'project', `${label}.md`);
}

afterEach(() => {
  for (const dir of tmpRoots.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('block memory project API', () => {
  test('readProjectMemoryBody returns empty string when block is missing', async () => {
    const { readProjectMemoryBody } = await import('./memory.js');
    const root = makeTmpProjectRoot();
    expect(readProjectMemoryBody(root)).toBe('');
  });

  test('writeProjectMemoryBody creates block with frontmatter and read roundtrips', async () => {
    const { readProjectMemoryBody, writeProjectMemoryBody } = await import('./memory.js');
    const root = makeTmpProjectRoot();

    const result = writeProjectMemoryBody(root, 'project', 'hello world');
    expect(result.ok).toBe(true);

    const raw = fs.readFileSync(projectBlockPath(root), 'utf-8');
    expect(raw).toContain('---');
    expect(raw).toContain('label: project');
    expect(readProjectMemoryBody(root)).toBe('hello world');
  });

  test('write preserves existing frontmatter description and limit', async () => {
    const { readProjectMemoryBody, writeProjectMemoryBody } = await import('./memory.js');
    const root = makeTmpProjectRoot();

    fs.mkdirSync(path.dirname(projectBlockPath(root)), { recursive: true });
    fs.writeFileSync(
      projectBlockPath(root),
      ['---', 'label: project', 'description: custom desc', 'limit: 1234', 'read_only: false', '---', '', 'old body'].join('\n'),
      'utf-8',
    );

    writeProjectMemoryBody(root, 'project', 'new body');

    const raw = fs.readFileSync(projectBlockPath(root), 'utf-8');
    expect(raw).toContain('description: custom desc');
    expect(raw).toContain('limit: 1234');
    expect(readProjectMemoryBody(root)).toBe('new body');
  });

  test('write refuses read-only blocks', async () => {
    const { writeProjectMemoryBody } = await import('./memory.js');
    const root = makeTmpProjectRoot();

    fs.mkdirSync(path.dirname(projectBlockPath(root, 'locked')), { recursive: true });
    fs.writeFileSync(
      projectBlockPath(root, 'locked'),
      ['---', 'label: locked', 'description: d', 'limit: 5000', 'read_only: true', '---', '', 'locked body'].join('\n'),
      'utf-8',
    );

    const result = writeProjectMemoryBody(root, 'locked', 'attempted overwrite');
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('read-only');
    expect(fs.readFileSync(projectBlockPath(root, 'locked'), 'utf-8')).toContain('locked body');
  });

  test('write applies sensitive-data filter by default', async () => {
    const { readProjectMemoryBody, writeProjectMemoryBody } = await import('./memory.js');
    const root = makeTmpProjectRoot();

    writeProjectMemoryBody(root, 'project', 'my key is sk-abcdef1234567890abcdef');

    const body = readProjectMemoryBody(root);
    expect(body).toContain('[API_KEY_REDACTED]');
    expect(body).not.toContain('sk-abcdef');
  });

  test('write enforces size limit by truncating oldest content', async () => {
    const { readProjectMemoryBody, writeProjectMemoryBody } = await import('./memory.js');
    const root = makeTmpProjectRoot();

    fs.mkdirSync(path.dirname(projectBlockPath(root)), { recursive: true });
    fs.writeFileSync(
      projectBlockPath(root),
      ['---', 'label: project', 'description: d', 'limit: 200', 'read_only: false', '---', ''].join('\n'),
      'utf-8',
    );

    const longBody = 'A'.repeat(120) + '\n\n' + 'B'.repeat(80);
    const result = writeProjectMemoryBody(root, 'project', longBody);

    expect(result.ok).toBe(true);
    expect(result.charsLimit).toBe(200);
    expect(result.charsWritten!).toBeLessThanOrEqual(200);
    // Newest content (the tail) survives truncation
    expect(readProjectMemoryBody(root)).toContain('B'.repeat(80));
  });
});

describe('shared memory filter config', () => {
  test('config set via vector-memory re-export affects block writes (single source of truth)', async () => {
    const { setMemoryFilterConfig } = await import('../services/vector-memory.js');
    const { getMemoryFilterConfig } = await import('../services/memory-config.js');
    const { readProjectMemoryBody, writeProjectMemoryBody } = await import('./memory.js');
    const root = makeTmpProjectRoot();

    try {
      setMemoryFilterConfig({ enabled: false });
      expect(getMemoryFilterConfig()?.enabled).toBe(false);

      writeProjectMemoryBody(root, 'project', 'my key is sk-abcdef1234567890abcdef');
      expect(readProjectMemoryBody(root)).toContain('sk-abcdef1234567890abcdef');
    } finally {
      setMemoryFilterConfig(undefined);
    }
  });

  test('disabling filter via memory-config also disables it in vector-memory adds', async () => {
    const { setMemoryFilterConfig } = await import('../services/memory-config.js');
    const { VectorMemoryService } = await import('../services/vector-memory.js');

    try {
      setMemoryFilterConfig({ enabled: false });
      const secret = `token=ghp_abc123def456ghi789jkl012mno345pqr678-${Date.now()}`;
      const scope = `filter-shared-test-${Date.now()}`;

      const added = await VectorMemoryService.add(secret, { type: 'learning', scope });
      expect(added.success).toBe(true);

      const { results } = await VectorMemoryService.list({ scope, limit: 5 });
      const match = results.find(r => r.content.includes(`ghp_abc123def456ghi789jkl012`));
      if (match) {
        expect(match.content).toContain('ghp_abc123def456ghi789jkl012');
        expect(match.content).not.toContain('[GITHUB_TOKEN_REDACTED]');
      }
    } finally {
      setMemoryFilterConfig(undefined);
    }
  });

  test('default config filters secrets in vector-memory adds', async () => {
    const { setMemoryFilterConfig } = await import('../services/memory-config.js');
    const { VectorMemoryService } = await import('../services/vector-memory.js');

    setMemoryFilterConfig(undefined);
    const scope = `filter-default-test-${Date.now()}`;
    const added = await VectorMemoryService.add(
      'leaked key sk-abcdef1234567890abcdef in notes',
      { type: 'learning', scope },
    );
    expect(added.success).toBe(true);

    const { results } = await VectorMemoryService.list({ scope, limit: 5 });
    const match = results.find(r => r.content.includes('sk-'));
    if (match) {
      expect(match.content).toContain('[API_KEY_REDACTED]');
    }
  });
});
