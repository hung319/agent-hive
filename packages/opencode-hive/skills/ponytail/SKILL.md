---
name: ponytail
description: |
  Lazy senior dev philosophy - write only what's truly needed. Decision ladder before writing any code.
  Use when: writing new code, implementing features, adding functionality, fixing bugs, creating components.
  Triggers: implement, create, add, write, fix, build, feature, component, utility, helper.
---

# Ponytail - Lazy Senior Dev Philosophy

## The Decision Ladder

Before writing ANY code, ask these questions in order:

```
1. Does this need to exist?   → no: skip it (YAGNI)
2. Already in this codebase?  → reuse it
3. Stdlib does it?            → use it
4. Native platform feature?   → use it
5. Installed dependency?      → use it
6. One line?                  → one line
7. Only then: the minimum that works
```

## Rules

### 1. YAGNI (You Aren't Gonna Need It)
- If you can't prove it's needed NOW, don't build it
- Future requirements are not current requirements
- "We might need this later" = don't build it

### 2. Reuse First
- Search the codebase for existing implementations
- Check if a function already does what you need
- Look for similar patterns before writing new ones

### 3. Stdlib Over Custom
- Use built-in language features before writing utilities
- Check if the language has a built-in solution
- Prefer `Array.prototype.reduce` over custom accumulator

### 4. Native Over Dependencies
- Use platform APIs before installing packages
- Check if the runtime has native support
- Prefer `fetch` over axios for simple HTTP

### 5. Dependencies Over Custom
- Use well-maintained libraries for complex logic
- Don't reinvent the wheel for algorithms
- Check npm/pip/cargo for existing solutions

### 6. One Line Over Many
- If it can be a one-liner, make it a one-liner
- Prefer arrow functions for simple operations
- Use destructuring and spread syntax

### 7. Minimum Viable Code
- Write the simplest solution that works
- Don't over-engineer for edge cases that don't exist
- Ship working code, iterate later

## What You Never Sacrifice

- Security (validation, sanitization)
- Error handling
- Accessibility (for UI code)
- Type safety
- Readability

## Examples

### Bad: Over-engineered
```typescript
function validateEmail(email: string): { valid: boolean; reason?: string } {
  if (!email) return { valid: false, reason: 'Email is required' };
  if (typeof email !== 'string') return { valid: false, reason: 'Email must be a string' };
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) return { valid: false, reason: 'Invalid email format' };
  return { valid: true };
}
```

### Good: Minimum viable
```typescript
const validateEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
```

### Bad: Custom implementation
```typescript
function debounce<T extends (...args: any[]) => any>(fn: T, delay: number) {
  let timeoutId: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}
```

### Good: Use existing dependency
```typescript
import { debounce } from 'lodash';
// Or better: use native AbortController for cleanup
```

## Composable With

- **caveman** - Reduces prose, ponytail reduces code
- **rtk** - Reduces command output tokens
- Both work together for maximum efficiency
