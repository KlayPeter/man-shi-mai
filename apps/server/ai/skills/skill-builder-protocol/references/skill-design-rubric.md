# Skill Design Rubric

Use this rubric before packaging or sharing a skill.

## 1. Trigger Quality

Score 0-3:

- 0: description is vague or generic
- 1: says what the skill does but not when to use it
- 2: includes task, trigger contexts, and some user phrases
- 3: includes task, trigger contexts, user phrases, domains, file types, tools, and exclusion boundaries

Checklist:

- Does the description contain likely user words?
- Would another agent know when to invoke it without reading the body?
- Are trigger conditions in frontmatter, not hidden in the body?

## 2. Workflow Clarity

Score 0-3:

- 0: broad advice only
- 1: partial process
- 2: clear steps with most branches
- 3: explicit decision tree with fallback and stop conditions

Checklist:

- Is the first action obvious?
- Are materially different paths separated?
- Does the skill say when to ask a clarifying question and when to proceed?

## 3. Context Efficiency

Score 0-3:

- 0: dumps all knowledge into `SKILL.md`
- 1: some long sections that are not always needed
- 2: most details are split into references
- 3: main file is compact, and every reference has a loading condition

Checklist:

- Is `SKILL.md` a control plane rather than a textbook?
- Are long checklists or variants moved to `references/`?
- Are references one level deep?

## 4. Output Contract

Score 0-3:

- 0: no clear final deliverable
- 1: loose output description
- 2: output format is specified
- 3: output format, validation, filenames, citations, assumptions, and error handling are specified

Checklist:

- Can the agent tell when the task is done?
- Are required files or formats named?
- Are quality checks included?

## 5. Execution Reliability

Score 0-3:

- 0: relies entirely on model memory for fragile operations
- 1: gives manual steps for deterministic work
- 2: uses scripts/templates where useful
- 3: scripts are documented, tested, and constrained

Checklist:

- Should any repeated exact operation be scripted?
- Are scripts documented with inputs and outputs?
- Are placeholder files removed?

## 6. Maintainability

Score 0-3:

- 0: hard to edit or extend
- 1: understandable but cluttered
- 2: organized sections and references
- 3: modular, named, and easy to improve from observed failures

Checklist:

- Can a future editor find the right section quickly?
- Are examples realistic but short?
- Is there an iteration path for missed triggers, wrong branches, and output drift?

## Passing Standard

A production-ready skill should score at least 14/18, with no zero in Trigger Quality, Workflow Clarity, or Output Contract.
