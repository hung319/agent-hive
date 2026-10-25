---
name: source-driven-development
description: Use when writing code against a library, API, or CLI whose behaviour you have not read in this session - requires checking real documentation first and recording where you checked, instead of writing from memory and finding out at runtime
---

# Source-Driven Development

Your memory of a library is a summary of an older version of it. Functions
get renamed, defaults change, options are added, return shapes move. The code
you write from memory compiles and fails later.

**Core principle:** Before an API call you have not verified this session,
find the documentation or the source, and say where you found it.

## When This Applies

- Calling a library function whose signature or return shape you are not
  certain of
- Using a CLI flag you have not run
- Writing a config file for a tool whose schema you have not read
- Deprecating, upgrading, or porting code around a dependency

**When it does not:** you already ran the call in this session and saw it
work, or the API is part of the language itself.

## The Check, In Order

1. **`context7_query-docs`** for third-party library documentation. This is
   the cheapest reliable source and the one Hive already has wired.
2. **The installed package itself**, when docs are thin: read the `.d.ts` or
   the export list under `node_modules/<pkg>/`. The types are what the
   compiler enforces, so a call that type-checks against them is not a guess.
3. **`grep_app_searchGitHub`** for how other projects call it, especially for
   the version in use. Real usage shows the options people actually need.
4. **`websearch_web_search_exa`** last, for changelogs, migration guides, and
   "what replaced X".

## Record It

For every non-trivial external behaviour, one line in your reply or the
commit summary:

> `simple-git` 4 moved parsed git responses to `error.git`; checked the
> upstream release notes for 4.0.0.

The record is what makes a later reader able to tell "verified" from
"guessed", and it is what makes a version bump safe to review.

## When You Cannot Verify

Say so, plainly, at the point of use:

> Unverified: the `retry` option may be `retries` in this version — the docs
> page did not load and the installed types do not declare it.

Then either find another source or pick the call you *can* verify. What you
must not do is present a guess in the same voice as a checked fact; the
reader has no way to tell them apart, and neither will you in a week.

## The Upgrade Case

A dependency major-version bump is exactly where this skill earns its keep.
Before merging one:

1. Read the changelog's breaking section.
2. Search the codebase for every call into the changed API.
3. For each, decide: unchanged, needs a code change, or behaviour changed
   silently (the dangerous one).
4. If tests do not cover the changed behaviour, either add them or state
   that the upgrade rests on review alone.

Silent behaviour changes are the ones that ship: the code still calls the
same function, still compiles, still passes tests that never exercised the
moved data. A green suite is not evidence that a major upgrade was safe; it
is evidence that nothing the suite covers broke.

## Verification

This skill ran correctly if:

- [ ] No API call was written against an unread interface without the source
      being named
- [ ] Every verified external behaviour has its source noted
- [ ] Anything unverified is labelled unverified where it is used
- [ ] A dependency major bump had its breaking changes read and its call
      sites checked, not just its tests run
