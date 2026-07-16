---
name: senior-fst-review
description: Senior specialist review for FST/FSD/Feature-Sliced frontend architecture. Use when asked to review code, diffs, plans, folder structure, feature boundaries, shared/entity/feature layering, route thinness, ownership, dependency direction, or architectural simplicity in Feature-Sliced-style projects.
---

# Senior FST Review

## Purpose

Run a senior architecture review focused on Feature-Sliced-style frontend structure. Treat "FST" and "FSD" as the same family unless project docs define them differently.

## Review Workflow

1. Identify the artifact: diff, files, PR, plan, folder tree, or implementation notes.
2. Read local architecture rules first when available: `AGENTS.md`, `docs/*architecture*`, `docs/*conventions*`, package aliases, and existing nearby modules.
3. State assumptions only when they affect the result. If FST/FSD meaning is unclear and local docs do not resolve it, say so.
4. Review from highest-risk architecture issues to low-risk maintainability issues.
5. Prefer no finding over speculative finding. Every issue needs concrete evidence.
6. Keep fix advice minimal and compatible with current project style.

## Review Checklist

Check ownership:

- Routes/pages stay thin: URL params, loaders/actions, auth redirects, metadata, lazy boundaries.
- Business flows live in `features/*`, grouped by domain and user task.
- Domain types, selectors, normalization, and small domain helpers live in `entities/*`.
- Reusable UI primitives and generic libraries live in `shared/*`.
- `shared/ui` has no business vocabulary or domain-specific behavior.
- Code that changes together stays together unless reused or independently owned.

Check dependencies:

- Lower layers do not import upper layers.
- Shared code does not import entities/features/app.
- Entities do not import features.
- Features do not depend on sibling feature internals unless project has an explicit public API pattern.
- Public exports are intentional; avoid leaking implementation folders.

Check boundaries:

- Avoid global product-component dumps.
- Avoid making every small control a feature.
- Avoid domain logic hidden in generic UI components.
- Avoid duplicated business rules across routes/components/hooks.
- API clients keep business endpoint language in feature/entity API modules; components do not call low-level transport directly unless project docs allow it.

Check simplicity:

- No abstraction for one use.
- No speculative configurability.
- No broad refactor attached to narrow request.
- Naming matches ownership and current domain language.
- Proposed fixes touch the fewest files that solve the architectural problem.

## Output Format

For reviews, lead with findings:

```md
## Findings

1. [Severity] `path:line` - Problem. Why it violates FST/FSD or project rules. Minimal fix.

## Open Questions

- Question only if it changes the conclusion.

## Summary

Short architecture assessment and verification limits.
```

Use severity labels: `High`, `Medium`, `Low`. Omit empty sections except say `No findings.` when clean.

For plan analysis, use:

```md
## Architecture Risks

1. [Severity] Risk. Why. Simpler alternative.

## Recommended Shape

Minimal target ownership/folder/API shape.

## Open Questions

- Only blockers.
```

## Line Comments

When the host expects inline review comments, use them only for concrete line-specific findings:

```md
::code-comment{file="src/features/example/ui/Widget.tsx" line=42}
Business-specific `payout` behavior lives in `shared/ui`. Move it under the owning feature and keep shared primitive generic.
::
```

Do not use inline comments for broad summaries.
