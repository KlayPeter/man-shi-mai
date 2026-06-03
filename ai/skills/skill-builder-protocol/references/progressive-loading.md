# Progressive Loading Guide

Progressive loading keeps the active context small while preserving depth.

## Layer Model

### 1. Trigger Layer

Location: frontmatter `description`

Purpose:

- decide whether the skill should be invoked
- include user-facing words and likely phrases
- include file types, tools, domains, and tasks

Do not put trigger logic only in the body.

### 2. Control Layer

Location: `SKILL.md`

Purpose:

- define the primary workflow
- route branches
- state constraints
- point to references
- define output contract and quality gates

Keep it compact. It should tell the agent what to do next, not teach the entire domain.

### 3. Reference Layer

Location: `references/`

Use for:

- long checklists
- variant-specific instructions
- policy details
- domain examples
- schema documentation
- troubleshooting

Each reference should be linked directly from `SKILL.md` with a loading condition.

### 4. Execution Layer

Location: `scripts/`

Use for:

- validation
- file conversion
- extraction
- transformation
- deterministic calculations
- packaging or generation

If a script exists, tell the agent exactly when to run it.

### 5. Asset Layer

Location: `assets/`

Use for:

- templates
- logos
- boilerplate files
- static examples
- reusable output components

Assets are for use in outputs, not for reasoning unless specifically inspected.

## Split Decision Rules

Move content from `SKILL.md` into references when:

- it is not needed for every invocation
- it is a long checklist
- it is provider-specific
- it contains many examples
- it documents schemas, policies, or APIs
- it makes the main workflow harder to scan

Keep content in `SKILL.md` when:

- it changes the first action
- it changes routing
- it defines the output contract
- it prevents a common failure
- it must always be obeyed

## Common Reference Files

- `references/examples.md`
- `references/quality-rubric.md`
- `references/provider-aws.md`
- `references/provider-gcp.md`
- `references/schema.md`
- `references/troubleshooting.md`
- `references/output-templates.md`

## Anti-Patterns

Avoid:

- hiding invocation triggers in reference files
- making `SKILL.md` a complete textbook
- nesting references several levels deep
- adding scripts that are never called
- keeping placeholder files from initialization
- duplicating the same rule in multiple places
