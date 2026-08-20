import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const execFileAsync = promisify(execFile);

export interface CodegraphInitResult {
  success: boolean;
  action: 'init' | 'sync' | 'skipped' | 'error';
  message: string;
}

/**
 * Check if codegraph is available on PATH
 */
async function isCodegraphAvailable(): Promise<boolean> {
  try {
    await execFileAsync('which', ['codegraph']);
    return true;
  } catch {
    return false;
  }
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
 * Flow (simplified from oh-my-openagent):
 * 1. Check if codegraph is installed
 * 2. Check if .codegraph/ exists
 * 3. If not → run `codegraph init`
 * 4. If yes → run `codegraph sync`
 *
 * @param projectRoot - Project root directory
 * @returns Action taken
 */
export async function ensureCodegraphInit(projectRoot: string): Promise<CodegraphInitResult> {
  if (!(await isCodegraphAvailable())) {
    return {
      success: true,
      action: 'skipped',
      message: 'codegraph not installed, skipping auto-init',
    };
  }

  try {
    const hasIndex = hasCodegraphIndex(projectRoot);

    if (!hasIndex) {
      await execFileAsync('codegraph', ['init'], { cwd: projectRoot, timeout: 60_000 });
      return {
        success: true,
        action: 'init',
        message: 'codegraph init completed',
      };
    }

    await execFileAsync('codegraph', ['sync'], { cwd: projectRoot, timeout: 30_000 });
    return {
      success: true,
      action: 'sync',
      message: 'codegraph sync completed',
    };
  } catch (error: any) {
    return {
      success: false,
      action: 'error',
      message: error.message,
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
