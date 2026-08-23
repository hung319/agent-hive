import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { resolveCodegraphMcpCommand } from './codegraph-installer.js';

const execFileAsync = promisify(execFile);

export interface CodegraphInitResult {
  success: boolean;
  action: 'init' | 'sync' | 'skipped' | 'error';
  message: string;
}

/** Injectable runner so tests can fake init/sync execution. */
export type CodegraphExecFn = (
  file: string,
  args: string[],
  options: { cwd: string; timeout: number },
) => Promise<{ stdout: string; stderr: string }>;

export type CodegraphCommandArg = string | string[];

function normalizeCommand(codegraphCommand?: CodegraphCommandArg): string[] {
  if (typeof codegraphCommand === 'string') {
    return codegraphCommand === '' ? [] : [codegraphCommand];
  }
  return codegraphCommand ?? [];
}

/**
 * Check if project has .codegraph directory
 */
function hasCodegraphIndex(projectRoot: string): boolean {
  return existsSync(join(projectRoot, '.codegraph'));
}

/**
 * Auto-initialize codegraph for a project.
 *
 * Flow:
 * 1. Resolve the codegraph argv (provided, or via resolveCodegraphMcpCommand)
 * 2. Check if .codegraph/ exists
 * 3. If not → run `<command> init`
 * 4. If yes → run `<command> sync`
 *
 * @param projectRoot - Project root directory
 * @param codegraphCommand - Command (defaults to resolver: npm shim, bundle marker, or PATH)
 * @param execFn - Runner for init/sync execution (defaults to execFile)
 * @returns Action taken
 */
export async function ensureCodegraphInit(
  projectRoot: string,
  codegraphCommand?: CodegraphCommandArg,
  execFn: CodegraphExecFn = (file, args, options) => execFileAsync(file, args, options),
): Promise<CodegraphInitResult> {
  const argv = normalizeCommand(codegraphCommand);
  // Explicit empty command = caller opts out; only an omitted argument falls
  // back to auto-resolution.
  if (codegraphCommand === undefined) {
    const resolution = resolveCodegraphMcpCommand();
    if (resolution !== null) {
      argv.push(...resolution.command);
    }
  }

  const file = argv[0];
  if (file === undefined || file === '') {
    return {
      success: true,
      action: 'skipped',
      message: 'codegraph unavailable, skipping auto-init',
    };
  }

  try {
    const hasIndex = hasCodegraphIndex(projectRoot);
    const sub = hasIndex ? 'sync' : 'init';

    await execFn(file, [...argv.slice(1), sub], {
      cwd: projectRoot,
      timeout: hasIndex ? 30_000 : 60_000,
    });
    return {
      success: true,
      action: sub,
      message: `codegraph ${sub} completed`,
    };
  } catch (error) {
    return {
      success: false,
      action: 'error',
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Build guidance message when codegraph is not ready.
 * Pattern from oh-my-openagent: helpful hints instead of silent failure.
 */
export function buildCodegraphInitGuidance(projectPath: string): string {
  return [
    'CodeGraph initialization guidance:',
    `CodeGraph is not initialized for ${projectPath}.`,
    '- Run `codegraph init` from the project root and retry.',
    '- OMO auto-init runs on session start; if bootstrap just ran, wait and retry.',
  ].join('\n');
}
