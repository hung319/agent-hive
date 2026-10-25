---
name: using-hive
description: Use when starting any Hive session or when unsure which skill applies - maps an intent to the skill that handles it, so guidance is loaded before the first action instead of reconstructed from memory
---

# Using Hive Skills

A skill exists for most work in this repository. Its value comes from being
loaded **before** you act, not after you have already decided how.

**Core principle:** Check the map, load the skill, then act. Loading a skill
and finding it irrelevant costs one tool call. Acting without it costs a
rework cycle.

## The Rule

Before your first substantive action on a request, ask: does the map below
name a skill for this intent?

- **Yes** → `hive_skill("<name>")` and follow it.
- **No** → proceed; the map is not exhaustive.

Announce it once: "Using \<skill\> to \<purpose\>."

This applies to clarifying questions too. If the request is vague, the
skill that applies is usually `brainstorming`, not "ask a quick question".

## The Map

| The request sounds like | Load |
|---|---|
| "Build X", "add a feature", "change how Y behaves", or anything whose design is still unsettled | `brainstorming` |
| A request that is missing scope, "done", or constraints | `ask-questions-if-underspecified` |
| "Plan this", multi-step work, or a spec that needs breaking down | `writing-plans` |
| A written plan waiting to be executed | `executing-plans` |
| "Fix this bug", a failing test, something behaving unexpectedly | `systematic-debugging` |
| Implementing or fixing anything | `test-driven-development` |
| Several independent tasks or investigations | `dispatching-parallel-agents` |
| Research across codebase and external sources | `parallel-exploration` |
| Reviewing a diff, a PR, or a finished task | `code-reviewer` |
| **Receiving** someone else's review comments | `receiving-code-review` |
| Work is implemented and you are about to say it is done | `verification-before-completion` |
| Merging, opening a PR, or deciding what happens to a finished branch | `finishing-a-development-branch` |
| Containers, Dockerfiles, compose, or container debugging | `docker-mastery` |
| Writing or updating AGENTS.md | `agents-md-mastery` |
| Creating or editing a skill | `skill-creator` |
| Response should be shorter without losing code accuracy | `caveman` |

## Two Skills, Not One

Process skills decide *how* to approach the work; domain skills supply
knowledge. When both apply, load the process skill first — it shapes what
you do with the domain knowledge.

- "Build an auth feature" → `brainstorming` first, `test-driven-development`
  when writing code, `code-reviewer` at the end.
- "Why does this container restart?" → `systematic-debugging` first,
  `docker-mastery` for the domain facts.

## Red Flags

These thoughts mean the check was skipped:

| Thought | Reality |
|---|---|
| "This is too small for a skill" | Small tasks are where the unverified claim slips in. `verification-before-completion` takes seconds. |
| "I remember what that skill says" | Skills are edited. Read the current one. |
| "I'll load it after exploring" | The skill decides *how* to explore. Load first. |
| "The user asked a question, not a task" | Questions get answered from assumptions without a skill. The map still applies. |
| "Loading a skill wastes context" | One skill is a few hundred lines; a rework cycle is thousands. |
| "I already started, too late" | Load it now. The cost is bounded by how much you have not yet done. |

## After Work Is Done

Two obligations run after the task, not before it:

- **Record what was learned.** When a finding would save the next session
  time (a command that lies, a file that must never be touched, a decision
  with a reason), write it where it survives: `hive_memory_set` for the
  project, or `hive_agents_md` for a convention the whole repo needs.
- **Say what is verified and what is not.** A claim backed by a command
  you just ran and an assumption you did not check are different things,
  and the reader cannot tell them apart unless you say so.

## Verification

You used this skill correctly if, at the end of the session:

- [ ] Every skill you loaded was announced before the action it shaped
- [ ] No intent from the map was handled without its skill
- [ ] Learned facts were written down rather than left in the transcript
