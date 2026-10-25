---
name: executing-plans
description: Use when you have an approved implementation plan to execute - keeps a progress ledger so compaction cannot lose where you are, executes runnable tasks in batches, and reviews each batch before moving on
---

# Executing Plans

## Overview

Load plan, review critically, execute tasks in batches, review each batch.

**Core principle:** Batch execution with a written ledger, so the next
context knows what the last one finished.

**Announce at start:** "I'm using the executing-plans skill to implement this plan."

## The Ledger (Read This First)

A session's context does not survive compaction. The ledger does. In real
runs, controllers that lost their place after compaction re-dispatched tasks
that were already merged — the single most expensive failure this skill
exists to prevent.

**Location:** `.hive/features/<feature>/progress.md`

**Open it before anything else** if it exists. Trust it over your own
recollection of the session: the commits it names exist in git even when you
no longer remember making them. Check `git log --oneline -20` against the
last ledger entry, and resume from there.

**Format — one line per event, appended:**

```
# Ledger — plan: <feature>/plan.md

Task 01-setup: start (base 4f2a1c9)
Task 01-setup: complete (4f2a1c9..8b3e0d1, tests 12/12, review clean)
Task 02-api: complete (8b3e0d1..c17a55e, tests 18/18, 1 minor deferred: comment on retry)
Task 03-ui: blocked (needs design decision on empty state)
Task 03-ui: resumed with decision "show placeholder" (c17a55e..e9f0b21)
```

Rules:

- **Write the line in the same message as the action it records** — a ledger
  written "at the end" is the ledger that goes missing.
- **Record the base commit before dispatching.** Without it you cannot tell
  what a task changed, and `HEAD~1` silently drops all but the last commit of
  a multi-commit task.
- **Deferred minors go in the ledger, not into your memory.** A note nobody
  can find is a silent discard.
- **Never rewrite earlier lines.** Append only; corrections are new lines.

## The Process

### Step 1: Load, Review, and Pre-flight the Plan
1. Read plan file
2. Review critically - identify any questions or concerns about the plan
3. **Check for conflicts before starting:** do any two tasks touch the same
   file or interface with incompatible expectations? Does any task mandate
   something a reviewer will flag as a defect (a test that asserts nothing,
   a copy-pasted block)? This is a table, one row per shared file or
   interface — "I read it and it seemed fine" is not a check.
4. If concerns or conflicts: raise them with your human partner and record
   the ruling in the ledger before dispatching anything
5. If no concerns: create a todo per task, write the ledger header, proceed

### Step 2: Identify Runnable Tasks

Use `hive_status()` to get the **runnable** list — tasks with all dependencies satisfied.

Only `done` satisfies dependencies (not `blocked`, `failed`, `partial`, `cancelled`).

**When 2+ tasks are runnable:**
- **Ask the operator** via `question()`: "Multiple tasks are runnable: [list]. Run in parallel, sequential, or a specific subset?"
- Record the decision with `hive_context_write({ name: "execution-decisions", content: "..." })` for future reference

**When 1 task is runnable:** Proceed directly.

### Step 3: Execute Batch

For each task in the batch:
1. Record the base commit: `git rev-parse --short HEAD`, and write
   `Task <id>: start (base <sha>)` to the ledger
2. Mark as in_progress via `hive_worktree_start()`
3. Follow each step exactly (plan has bite-sized steps)
4. Run verifications as specified
5. Mark as completed, and write the completion line — commits, test counts,
   and any minor left unaddressed — to the ledger

### Step 4: Report
When batch complete:
- Show what was implemented
- Show verification output (the actual output, not a summary of it)
- Say: "Ready for feedback."

### Step 4.5: Post-Batch Review

Review every batch, not some batches. After the batch report, run the review
in the manner the operator chose when asked up front; if they have not been
asked, ask once and remember the answer:

`task({ subagent_type: "hygienic-reviewer", prompt: "Review implementation changes from the latest batch." })`

Handle its findings with `hive_skill("receiving-code-review")` — verify each
before changing code, and apply or explicitly park each one before starting
the next batch. A finding that is neither fixed nor parked is a finding you
decided to forget.

### Step 5: Continue

The ledger says what is done; the batch report says what changed. Between
batches, keep moving to the next runnable task. Stop only for the four
reasons in "When to Stop and Ask for Help" — not to ask "should I continue?"
Stop conditions are about blockers and decisions, not about permission to do
work already approved.

### Step 6: Complete Development

After all tasks complete and verified:
- Announce: "I'm using the verification-before-completion skill to complete this work."
- **REQUIRED SUB-SKILL:** `hive_skill("verification-before-completion")`
- Then `hive_skill("finishing-a-development-branch")` to choose how the work
  lands — merge, pull request, or keep as-is

## When to Stop and Ask for Help

**STOP executing immediately when:**
- Hit a blocker mid-batch (missing dependency, test fails, instruction unclear)
- Plan has critical gaps preventing starting
- You don't understand an instruction
- Verification fails repeatedly

**Ask for clarification rather than guessing.**

## When to Revisit Earlier Steps

**Return to Review (Step 1) when:**
- Partner updates the plan based on your feedback
- Fundamental approach needs rethinking

**Don't force through blockers** - stop and ask.

## Remember
- Ledger first: read it before acting, append to it before moving on
- Review plan critically first, including the conflict table
- Follow plan steps exactly
- Don't skip verifications
- Reference skills when plan says to
- Review every batch; every finding fixed or parked with a reason
- Stop when blocked, don't guess

## Common Rationalizations

| Excuse | Reality |
|---|---|
| "I'll write the ledger at the end" | At the end you may not be the same context that started. |
| "I remember which tasks are done" | Compaction is not a memory test; check `hive_status()` and the ledger. |
| "The batch was small, skip the review" | Small batches are where an unverified assumption ships. |
| "The finding is minor, I'll come back to it" | Say so in the ledger, or it is gone. |
| "I should check in before the next batch" | The plan is approved. Work, or name a real blocker. |

## What To Remember Afterwards

The ledger is for this feature. Memory is for the next one, and it is the only
place a later session can find what you learned. But a memory is a tax on
every future session — it is read every time — so write few and write well.

**Write, at the point you learned it (not at the end of the feature):**

- **A rule that changed how you work**, as `feedback`:
  `hive_memory_set({ scope: "project", label: "feedback", value: "Convention: <the rule>. Why: <what broke when you did not>. How to apply: <where it bites>." })`
  The `Why` is the part that survives; a rule with no reason gets overridden
  by the next session that finds it inconvenient.
- **A durable fact about this repo**, as `project`: a command that misleads, a
  file never to touch, an external system's quirk. Include the date — a fact
  without one cannot be judged stale later.

**Do not write:**

- Anything you decided in this session that the user has not seen. That is a
  guess wearing a memory's clothes, and tomorrow it will be quoted back to you
  as if it were agreed.
- A log of what you did. `git log` already has it, in more detail.
- A restatement of the plan. The plan file already has it.
- Anything you could re-derive in ten seconds by reading the code.

**Before writing, check for the existing entry** (`hive_memory_recall`). An
updated memory is worth more than a second one that half-contradicts it —
two entries saying similar things in different words is how a memory block
starts lying.

When done, `hive_memory_set({ scope: "project", label: "project", value })`
for the feature's status line, so the next session knows where work stands.
