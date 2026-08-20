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
description: "Short description shown in available_skills list"
---

# Skill Title

## Overview

What this skill does and why it matters.

## When to Use

Clear triggers for when agents should load this skill.

## The Pattern

Step-by-step instructions for the skill workflow.

## Common Mistakes

Anti-patterns to avoid.

## Verification

How to verify the skill worked correctly.
```

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

### Phase 4: Create

Once approved:

1. Create directory: `packages/opencode-hive/skills/<skill-name>/`
2. Write `SKILL.md` with the content
3. Build to auto-register: `bun run build`
4. Verify in registry: check `registry.generated.ts`

## Key Principles

- **One skill, one job** - Don't combine unrelated tasks
- **Concrete over abstract** - Specific steps beat general guidance
- **Anti-patterns matter** - Show what NOT to do
- **Examples from codebase** - Use real files and patterns

## Quality Checklist

Before creating the skill, verify:

- [ ] Name is kebab-case and descriptive
- [ ] Description is one sentence, clear trigger
- [ ] Overview explains why it matters
- [ ] When to Use has clear triggers
- [ ] The Pattern has step-by-step instructions
- [ ] Common Mistakes shows anti-patterns
- [ ] Verification shows how to confirm it worked

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
