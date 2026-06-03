---
name: skill-builder-protocol
description: create, critique, refactor, or improve chatgpt skills and claude-style skills as reusable agent operating manuals. use when the user asks to make a new skill, convert a workflow into a skill, write or review skill.md, decide whether a skill should be short or long, split instructions into references, design trigger descriptions, add decision trees, examples, failure handling, tools, scripts, assets, or quality checks for reliable repeatable agent behavior.
---

# Skill Builder Protocol

## Core Principle

Treat a skill as an agent operating manual, not a long prompt. Build it to make a repeatable task discoverable, executable, testable, and maintainable.

Prefer this operating model:

1. **trigger layer**: frontmatter description says what the skill does and when to invoke it.
2. **control layer**: `SKILL.md` gives the shortest reliable workflow, decision tree, constraints, and examples.
3. **reference layer**: detailed rules, checklists, schemas, edge cases, and examples live in `references/` and are loaded only when needed.
4. **execution layer**: deterministic or fragile operations live in `scripts/`; final-output templates and static files live in `assets/`.

## Workflow

### 1. Understand the reusable job

Ask only for missing information that blocks a useful first version. If the user's intent is already clear, make a best-effort skill.

Capture:

- expected user inputs
- expected outputs or deliverables
- target users and environment
- tools, connectors, files, or scripts involved
- examples of successful use
- examples of failure or ambiguity
- formatting, tone, safety, compliance, or business constraints

Convert vague requests into concrete examples before writing instructions.

### 2. Decide whether this should be a skill

Create a skill only if the task is repeatable and benefits from persistent conventions. Do not create a skill for a one-off answer unless the user explicitly wants a reusable workflow.

A strong skill candidate has at least two of these:

- repeated multi-step process
- domain-specific rules ChatGPT should not rediscover each time
- standard output format
- tool or connector usage protocol
- fragile file, code, or data operations
- organization, brand, compliance, or quality constraints
- branching logic where the agent should not guess

### 3. Design the skill architecture

Use this decision tree:

- If the task has a fixed sequence, use a workflow-based `SKILL.md`.
- If the task has several independent operations, use a task-based `SKILL.md`.
- If the task is mostly standards or style, use a guideline-based `SKILL.md`.
- If the task depends on many domains, providers, file types, or variants, keep `SKILL.md` short and split details into `references/`.
- If repeated exact operations are required, add `scripts/` and require running them.
- If reusable output files are required, add `assets/`.

Keep `SKILL.md` as the control plane. Move large detail into references before it becomes a knowledge dump.

### 4. Write high-signal frontmatter

The `description` is the trigger. It must include:

- what the skill does
- when to use it
- user phrases or task types that should activate it
- relevant file types, tools, domains, or deliverables

Do not hide trigger conditions in the body, because the body is only read after the skill is selected.

Bad:

```yaml
description: helps with documents
```

Better:

```yaml
description: create, edit, review, and transform professional docx documents while preserving structure, headings, comments, tracked changes, tables, and formatting. use when the user asks to draft a document, modify an uploaded docx, compare versions, clean comments, normalize styles, or produce a polished report.
```

### 5. Write the `SKILL.md` body

Use imperative instructions. Include only non-obvious guidance that improves reliability.

Recommended structure:

```markdown
# Skill Name

## Core Principle
One sentence that prevents the most common misuse.

## Workflow
Step-by-step process or decision tree.

## Branches
Different paths for materially different task types.

## Output Contract
Required deliverables, format, citations, files, or validation.

## Quality Checks
What must be true before answering.

## References
Read only the relevant reference file when needed.
```

Write branches explicitly. Do not make the agent infer important paths.

Example branch style:

```markdown
1. Classify the request:
   - New artifact? Follow creation workflow.
   - Edit existing artifact? Inspect existing file first, then follow edit workflow.
   - Review only? Do not rewrite; return issues and recommendations.
2. If inputs are missing but the task can proceed, make a reasonable assumption and state it.
3. If the missing input changes the deliverable materially, ask one concise question.
```

### 6. Add progressive-loading references

Use `references/` for content that is useful but not always needed:

- deep checklists
- rubrics
- schema docs
- prompt or output templates
- examples by domain
- troubleshooting
- provider-specific instructions
- long edge-case guidance

In `SKILL.md`, link each reference with its loading condition:

```markdown
## References
- For trigger writing and naming, read `references/trigger-design.md`.
- For splitting long skills, read `references/progressive-loading.md`.
- For final review, read `references/quality-rubric.md`.
```

Avoid nested reference chains. Keep references one level away from `SKILL.md`.

### 7. Use scripts only for deterministic work

Add scripts when correctness depends on repeatable execution, such as validation, conversion, extraction, packaging, or batch processing.

Do not add scripts just to summarize or reason over text; ChatGPT can do that directly.

When adding a script:

- place it in `scripts/`
- document when to run it
- define inputs and outputs
- test it before packaging
- prefer clear CLI arguments and deterministic output

### 8. Define the output contract

Every skill should specify how completion looks.

Include any relevant requirements:

- final answer format
- generated files and filenames
- citations or grounding rules
- validation commands
- error handling
- assumptions to disclose
- when to ask a question instead of proceeding

### 9. Add quality gates

Before finalizing a skill, check:

- the name is lowercase and hyphenated
- frontmatter has only `name` and `description`
- description clearly triggers the skill
- `SKILL.md` is short enough to scan and use
- branches are explicit
- examples are realistic and short
- references are linked with loading conditions
- scripts, if any, are tested
- placeholder files are removed
- final package is under upload size limits

### 10. Iterate from real usage

After the skill is used, improve it from observed failures:

- missed invocation: improve description trigger terms
- wrong path: add branch conditions
- inconsistent output: tighten output contract
- hallucinated facts: require source inspection or citation
- repeated manual work: add script or template
- bloated context: move detail into references

## Length Policy

Long is acceptable only when it reduces ambiguity. Long is bad when it buries the rule the agent actually needs.

Use this split rule:

- under 150 lines: simple workflow or convention
- 150-500 lines: complex workflow with branches and examples
- over 500 lines: split into references unless every section is always needed
- over 1000 lines: require a table of contents and strong justification, or refactor

A good skill is not the longest instruction. A good skill makes the agent do the right thing with the least necessary context.

## References

Read these only when relevant:

- `references/skill-design-rubric.md`: final review rubric and scoring checklist.
- `references/skill-md-template.md`: copyable `SKILL.md` template for new skills.
- `references/progressive-loading.md`: how to split long skills into `SKILL.md`, references, scripts, and assets.
