---
name: brainstorming
description: Use before building anything whose shape is still unsettled - features, components, behaviour changes, or a request that leaves a real decision open - and stops the agent from interrogating a request that was already complete
---

# Brainstorming

You build what you believe your user wants, and that belief is usually
thinner than it feels. This skill is for finding out what they actually
want, and why, before anything is built.

**Core principle:** People often haven't finished working out what they
want. Good questions help them finish. Bad questions are an interrogation.

## First: What Do You Actually Know?

Before replying, answer this: what do I know about what they want, and why?

- **Everything that matters is in the request** — "make the icon cornflower
  blue", "rename this field", "fix the typo in the error message". The
  decision is already made. Do it, say what you did. Loading this skill and
  then asking three questions about a decided request wastes their time and
  is a failure of this skill, not proof of diligence.
- **Something non-trivial is missing** — who it's for, what "done" means,
  which of two plausible readings is meant, or a constraint that would
  change the design. Start the conversation.

The line is whether a wrong guess would cost them real rework. Below that
line, act. Above it, ask — once, well.

## Look Before You Ask

Never ask what the project already answers. Read first:

- `.hive/features/` — is there an existing feature, plan, or context file
  covering this? `hive_status()` for where work stands.
- The code the change touches, and enough around it to explain how it works
  today.
- Recent commits and any `AGENTS.md` conventions that constrain the answer.

Then your first message can be specific instead of generic. "Should the
retry live in the client or the wrapper?" beats "can you tell me more about
your architecture?"

## The Conversation

**One question per message.** Not a list, not a menu of five, not four
questions with an "and". One.

**Say what the answer would change.** A question with a stated consequence
gets a real answer:

> "Are these runs one-off or monthly? If monthly, the schedule has to survive
> a machine restart, which changes where the state lives."

**Make it specific to what they told you.** Build each question on their last
answer or on something you read. The Socratic move — surfacing a case they
haven't considered — is where the value is:

> "Voting closes before the meeting, and two members joined this month. Does
> someone who joins mid-round get a vote?"

**Get them describing before you offer options.** Their own words carry
intent that your option list cannot. Offer a short menu only when they're
stuck or explicitly ask for one. Use the `question()` tool when a choice is
genuinely between 2-4 named things; use prose when the answer needs to be
theirs.

**Cover the ground, don't read the script.** Territory, not a checklist:

- what this is, and what makes it different from the obvious version
- why now — what broke, what changed, what they're trying to stop doing
- success: what they'd point at in a month and call it working
- anti-goals: what would make this a failure even if it technically runs
- prior art: what they've seen elsewhere and liked or hated
- what exists today, and what they already tried

**How it gets built.** Platform, language, libraries, where code lives: find
out early which of those they want to decide, which they're handing to you,
and what already exists. In an existing codebase, follow what it already
uses. Any choice you make alone goes in the design as *your* proposal with a
reason — never as something they agreed to.

**Offer to go look.** When deeper investigation would sharpen the design —
their code, their data, an external API, prior art — offer it and say what
you'd look for. They decide whether you spend the time.

**Play it back as you go.** As soon as one part is clear enough to describe,
describe it back in 200-300 words and ask what's wrong or missing. Playback
and questions alternate; the last chunk covers what's left. Only what they
said goes in as theirs. What you filled in is labeled as your call.

## Lay Out the Approaches

Once you understand *what* they want, and before writing the design, put the
ways of building it in a message of its own:

1. Generate several real alternatives; drop the weak ones, the ones that
   work against why they want it, and the ones the existing code rules out.
2. Present the two or three that remain. Ground each in what the project
   actually does. Name what it trades off.
3. Recommend one and say why.
4. Ask which way they want to go.

When there is genuinely one sensible way, say so and explain why the others
don't fit — that is more useful than a fake choice.

## Then Write It Down

Once the design is agreed:

- `hive_feature_create` if this is a new feature, then `hive_plan_write` with
  the design as the plan's context section. Hive's plan file (under
  `.hive/features/<feature>/plan.md`) **is** the design document — do not
  scatter a second copy under `docs/plans/`.
- Decisions with a reason behind them go in `hive_context_write` (e.g.
  `decisions.md`), so a later session can tell "the user chose this" from
  "the agent assumed this".
- Then `hive_skill("writing-plans")` to turn the design into tasks.

## When They Didn't Ask For a Conversation

If the user said "build X" and did not ask for a design discussion, your
first message still ends with one question — but add one line offering to
skip it:

> "Or if you'd rather I just get started, say so."

If they take that offer: state any significant how-it-gets-made choice in one
plain line ("going with a JSON file, no database"), then build. That is the
opt-out working, not the skill failing.

## Red Flags

| Thought | Reality |
|---|---|
| "I should ask about everything to be thorough" | Four questions is an interrogation. One, then react. |
| "The request is clear but I'll confirm scope" | If it's clear, confirming is stalling. Build it. |
| "I'll ask about approach and requirements in one message" | Approach comes after requirements. Two messages. |
| "They'll tell me if I'm wrong" | They can only correct what they can see. Play it back. |
| "I'll write the design first, questions later" | Then you're asking them to review a guess. |
| "Options first, it's faster" | Options anchor them before you know what they want. |

## Verification

This skill ran correctly if:

- [ ] Every question's answer changed something about what gets built
- [ ] No question asked what the code, plan, or their request already answered
- [ ] Approaches were presented in their own message, with a recommendation
- [ ] Each design chunk was played back before building on it
- [ ] The design lives in the Hive plan, not in a stray `docs/plans` file
