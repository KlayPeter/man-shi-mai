# Reusable SKILL.md Template

Copy this template when creating a new skill. Replace bracketed text.

```markdown
---
name: [lowercase-hyphenated-name]
description: [what this skill does]. use when the user asks to [specific trigger phrases, task types, file types, tools, or contexts]. do not use when [optional exclusion if important].
---

# [Human Readable Skill Name]

## Core Principle

[One sentence that prevents misuse. Example: Treat this skill as a workflow manual, not a brainstorming prompt.]

## Workflow

1. [First action]
2. [Second action]
3. [Third action]

## Decision Tree

Classify the request:

- **[Branch A]**: [condition] -> [workflow]
- **[Branch B]**: [condition] -> [workflow]
- **[Branch C]**: [condition] -> [workflow]

If a required input is missing:

- proceed with a stated assumption when the missing detail does not materially change the output
- ask one concise question when the missing detail changes the workflow or deliverable

## Output Contract

Return:

- [deliverable 1]
- [deliverable 2]
- [validation or citations if required]

Use this format:

[format template]

## Quality Checks

Before answering, verify:

- [check 1]
- [check 2]
- [check 3]

## References

Read only when relevant:

- `references/[file].md`: [loading condition]
```

## Template Notes

- Keep trigger conditions in the frontmatter description.
- Keep examples short and realistic.
- Do not include generic ChatGPT behavior.
- Use imperative instructions.
- Split large details into references.
