---
name: senior-simplify-review
description: Review a user-specified artifact, branch, diff, implementation, plan, document, or decision for unnecessary complexity and missed simplifications. Use when the user asks to check something with prompts like "Проверь ... смотри на то, что можно упростить" or asks whether a senior developer would leave the current approach so complex.
---

# Senior Simplify Review

Use this skill to perform a simplicity-focused review of the artifact the user names after "Проверь ...".

## Workflow

1. Identify the review target exactly. If the target is ambiguous and cannot be discovered from local context, ask a concise clarifying question.
2. Read the relevant source before judging. For code, inspect the current diff and surrounding implementation, not only the changed lines.
3. Ask the core question explicitly: would a senior developer keep this complexity, or is there a simpler way with the same behavior?
4. Separate real simplifications from taste. Recommend changes only when they remove meaningful complexity, duplication, dead code, weak tests, noisy abstractions, or confusing control flow.
5. Prefer surgical fixes. Do not propose broad rewrites, new frameworks, generic abstractions, or adjacent cleanup unless they directly simplify the reviewed target.
6. Verify any edits with the narrowest relevant checks. If reviewing only, state what was and was not verified.

## Review Output

Lead with concrete findings. For each finding, include:

- Location: file and line when available.
- Problem: why the current shape is more complex than needed.
- Simpler version: the smallest change that preserves behavior.
- Risk: what could break if simplified incorrectly.

If no simplification is warranted, say that directly and name any remaining tradeoff.

## Editing Rule

When the user asks to implement the simplification, make the smallest coherent change and remove only complexity related to the review target. Preserve existing style and behavior unless the simplification requires a behavior change the user approved.
