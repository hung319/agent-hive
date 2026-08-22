import { tool, type ToolDefinition } from "@opencode-ai/plugin";
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

/**
 * Auto-CR Tool - SWC-based automated code review
 *
 * auto-cr-cmd provides fast static analysis for JavaScript/TypeScript.
 * Built-in rules: no-deep-relative-imports, no-circular-dependencies,
 * no-swallowed-errors, no-catastrophic-regex, etc.
 */

/**
 * The npm package `auto-cr-cmd` exposes its executable as `check`
 * (not `auto-cr-cmd`), so both names must be probed. Older installs
 * and the Hive installer alias may still provide `auto-cr-cmd`.
 */
const AUTO_CR_COMMAND_CANDIDATES: string[] = (() => {
  const hiveBinDir = path.join(os.homedir(), '.config', 'opencode', 'hive', 'bin');
  return [
    'auto-cr-cmd',
    'check',
    `"${path.join(hiveBinDir, 'auto-cr-cmd')}"`,
    `"${path.join(hiveBinDir, 'check')}"`,
    'npx --yes auto-cr-cmd',
  ];
})();

/** Cached successful resolution (null results are never cached so a
 *  mid-session install is picked up on the next call). */
let resolvedAutoCrCommand: string | undefined;

function tryAutoCrCommand(command: string): boolean {
  // The CLI has no --version flag; --help exits 0 whenever the binary runs.
  try {
    execSync(`${command} --help`, {
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 30000,
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Resolve a working auto-cr command prefix.
 * Tries `auto-cr-cmd`, `check`, the hive bin directory, then `npx` as last resort.
 * Returns the command to invoke, or null when unavailable.
 */
export function resolveAutoCrBinary(): string | null {
  if (resolvedAutoCrCommand !== undefined) return resolvedAutoCrCommand;
  for (const candidate of AUTO_CR_COMMAND_CANDIDATES) {
    if (tryAutoCrCommand(candidate)) {
      resolvedAutoCrCommand = candidate;
      return candidate;
    }
  }
  return null;
}

/**
 * Read the installed auto-cr-cmd version from hive package metadata.
 * The CLI itself has no --version flag.
 */
function readAutoCrVersion(): string | undefined {
  try {
    const pkgPath = path.join(
      os.homedir(), '.config', 'opencode', 'hive', 'packages', 'node_modules', 'auto-cr-cmd', 'package.json',
    );
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8')) as { version?: unknown };
    return typeof pkg.version === 'string' ? pkg.version : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Check if auto-cr is installed
 */
function checkAutoCrStatus(): { installed: boolean; version?: string } {
  const command = resolveAutoCrBinary();
  if (!command) {
    return { installed: false };
  }
  return { installed: true, version: readAutoCrVersion() };
}

/**
 * Execute auto-cr command
 */
function runAutoCr(args: string[]): { success: boolean; output?: string; error?: string; json?: any } {
  const command = resolveAutoCrBinary();
  if (!command) {
    return {
      success: false,
      error: 'auto-cr-cmd not found (tried auto-cr-cmd, check, hive bin dir, and npx)',
    };
  }
  try {
    // Use JSON output for structured results - avoid duplicate --output if caller already supplied it
    const hasOutput = args.includes('--output') || args.includes('-o');
    const allArgs = hasOutput ? args : [...args, '--output', 'json'];
    // Quote args that contain spaces or special chars to survive shell parsing
    const quoted = allArgs.map(a => (a.includes(' ') || a.includes('"') || a.includes("'") ? `"${a.replace(/"/g, '\\"')}"` : a));
    const output = execSync(`${command} ${quoted.join(' ')}`, {
      encoding: 'utf-8',
      maxBuffer: 50 * 1024 * 1024, // 50MB buffer for large codebases
    });
    
    // Try to parse JSON output
    try {
      const json = JSON.parse(output);
      return { success: true, output, json };
    } catch {
      return { success: true, output };
    }
  } catch (error: any) {
    // auto-cr returns exit code 1 for warnings, 0 for no errors
    // We need to capture stdout even on non-zero exit
    const stderr = error.stderr || '';
    const stdout = error.stdout || '';
    const combined = stdout + stderr;
    
    // Try to parse as JSON anyway
    try {
      const json = JSON.parse(combined);
      return { success: true, output: combined, json };
    } catch {
      return { success: false, error: combined || error.message };
    }
  }
}

// ============================================================================
// Tool: auto_cr_status
// ============================================================================

export const autoCrStatusTool: ToolDefinition = tool({
  description: `Check auto-cr-cmd installation status.

**Returns:**
- installed: Whether auto-cr-cmd is available
- version: Auto-CR version
- ready: Whether it's ready to scan

**Installation:**
\`\`\`bash
npm install auto-cr-cmd
# or
pnpm add auto-cr-cmd
\`\`\`

**Note:** The package installs its binary as \`check\` (not \`auto-cr-cmd\`).
Both names are detected automatically, including via npx.`,

  args: {},

  async execute() {
    const status = checkAutoCrStatus();

    if (!status.installed) {
      return JSON.stringify({
        status: 'not_installed',
        message: 'auto-cr-cmd not found (tried auto-cr-cmd, check, hive bin dir, and npx)',
        installation: 'npm install auto-cr-cmd',
        hint: 'The package exposes its binary as `check`; both `check` and `auto-cr-cmd` are accepted.',
      }, null, 2);
    }

    return JSON.stringify({
      status: 'ready',
      version: status.version,
      message: 'Auto-CR is ready to scan',
      rules: [
        'no-deep-relative-imports',
        'no-circular-dependencies',
        'no-swallowed-errors',
        'no-catastrophic-regex',
        'no-deep-clone-in-loop',
        'no-n2-array-lookup',
      ],
    }, null, 2);
  },
});

// ============================================================================
// Tool: auto_cr_scan
// ============================================================================

export const autoCrScanTool: ToolDefinition = tool({
  description: `Scan directory for code issues using auto-cr (SWC-based static analysis).

**Parameters:**
- path: Directory path to scan (defaults to ./src)
- language: Output language (en/zh, defaults to en)

**Rules detected:**
- no-deep-relative-imports: Import paths exceeding depth limit
- no-circular-dependencies: Circular module dependencies
- no-swallowed-errors: try-catch blocks that swallow errors
- no-catastrophic-regex: Potentially catastrophic regex patterns
- no-deep-clone-in-loop: Performance anti-patterns
- no-n2-array-lookup: O(n²) array operations

**Example:**
\`\`\`
auto_cr_scan({ path: "./src" })
\`\`\``,

  args: {
    path: tool.schema.string().optional().default('./src').describe('Directory path to scan'),
    language: tool.schema.string().optional().default('en').describe('Output language (en or zh)'),
  },

  async execute({ path: scanPath, language: lang }) {
    const scanTarget = scanPath ?? './src';
    const language = lang ?? 'en';
    const status = checkAutoCrStatus();
    
    if (!status.installed) {
      return JSON.stringify({
        success: false,
        error: 'auto-cr-cmd not installed',
        hint: 'npm install auto-cr-cmd (binary is exposed as `check`)',
      }, null, 2);
    }

    // Verify path exists
    if (!fs.existsSync(scanTarget)) {
      return JSON.stringify({
        success: false,
        error: `Path not found: ${scanTarget}`,
      }, null, 2);
    }

    const result = runAutoCr(['--language', language, '--output', 'json', scanTarget]);
    
    if (!result.success && !result.json) {
      return JSON.stringify({
        success: false,
        error: result.error || 'Scan failed',
      }, null, 2);
    }

    // Return structured results
    if (result.json) {
      const { summary, files, notifications } = result.json;
      return JSON.stringify({
        success: true,
        scanned: scanTarget,
        summary: {
          filesScanned: summary?.scannedFiles || 0,
          filesWithErrors: summary?.filesWithErrors || 0,
          filesWithWarnings: summary?.filesWithWarnings || 0,
          totalViolations: summary?.violationTotals?.total || 0,
        },
        files: files?.map((f: any) => ({
          path: f.filePath,
          violations: f.totalViolations,
          errors: f.severityCounts?.error || 0,
          warnings: f.severityCounts?.warning || 0,
          details: f.violations?.map((v: any) => ({
            rule: v.ruleName,
            severity: v.severity,
            message: v.message,
            line: v.line,
          })),
        })),
        notifications: notifications || [],
      }, null, 2);
    }

    // Fallback to raw output
    return JSON.stringify({
      success: true,
      scanned: scanTarget,
      rawOutput: result.output,
    }, null, 2);
  },
});

// ============================================================================
// Tool: auto_cr_diff
// ============================================================================

export const autoCrDiffTool: ToolDefinition = tool({
  description: `Scan git diff output for code issues using auto-cr.

**Use case:** Run in CI to check only changed files.

**Example:**
\`\`\`bash
git diff --name-only -z | xargs -0 check --stdin --output json
\`\`\`

**Note:** The npm package exposes its binary as \`check\`. The \`auto-cr-cmd\`
name also works when the Hive installer created the alias. \`npx auto-cr-cmd\`
works everywhere.

This tool requires git diff output piped via stdin.`,

  args: {
    language: tool.schema.string().optional().default('en').describe('Output language (en or zh)'),
  },

  async execute({ language }) {
    const status = checkAutoCrStatus();

    if (!status.installed) {
      return JSON.stringify({
        success: false,
        error: 'auto-cr-cmd not installed',
        hint: 'npm install auto-cr-cmd (binary is exposed as `check`)',
      }, null, 2);
    }

    return JSON.stringify({
      success: true,
      message: 'Use git diff with auto-cr directly',
      example: 'git diff --name-only -z | xargs -0 npx auto-cr-cmd --stdin --output json',
    }, null, 2);
  },
});

// ============================================================================
// Tool: auto_cr_rules
// ============================================================================

export const autoCrRulesTool: ToolDefinition = tool({
  description: `List available auto-cr rules and their descriptions.

**Returns:** All built-in rules with descriptions.`,

  args: {},

  async execute() {
    const rules = [
      {
        name: 'no-deep-relative-imports',
        severity: 'error',
        description: 'Import paths should not exceed maximum depth',
        example: 'Use path aliases (@shared/utils) instead of ../../../../shared/utils',
      },
      {
        name: 'no-circular-dependencies',
        severity: 'warning',
        description: 'Detect circular module dependencies',
        example: 'A imports B, B imports A creates a cycle',
      },
      {
        name: 'no-swallowed-errors',
        severity: 'warning',
        description: 'try-catch blocks that swallow errors without rethrowing',
        example: 'catch (e) {} without logging or rethrowing',
      },
      {
        name: 'no-catastrophic-regex',
        severity: 'error',
        description: 'Potentially catastrophic regex backtracking',
        example: 'Regex with nested quantifiers that can hang',
      },
      {
        name: 'no-deep-clone-in-loop',
        severity: 'warning',
        description: 'Performance: deep clone operations inside loops',
        example: 'for loop calling JSON.parse(JSON.stringify())',
      },
      {
        name: 'no-n2-array-lookup',
        severity: 'warning',
        description: 'O(n²) array operations',
        example: 'Nested for loops accessing array elements',
      },
    ];

    return JSON.stringify({
      success: true,
      rules,
      totalRules: rules.length,
    }, null, 2);
  },
});
