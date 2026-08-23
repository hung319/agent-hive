import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { getCodegraphCommand } from './codegraph-installer.js';

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

/**
 * Check if project has .codegraph directory
 */
function hasCodegraphIndex(projectRoot: string): boolean {
  return existsSync(join(projectRoot, '.codegraph'));
}

/**
 * Auto-initialize codegraph for a project.
 *
 * Flow (simplified from oh-my-openagent):
 * 1. Resolve the codegraph command (provided, or via the auto-installer:
 *    installed bundle marker or PATH lookup)
 * 2. Check if .codegraph/ exists
 * 3. If not → run `<command> init`
 * 4. If yes → run `<command> sync`
 *
 * @param projectRoot - Project root directory
 * @param codegraphCommand - Explicit command (defaults to installer resolution)
 * @param execFn - Runner for init/sync execution (defaults to execFile)
 * @returns Action taken
 */
export async function ensureCodegraphInit(
  projectRoot: string,
  codegraphCommand?: string,
  execFn: CodegraphExecFn = (file, args, options) => execFileAsync(file, args, options),
): Promise<CodegraphInitResult> {
  const command = codegraphCommand || getCodegraphCommand();
  if (command === '') {
    return {
      success: true,
      action: 'skipped',
      message: 'codegraph install pending, skipping auto-init',
    };
  }

  try {
    const hasIndex = hasCodegraphIndex(projectRoot);

    if (!hasIndex) {
      await execFn(command, ['init'], { cwd: projectRoot, timeout: 60_000 });
      return {
        success: true,
        action: 'init',
        message: 'codegraph init completed',
      };
    }

    await execFn(command, ['sync'], { cwd: projectRoot, timeout: 30_000 });
    return {
      success: true,
      action: 'sync',
      message: 'codegraph sync completed',
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
