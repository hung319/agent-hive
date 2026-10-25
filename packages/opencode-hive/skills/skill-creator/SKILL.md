---
name: skill-creator
description: "Use when creating new skills for agents - guides through conversational skill design, format compliance, and testing"
---

# Skill Creator

## Overview

You are a skill creator helping design new skills that agents will use. Skills are markdown files that teach agents how to perform specific tasks well.

**Core principle:** Every skill must change agent behavior. If it doesn't prevent a mistake or enable a capability, it's not a skill.

## When to Use

- User wants to create a new skill
- User describes a problem agents keep getting wrong
- User wants to encode domain expertise for agents
- User says "create a skill for X" or "agents should know how to Y"

## Skill Format

Skills live at `packages/opencode-hive/skills/<skill-name>/SKILL.md` and use this structure:

```markdown
---
name: skill-name-kebab-case
description: "Use when <trigger> — <what loading it changes>"
---

# Skill Title

## Overview

What this skill does and why it matters.

## When to Use

Clear triggers for when agents should load this skill.

## The Pattern

Step-by-step instructions for the skill workflow.

## Common Mistakes / Rationalizations

Excuses an agent will make to skip the skill, each answered.

## Verification

How to verify the skill worked correctly.
```

**The body is free-form; only the frontmatter is fixed.** Frontmatter has
exactly two keys, `name` and `description`. Everything else — headings,
tables, diagrams — exists to change behavior, not to satisfy a template. A
section that does not change how an agent acts is the first thing to cut.

## The Description Is The Trigger

An agent decides whether to load a skill from its description alone; the body
is invisible until then. So the description must name the situation, not the
topic:

- ✅ `Use when a test fails and the cause is not obvious — enforces root-cause
  investigation before any fix is attempted`
- ❌ `A guide to debugging` — names a topic, gives no trigger, and nothing
  tells the agent this applies right now

Start with "Use when". Name the moment, and what changes once loaded.

## The Process

### Phase 1: Understand the Need

Ask these questions one at a time:

1. **What problem does this solve?**
   - What mistakes do agents make without this skill?
   - What capability is missing?

2. **When should agents use it?**
   - What triggers the skill?
   - What's the context?

3. **What's the core pattern?**
   - What's the step-by-step workflow?
   - What are the key decisions?

### Phase 2: Design the Skill

Based on answers, draft the skill:

1. **Name it** - kebab-case, descriptive
2. **Write the description** - one sentence, clear trigger
3. **Structure the content** - follow the format above
4. **Add examples** - real scenarios from your codebase

### Phase 3: Refine

Review the draft:

- **Does it change behavior?** Every section should affect how agents work
- **Is it specific?** Concrete steps, not vague guidance
- **Is it testable?** Can you verify it worked?
- **Does it fit?** Matches existing skill patterns

### Phase 4: Test It (Before You Call It Done)

Writing a skill is TDD applied to process documentation. If you never watched
an agent fail without it, you do not know it teaches the right thing.

This matters most for **discipline skills** — ones telling an agent not to
take the shortcut it wants to take (skip the test, claim done early, skip the
review). Those are the ones that get rationalized away under pressure. Pure
reference skills (an API's syntax) need less of this.

**RED — watch it fail.** Give a subagent a realistic task with 2-3 pressures
combined (time, a confident user, a shortcut that would obviously work, a
test suite that is slow). Do **not** give it the skill. Record, word for word,
what it chose and how it justified it. That transcript is the specification.

**GREEN — write the minimum skill.** Address exactly the failures you
observed. Do not add sections for hypothetical misuse; you have a transcript,
use it. Re-run the same scenario with the skill loaded. It should now comply.

**REFACTOR — close the loopholes.** Run a harder version and collect new
excuses. Every new excuse becomes a row in the skill's rationalization table:

```markdown
| Excuse | Reality |
|--------|---------|
| "Too simple to test" | Simple code breaks, and the test takes a minute. |
| "I'll test after" | A test written after proves what the code does, not what it should. |
```

Two rules that do most of the work:

- **Forbid the specific workaround**, not just the act. "Delete it and start
  over" is weak; "delete it — don't keep it as reference, don't 'adapt' it
  while writing the test, delete means delete" is strong.
- **Close the spirit-vs-letter argument early**: "violating the letter of the
  rule is violating the spirit of the rule."

Where to test skills in this repo: write a scratch scenario under
`/tmp/opencode/` and dispatch `subagent({ subagent_type: "forager-worker" })`
with it. Never commit the scratch file.

### Phase 5: Create

Once approved:

1. Create directory: `packages/opencode-hive/skills/<skill-name>/`
2. Write `SKILL.md` with the content
3. Run `bun run generate-skills` to regenerate
   `src/skills/registry.generated.ts` — the build does this too, but running
   it directly shows you a broken frontmatter immediately
4. Add a test in `src/skills/skill-content.test.ts` if the skill's wording is
   load-bearing (a required tool name, a required phrase)

## Key Principles

- **One skill, one job** - Don't combine unrelated tasks
- **Concrete over abstract** - Specific steps beat general guidance
- **Anti-patterns matter** - Show what NOT to do
- **Examples from codebase** - Use real files and patterns
- **Untested skills are drafts** - You saw the failure before you wrote the fix

## Quality Checklist

Before creating the skill, verify:

- [ ] Name is kebab-case and descriptive
- [ ] Description starts with "Use when", names the trigger and the change
- [ ] You watched an agent fail without the skill (discipline skills)
- [ ] Overview explains why it matters
- [ ] When to Use has clear triggers
- [ ] The Pattern has step-by-step instructions
- [ ] Rationalization table exists for anything an agent would skip
- [ ] Verification shows how to confirm it worked
- [ ] Ran `bun run generate-skills` and added a content test if wording is load-bearing

## Example Output

```markdown
---
name: api-error-handling
description: "Use when implementing API error responses - teaches consistent error format, status codes, and error logging"
---

# API Error Handling

## Overview

Consistent error handling across APIs prevents confusion and enables better debugging.

## When to Use

- Implementing new API endpoints
- Adding error handling to existing endpoints
- Debugging error response issues

## The Pattern

### 1. Use Standard Error Format

All errors follow this structure:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human-readable description",
    "details": { "field": "reason" }
  }
}
```

### 2. Map Errors to Status Codes

- 400: Bad request / validation
- 401: Authentication required
- 403: Authorization failed
- 404: Resource not found
- 409: Conflict (duplicate, state)
- 500: Internal server error

### 3. Log Errors

Always log errors with context:
- Request ID
- User ID (if authenticated)
- Timestamp
- Stack trace (for 500s)

## Common Mistakes

❌ Returning raw database errors to clients
✅ Mapping to user-friendly messages

❌ Inconsistent error formats across endpoints
✅ Standard format everywhere

❌ Logging sensitive data in errors
✅ Logging context, not secrets

## Verification

Test error handling:
1. Trigger each error type
2. Verify response format matches standard
3. Verify error is logged with context
4. Verify no sensitive data in response
```
