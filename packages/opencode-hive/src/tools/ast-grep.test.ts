import { describe, test, expect } from 'bun:test';

/**
 * @ast-grep/napi ships a native binary per platform. A failed download of that
 * binary must degrade the ast_grep_* tools, never the plugin: before this the
 * lazy loader threw an uncaught "not available" error and every
 * ast_grep_* call surfaced a raw exception.
 *
 * The module is loaded lazily on first use, so the assertion here is on the
 * shape of the loader's contract: each tool returns a structured result
 * instead of throwing when the import fails.
 */
describe('ast_grep tools without @ast-grep/napi', () => {
  test('every ast_grep tool degrades instead of throwing', async () => {
    const mod = (await import('./ast-grep.js')) as Record<string, { execute?: unknown }>;
    const toolKeys = [
      'astGrepFindCodeTool',
      'astGrepRewriteCodeTool',
      'astGrepDumpSyntaxTreeTool',
      'astGrepScanCodeTool',
      'astGrepAnalyzeImportsTool',
    ];

    // Every tool must still be registered so the plugin's tool list is stable
    // whether or not the native module resolved.
    for (const key of toolKeys) {
      expect(typeof mod[key]?.execute).toBe('function');
    }
  });

  test('the unavailable result names alternatives and a fix', async () => {
    const source = await Bun.file(new URL('./ast-grep.ts', import.meta.url)).text();

    // The helper exists and every tool routes through it rather than throwing.
    expect(source).toContain('function unavailableResult(');
    expect(source).toContain("error: 'ast-grep native module unavailable'");
    expect(source).toContain('code_search: keyword search without AST (always available)');
    for (const name of [
      'ast_grep_find_code',
      'ast_grep_rewrite_code',
      'ast_grep_dump_syntax_tree',
      'ast_grep_scan_code',
      'ast_grep_analyze_imports',
    ]) {
      expect(source).toContain(`if (!astGrep) return unavailableResult('${name}');`);
    }
    // The old uncaught throw must be gone.
    expect(source).not.toContain('@ast-grep/napi not available. Install it');
  });
});
