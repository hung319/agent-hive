---
name: receiving-code-review
description: Use when receiving review feedback on your work, before implementing any suggestion, especially when the feedback is unclear or technically questionable - requires verification against the codebase, not performative agreement or blind implementation
---

# Receiving Code Review

Review feedback is a set of claims, not a set of instructions. Someone read
your diff and formed an opinion; sometimes they are right, sometimes they
are missing context you have, and sometimes a claim is untestable from where
they sat.

**Core principle:** Verify before implementing. Ask before assuming. Being
technically correct matters more than appearing agreeable.

## The Response Pattern

```
WHEN feedback arrives:

1. READ      the whole thing before reacting to any single point
2. UNDERSTAND restate the requirement in your own words
3. VERIFY    check the claim against the code and tests that exist now
4. EVALUATE  is it right for THIS codebase, not codebases in general?
5. RESPOND   technical acknowledgment, or reasoned pushback
6. IMPLEMENT one item at a time, verifying each
```

Steps 1-2 are cheap. Skipping them is what turns five comments into five
partial implementations.

## Forbidden Responses

Never open with any of these:

- "You're absolutely right!" — agreement before verification is a guess
- "Great point!" / "Excellent feedback!" — praise carries no information
- "Let me implement that now" — before step 3, you have not started

Instead: restate the requirement, ask the clarifying question, state why
the current code stands, or just make the fix and describe it. Action is
the acknowledgment.

## When Feedback Is Unclear

```
IF any item is unclear:
  STOP - implement nothing yet
  ASK about the unclear items
```

Do not implement the clear items and ask about the rest. Review items are
usually related — the unclear one often changes how the clear ones should be
fixed. Implementing half is how a reviewer gets two conflicting patches.

Example — feedback lists items 1-6, you understand 1, 2, 3, 6:

- ❌ Implement 1, 2, 3, 6 now, ask about 4 and 5 later
- ✅ "Items 1, 2, 3, 6 are clear. 4 and 5 depend on what you mean by \<X\>
  — which did you intend?"

## Who The Feedback Came From

**Internal review** (a subagent you dispatched, a reviewer Hive spawned):
it saw only the diff you handed it. It may not know the constraint that
shaped your approach. Verify, then either fix or explain.

**External review** (a human, a PR comment, a different tool): check all of
these before implementing:

1. Is it technically correct for this codebase?
2. Does it break something that currently works?
3. Was the current behavior deliberate — is there a reason in the code,
   the history, or a comment?
4. Does the reviewer have the context that motivated the current design?
5. Is the suggestion a capability we actually need (YAGNI)?

If it looks wrong, say why. If you cannot verify it, say that too: "I can't
confirm this without \<X\> — should I investigate, or should we decide
without it?"

**A reviewer and you both report to the same person.** If the suggestion
adds a feature nothing calls, the right response is to raise the YAGNI
question, not to build it.

## When To Push Back

Push back when:

- the suggestion breaks working behavior
- the reviewer lacks context you have
- it adds code no caller needs (YAGNI)
- it is technically wrong for this stack or version
- a compatibility or legacy constraint makes it unsafe
- it contradicts a decision the user already made

How to push back: technical reasoning, specific questions, references to
the tests or code that show the constraint. Never defensiveness, never a
long justification of feelings.

If pushing back feels uncomfortable, say the tension plainly rather than
silently complying or silently ignoring.

## When You Were Wrong

```
✅ "Checked it — you were right, \<X\> does \<Y\>. Fixing."
✅ "My understanding was wrong because \<reason\>. Implementing."
❌ a long apology
❌ defending why you pushed back
```

State the correction and move on. The correction is the whole response.

## Implementation Order

For multiple items:

1. Clarify everything unclear, first
2. Then fix in this order: blocking (breaks, security) → simple (typos,
   imports) → complex (refactoring, logic)
3. Verify each fix on its own
4. Re-run the covering tests at the end

## Common Mistakes

| Mistake | Fix |
|---|---|
| Performative agreement | State the requirement or make the change |
| Blind implementation | Verify against the codebase first |
| Batch all items, test once | One at a time, verify each |
| Assuming the reviewer is right | Check whether it breaks things |
| Avoiding pushback | Technical correctness over comfort |
| Partial implementation | Clarify all items first |
| Can't verify, proceed anyway | State the limitation, ask |

## Verification

You received review correctly if:

- [ ] Every item was verified against the code before any edit
- [ ] Any pushback cited a concrete constraint, test, or line
- [ ] Each fix was verified separately
- [ ] Nothing was silently dropped — every item is fixed, parked with a
      reason, or still open and named
