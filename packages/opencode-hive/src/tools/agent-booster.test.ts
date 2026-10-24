import { describe, test, expect, beforeEach } from 'bun:test';
import * as fs from 'fs';
import * as path from 'path';

describe('Agent Booster Tools', () => {
  const testDir = '/tmp/hive-agent-booster-test';
  
  beforeEach(() => {
    // Clean up test directory
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true });
    }
    fs.mkdirSync(testDir, { recursive: true });
  });
  
  describe('applyCodeEdit', () => {
    test('should apply simple edit', async () => {
      const testFile = path.join(testDir, 'test.ts');
      fs.writeFileSync(testFile, 'const old = "value";\n', 'utf-8');
      
      // Since agent-booster may not be installed, this will use fallback
      const { applyCodeEdit } = await import('../tools/agent-booster.js');
      
      const result = await applyCodeEdit({
        path: testFile,
        oldContent: 'const old = "value";',
        newContent: 'const new = "updated";',
      });
      
      expect(result.success).toBe(true);
      
      const content = fs.readFileSync(testFile, 'utf-8');
      expect(content).toBe('const new = "updated";\n');
    });
    
    test('should handle file not found', async () => {
      const { applyCodeEdit } = await import('../tools/agent-booster.js');
      
      const result = await applyCodeEdit({
        path: '/nonexistent/file.ts',
        oldContent: 'test',
        newContent: 'replacement',
      });
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });
    
    test('should handle content not found', async () => {
      const testFile = path.join(testDir, 'test.ts');
      fs.writeFileSync(testFile, 'const original = "content";\n', 'utf-8');
      
      const { applyCodeEdit } = await import('../tools/agent-booster.js');
      
      const result = await applyCodeEdit({
        path: testFile,
        oldContent: 'nonexistent content',
        newContent: 'replacement',
      });
      
      expect(result.success).toBe(false);
    });

    test('reports which engine applied the edit', async () => {
      const testFile = path.join(testDir, 'engine.ts');
      fs.writeFileSync(testFile, 'export const VERSION = "1.0.0";\n', 'utf-8');

      const { applyCodeEdit } = await import('../tools/agent-booster.js');
      const result = await applyCodeEdit({
        path: testFile,
        oldContent: '"1.0.0"',
        newContent: '"2.0.0"',
        symbol: 'VERSION',
      });

      expect(result.success).toBe(true);
      // Either the booster or the deterministic fallback is acceptable, but the
      // caller must see which one ran (regression: booster was silently skipped).
      expect(result.applied).toMatch(/Applied via (agent-booster|fallback|native fallback)/);
      expect(fs.readFileSync(testFile, 'utf-8')).toBe('export const VERSION = "2.0.0";\n');
    });

    test('preserves surrounding lines when the booster edits a symbol', async () => {
      const testFile = path.join(testDir, 'surrounding.ts');
      const original = [
        '// header comment',
        'export function greet(name: string) {',
        '  return `hi ${name}`;',
        '}',
        '',
        'export const KEEP = 1;',
        '',
      ].join('\n');
      fs.writeFileSync(testFile, original, 'utf-8');

      const { applyCodeEdit } = await import('../tools/agent-booster.js');
      const result = await applyCodeEdit({
        path: testFile,
        oldContent: 'return `hi ${name}`;',
        newContent: 'return `hello ${name}!`;',
        symbol: 'greet',
      });

      expect(result.success).toBe(true);
      const content = fs.readFileSync(testFile, 'utf-8');
      expect(content).toContain('return `hello ${name}!`;');
      expect(content).toContain('// header comment');
      expect(content).toContain('export const KEEP = 1;');
      expect(content.split('\n').length).toBe(original.split('\n').length);
    });
  });

  describe('resolveBoosterApi', () => {
    test('instantiates a default-exported class instead of calling it', async () => {
      const { resolveBoosterApi } = await import('../tools/agent-booster.js');

      class FakeBooster {
        apply(request: { code: string }) {
          return Promise.resolve({ success: true, code: request.code, strategy: 'fake', confidence: 0.9 });
        }
      }

      const api = resolveBoosterApi({ default: FakeBooster, AgentBooster: FakeBooster });
      expect(api).not.toBeNull();
      const result = await api!.apply({ code: 'x', edit: 'y', language: 'typescript' });
      expect(result.strategy).toBe('fake');
    });

    test('uses a named apply export', async () => {
      const { resolveBoosterApi } = await import('../tools/agent-booster.js');
      const api = resolveBoosterApi({
        apply: (request: { code: string }) => Promise.resolve({ success: true, code: request.code }),
      });
      expect(api).not.toBeNull();
      await expect(api!.apply({ code: 'a', edit: 'b', language: 'javascript' })).resolves.toMatchObject({
        success: true,
      });
    });

    test('ignores the inherited Function.prototype.apply of a module object', async () => {
      const { resolveBoosterApi } = await import('../tools/agent-booster.js');
      // A bare function object has no own `apply`, only Function.prototype's.
      const moduleLike = Object.assign(function notAnApi() {}, {});
      expect(resolveBoosterApi(moduleLike)).toBeNull();
    });

    test('returns null for objects without an apply API', async () => {
      const { resolveBoosterApi } = await import('../tools/agent-booster.js');
      expect(resolveBoosterApi({})).toBeNull();
      expect(resolveBoosterApi(null)).toBeNull();
    });
  });

  describe('inferLanguage', () => {
    test('maps common extensions', async () => {
      const { inferLanguage } = await import('../tools/agent-booster.js');
      expect(inferLanguage('a.ts')).toBe('typescript');
      expect(inferLanguage('a.tsx')).toBe('typescript');
      expect(inferLanguage('a.py')).toBe('python');
      expect(inferLanguage('a.rs')).toBe('rust');
      expect(inferLanguage('a.UNKNOWN')).toBe('text');
    });
  });

  describe('mergeLazySnippet', () => {
    test('returns null without markers', async () => {
      const { mergeLazySnippet } = await import('../tools/agent-booster.js');
      expect(mergeLazySnippet('const a = 1;\n', 'const b = 2;')).toBeNull();
    });

    test('appends a block placed after a leading marker', async () => {
      const { mergeLazySnippet } = await import('../tools/agent-booster.js');
      const base = 'const a = 1;\nconst b = 2;\n';
      const merged = mergeLazySnippet(base, '// ... existing code ...\nconst c = 3;');
      expect(merged).toContain('const a = 1;');
      expect(merged).toContain('const b = 2;');
      expect(merged).toContain('const c = 3;');
    });

    test('keeps existing lines between two markers', async () => {
      const { mergeLazySnippet } = await import('../tools/agent-booster.js');
      const base = 'line1\nline2\nline3\n';
      const merged = mergeLazySnippet(base, '// ... existing code ...\ninserted\n// ... existing code ...')!;
      expect(merged).toContain('line1');
      expect(merged).toContain('inserted');
      expect(merged).toContain('line3');
      expect(merged).not.toContain('// ... existing code ...');
    });
  });
  
  describe('isBoosterAvailable', () => {
    test('should return boolean', async () => {
      const { isBoosterAvailable } = await import('../tools/agent-booster.js');
      const available = await isBoosterAvailable();
      expect(typeof available).toBe('boolean');
    });
  });
  
  describe('getBoosterStatus', () => {
    test('should return status object', async () => {
      const { getBoosterStatus } = await import('../tools/agent-booster.js');
      const status = await getBoosterStatus();
      
      expect(status).toHaveProperty('available');
      expect(typeof status.available).toBe('boolean');
    });

    test('reports editing capability when the module is loaded', async () => {
      const { getBoosterStatus, isBoosterAvailable } = await import('../tools/agent-booster.js');
      if (!(await isBoosterAvailable())) return;
      const status = await getBoosterStatus();
      expect(status.capabilities).toBeDefined();
      expect(status.editing).toBe(status.capabilities?.apply === true);
    });
  });
});
