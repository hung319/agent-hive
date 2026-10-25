/**
 * WorktreeService against real git repositories.
 *
 * These run real `git` in a temp repo rather than mocking simple-git, because
 * the behaviour worth guarding lives in how git's output is read: conflict
 * detection, diff application, and the repo being left usable after a failure.
 * The merge cases exist specifically because upgrading simple-git 3 -> 4 moved
 * parsed git responses from the error object to `error.git`, which silently
 * emptied the conflict file list while the failure itself still reported.
 */
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { execFileSync } from 'node:child_process';
import { WorktreeService } from './worktreeService';

function git(cwd: string, ...args: string[]): string {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf-8',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: 'Test',
      GIT_AUTHOR_EMAIL: 'test@example.com',
      GIT_COMMITTER_NAME: 'Test',
      GIT_COMMITTER_EMAIL: 'test@example.com',
    },
  });
}

describe('WorktreeService (real git)', () => {
  let root: string;
  let service: WorktreeService;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'hive-wt-'));
    git(root, 'init', '-b', 'main');
    git(root, 'config', 'user.email', 'test@example.com');
    git(root, 'config', 'user.name', 'Test');
    fs.writeFileSync(path.join(root, 'a.txt'), 'base\n');
    git(root, 'add', '-A');
    git(root, 'commit', '-m', 'base');
    service = new WorktreeService({ baseDir: root, hiveDir: path.join(root, '.hive') });
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('reports the conflicting file names when a merge fails', async () => {
    git(root, 'checkout', '-b', 'hive/feat/01-task');
    fs.writeFileSync(path.join(root, 'a.txt'), 'branch\n');
    git(root, 'commit', '-am', 'branch change');
    git(root, 'checkout', 'main');
    fs.writeFileSync(path.join(root, 'a.txt'), 'main\n');
    git(root, 'commit', '-am', 'main change');

    const result = await service.merge('feat', '01-task', 'merge');

    expect(result.success).toBe(false);
    expect(result.merged).toBe(false);
    // The caller shows these to the user; an empty list is a dead end.
    expect(result.conflicts).toEqual(['a.txt']);
  });

  it('leaves the repo out of a merge state after a conflicting merge', async () => {
    git(root, 'checkout', '-b', 'hive/feat/01-task');
    fs.writeFileSync(path.join(root, 'a.txt'), 'branch\n');
    git(root, 'commit', '-am', 'branch change');
    git(root, 'checkout', 'main');
    fs.writeFileSync(path.join(root, 'a.txt'), 'main\n');
    git(root, 'commit', '-am', 'main change');

    await service.merge('feat', '01-task', 'merge');

    expect(git(root, 'status', '--porcelain')).toBe('');
    expect(git(root, 'diff', '--name-only', '--diff-filter=U')).toBe('');
    expect(fs.existsSync(path.join(root, '.git', 'MERGE_HEAD'))).toBe(false);
  });

  it('merges a non-conflicting branch and creates a merge commit', async () => {
    git(root, 'checkout', '-b', 'hive/feat/01-task');
    fs.writeFileSync(path.join(root, 'b.txt'), 'branch\n');
    git(root, 'add', '-A');
    git(root, 'commit', '-m', 'branch adds b');
    git(root, 'checkout', 'main');

    const result = await service.merge('feat', '01-task', 'merge');

    expect(result.success).toBe(true);
    expect(result.merged).toBe(true);
    expect(result.filesChanged).toEqual(['b.txt']);
    expect(result.sha).toBe(git(root, 'rev-parse', 'HEAD').trim());
    expect(Number(git(root, 'rev-list', '--count', 'HEAD').trim())).toBe(3);
  });

  it('creates a worktree on its own branch and commits changes in it', async () => {
    const info = await service.create('feat', '01-task');
    expect(info.branch).toBe('hive/feat/01-task');
    expect(fs.existsSync(info.path)).toBe(true);

    fs.writeFileSync(path.join(info.path, 'new.txt'), 'from worktree\n');
    const commit = await service.commitChanges('feat', '01-task', 'hive: work');

    expect(commit.committed).toBe(true);
    expect(commit.sha).toBe(git(info.path, 'rev-parse', 'HEAD').trim());
  });

  it('applies an exported patch onto a clean base', async () => {
    const info = await service.create('feat', '01-task');
    fs.writeFileSync(path.join(info.path, 'new.txt'), 'patched\n');
    await service.commitChanges('feat', '01-task', 'hive: work');

    const patchPath = await service.exportPatch('feat', '01-task');
    expect(fs.readFileSync(patchPath, 'utf-8')).toContain('new.txt');

    const applied = await service.applyDiff('feat', '01-task', 'main');
    expect(applied.success).toBe(true);
    expect(applied.filesAffected).toEqual(['new.txt']);
    expect(fs.readFileSync(path.join(root, 'new.txt'), 'utf-8')).toBe('patched\n');
  });
});
