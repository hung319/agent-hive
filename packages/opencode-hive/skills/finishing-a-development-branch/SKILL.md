---
name: finishing-a-development-branch
description: Use when implementation is complete and the work is green - presents the integration choice (merge, pull request, keep as-is), verifies the merged result before claiming success, and cleans up only what it created
---

# Finishing a Development Branch

Implementation being done is not the same as work being deliverable. This
skill covers the last mile: confirm it is actually green, let the human
choose how it lands, then land it without damaging anything.

**Core principle:** Verify, then offer, then execute the human's choice.

**Announce at start:** "Using finishing-a-development-branch to complete this work."

## Step 1: Verify Before Offering Anything

Run the project's verification. For this repository, from the repo root:

```bash
bun run build
bun run test
```

If either fails, report the failures and **stop**. The menu comes after a
green suite, never before — offering "merge or PR" on red code invites the
human to pick an option that should not exist yet.

```
Tests failing (<N> failures). Fixing before finishing:

<the failures>
```

Do not soften this. "Mostly passing" is failing.

## Step 2: Establish Where You Are

```bash
GIT_DIR=$(cd "$(git rev-parse --git-dir)" && pwd -P)
GIT_COMMON=$(cd "$(git rev-parse --git-common-dir)" && pwd -P)
BRANCH=$(git branch --show-current)
BASE=$(git rev-parse --abbrev-ref --symbolic-full-name @{upstream} 2>/dev/null | sed 's#^origin/##')
```

| State | Meaning | Menu |
|---|---|---|
| `GIT_DIR` == `GIT_COMMON` | Normal checkout | Standard three |
| Different, named branch | Linked worktree (Hive task worktree) | Standard three, provenance cleanup |
| Different, detached HEAD | Externally managed workspace | Reduced two (no local merge) |

In Hive, completed task work lives on a task branch in
`.hive/features/<feature>/.worktrees/<task>`; `hive_worktree_commit` has
already committed there. Use `hive_status()` to confirm the task is
`completed` before offering options, and `hive_merge` as the merge command —
it is what keeps task state and git state in agreement.

## Step 3: Identify the Base Branch

The base is where the work forked from — usually the branch the worktree was
created against, or the upstream of the current branch. If it is not
certain, ask:

> "This branch split from `<best guess>` — correct?"

Merging into the wrong base is expensive to undo; one question is cheap.

## Step 4: Present the Choice

Use the `question()` tool, not plain text.

**Standard (normal checkout or named task branch):**

```
Implementation complete, verification green. How should this land?

1. Merge into <base> locally
2. Push the branch and open a pull request
3. Keep the branch as-is — I'll handle integration
```

**Detached HEAD:**

```
Implementation complete, verification green. This workspace is externally
managed (detached HEAD).

1. Push as a new branch and open a pull request
2. Keep as-is — I'll handle integration
```

Present exactly these options. **Do not add a discard option** — throwing
work away happens only when the human asks for it by name (Step 6), and
never as a convenience in a menu.

Wait for the answer. The integration decision is theirs.

## Step 5: Execute the Choice

### Merge locally

In Hive: `hive_merge({ task: "<task>" })`. Otherwise:

```bash
MAIN_ROOT=$(git -C "$(git rev-parse --git-common-dir)/.." rev-parse --show-toplevel)
cd "$MAIN_ROOT"
git checkout <base>
git merge <branch>
```

Then **re-run verification on the merged result**. A green branch merged into
a moved base can be red — the branch was tested against a different tree.

If the merged result fails: stop, leave the worktree and branch in place.
Nothing has been pushed, so the merge is local and recoverable. Report what
broke rather than patching main in place without saying so.

Only once the merged result is green: clean up the worktree (Step 6), then
delete the branch.

### Push and open a pull request

```bash
git push -u origin <branch>
```

Open the PR against `<base>` with the forge's CLI if one is available,
following the repository's PR template. Report the URL. Keep the worktree —
PR feedback is easier to act on in place.

### Keep as-is

```
Keeping branch <name>. Workspace preserved at <path>.
Work is committed; nothing was merged or pushed.
```

## Step 6: Clean Up Only What You Created

Remove a worktree, branch, or temporary file only if this session created
it. A worktree someone else made, or one holding uncommitted changes, is not
yours to delete.

Before removing a Hive task worktree, confirm `hive_status()` shows the task
`completed` — a `partial` or `blocked` task still owns its worktree.

### If the human explicitly asks to discard work

Confirm with the exact list of what disappears, and require the word:

```
This permanently deletes:
- branch <name>
- commits: <short shas and subjects>
- worktree at <path>

Type 'discard' to confirm.
```

Only after that confirmation, remove and force-delete.

## Common Mistakes

| Mistake | Why it bites |
|---|---|
| Offering options before verifying | The human picks "merge" on red code |
| Verifying the branch but not the merge | Regression lands on main undetected |
| Merging into a guessed base | Very expensive to undo |
| Deleting a worktree with uncommitted work | Unrecoverable |
| Adding "discard" to the menu | Invites loss that nobody asked for |
| Reporting success from memory instead of a fresh run | See `verification-before-completion` |

## Verification

This skill ran correctly if:

- [ ] Verification ran fresh, in this session, and its output was quoted
- [ ] The options presented were the standard set for the detected state
- [ ] The human chose; you did not choose for them
- [ ] Verification was re-run on the merged result before cleanup
- [ ] Only artifacts this session created were removed
