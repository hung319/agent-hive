import { describe, test, expect, beforeEach } from 'bun:test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

describe('Code edit tools (built-in engine)', () => {
  const testDir = path.join(os.tmpdir(), 'hive-agent-booster-test');

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
      // A failed match must leave the file as it was.
      expect(fs.readFileSync(testFile, 'utf-8')).toBe('const original = "content";\n');
    });

    test('reports which matcher applied the edit', async () => {
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
      expect(result.applied).toMatch(/Applied via (exact|fuzzy_indent)/);
      expect(fs.readFileSync(testFile, 'utf-8')).toBe('export const VERSION = "2.0.0";\n');
    });

    test('preserves surrounding lines when editing one statement', async () => {
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

  describe('indentation-insensitive matching', () => {
    test('applies an edit whose indentation no longer matches the file', async () => {
      const testFile = path.join(testDir, 'reindented.ts');
      // The file is indented with 4 spaces, oldContent uses 2.
      const original = [
        'function outer() {',
        '    if (ready) {',
        '        run();',
        '    }',
        '}',
        '',
      ].join('\n');
      fs.writeFileSync(testFile, original, 'utf-8');

      const { applyCodeEdit } = await import('../tools/agent-booster.js');
      const result = await applyCodeEdit({
        path: testFile,
        oldContent: '  if (ready) {\n    run();\n  }',
        newContent: '  if (ready) {\n    runTwice();\n  }',
      });

      expect(result.success).toBe(true);
      expect(result.applied).toContain('fuzzy_indent');
      const content = fs.readFileSync(testFile, 'utf-8');
      // The file keeps its 4-space indentation: oldContent's first line sat at
      // 2 spaces inside a 4-space file, so the matched block starts at 4 and
      // every line keeps its relative depth (run() was 2 deeper).
      expect(content).toBe([
        'function outer() {',
        '    if (ready) {',
        '      runTwice();',
        '    }',
        '}',
        '',
      ].join('\n'));
    });

    test('prefers an exact match over the indentation-insensitive one', async () => {
      const testFile = path.join(testDir, 'exact-first.ts');
      fs.writeFileSync(testFile, '  const a = 1;\n', 'utf-8');

      const { applyCodeEdit } = await import('../tools/agent-booster.js');
      const result = await applyCodeEdit({
        path: testFile,
        oldContent: '  const a = 1;',
        newContent: '  const a = 2;',
      });

      expect(result.success).toBe(true);
      expect(result.applied).toContain('exact');
    });

    test('does not match a line that differs beyond whitespace', async () => {
      const testFile = path.join(testDir, 'no-match.ts');
      fs.writeFileSync(testFile, '    const a = 1;\n', 'utf-8');

      const { applyCodeEdit } = await import('../tools/agent-booster.js');
      const result = await applyCodeEdit({
        path: testFile,
        oldContent: 'const b = 1;',
        newContent: 'const b = 2;',
      });

      expect(result.success).toBe(false);
      expect(fs.readFileSync(testFile, 'utf-8')).toBe('    const a = 1;\n');
    });
  });

  describe('findIgnoringIndent', () => {
    test('returns the span and the file indentation', async () => {
      const { findIgnoringIndent } = await import('../tools/agent-booster.js');
      const content = 'a\n\t\tb\n\t\tc\nd\n';
      const span = findIgnoringIndent(content, '  b\n  c');
      expect(span).not.toBeNull();
      expect(content.slice(span!.start, span!.end)).toBe('\t\tb\n\t\tc');
      expect(span!.indent).toBe('\t\t');
    });

    test('includes the newline when oldContent ends with one', async () => {
      const { findIgnoringIndent } = await import('../tools/agent-booster.js');
      const content = 'keep\n  drop\ntail\n';
      const span = findIgnoringIndent(content, 'drop\n');
      expect(content.slice(span!.start, span!.end)).toBe('  drop\n');
    });

    test('returns null for CRLF content instead of guessing offsets', async () => {
      const { findIgnoringIndent } = await import('../tools/agent-booster.js');
      expect(findIgnoringIndent('a\r\nb\r\n', 'b')).toBeNull();
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

  describe('getBoosterStatus', () => {
    test('reports a ready built-in engine with no package to install', async () => {
      const { getBoosterStatus } = await import('../tools/agent-booster.js');
      const status = await getBoosterStatus();

      expect(status.available).toBe(true);
      expect(status.editing).toBe(true);
      expect(status.capabilities).toEqual({ apply: true, lazyApply: true });
      expect(status.notes?.join(' ')).toContain('Built-in');
    });
  });
});
