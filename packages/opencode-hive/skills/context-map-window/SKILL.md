---
name: context-map-window
description: Use when about to read whole files, paste a large log, or append to a prompt, skill, or document that is already long - gives the map-first read order, and a growth check that stops context bloat before it is paid for on every turn
---

# Context Map Window

Every token you load stays in the context window and is paid for on every
turn after it. The same is true of anything you *write* into a prompt or a
skill: it is read by every future session, not just this one.

**Core principle:** Get the map before the body, and make every line you add
to a long-lived file earn its place.

## Reading: map first

| Question | Wrong first move | Right first move |
|---|---|---|
| Where does X live? | `read` every likely file | `code_search` — ranked symbols with file and line |
| What shape is this file? | `read` all 800 lines | `look_at` — headings, exported symbols, structure |
| Who calls X? | grep the name everywhere | `call_graph_callers`, then read only the hits |
| What is in this pattern? | grep the literal text | `ast_grep_find_code` — ignores formatting and comments |
| What changed recently? | diff the whole branch | `git log --oneline -15` for the branch, then read the diff of the file that matters |

Then read the range you actually need, not the file. `read` takes an offset
and a limit for exactly this reason.

**When reading whole files is right:** the file is under ~150 lines; you are
about to rewrite it; or you have already narrowed to it and cannot explain
its behavior without all of it. "It seemed important" is not a reason.

## Tool output: keep the decision, drop the bulk

A 3000-line test log has one line that matters. When a command produces more
than a screenful:

1. Re-run it filtered (`| tail -30`, `--reporter=dot`, `-q`) rather than
   paging through the whole thing.
2. In your reply, quote the decisive line — the failing assertion, the error
   message — not the transcript.
3. If you must keep the transcript, put it in a file and cite the path.

## Writing: the growth check

Before adding to any file that is loaded on every turn — a system prompt, an
agent prompt, a skill body, `AGENTS.md` — answer these:

- **Is there a place this belongs?** A new section appended to a 230-line
  prompt that already covers the topic is how prompts become contradictory.
  Two rules saying almost the same thing in different words will eventually
  disagree, and nobody notices which one arrived last.
- **Will it still be true in six months?** Facts with a date belong in memory,
  not in a prompt. A prompt that says "as of today the latest version is X"
  is already wrong.
- **Could it be one line?** Most additions are a rule plus an example. The
  example earns its place only if the rule is regularly misread.
- **What does it replace?** If the answer is "nothing", check whether a rule
  nearby already covers it. Replacing a vague paragraph with a precise
  sentence is a net gain; adding a fourth paragraph to three vague ones is not.

The test for a skill specifically: **would removing this line make an agent
behave worse?** If not, the line is decoration.

## The tell that you are the one bloat

Three symptoms, all cheap to spot:

- You are re-reading a file you already read this session.
- You are pasting a whole file into your reply to explain a two-line change.
- You are adding "and also remember to…" to a prompt that already said it.

Any of the three: stop, narrow, and cut.

## Verification

This skill ran correctly if:

- [ ] The first read of any unfamiliar area was a search or a structure view,
      not a whole-file read
- [ ] Files read whole were short, being rewritten, or already narrowed to
- [ ] Decisive output was quoted, not dumped
- [ ] Anything added to a prompt or skill passed the growth check, and
      something was replaced rather than only appended
