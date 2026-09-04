# AI_AGENT_GUIDE.md

> Operating Manual for AI Development Agents working on **Wager**.

## Mission

Build **Wager** as a production-quality MVP. Prioritize correctness,
maintainability, performance, and user experience.

## Before Every Task

1.  Read `PROJECT.md`.
2.  Read `PROJECT_STATE.md`.
3.  Treat `PROJECT.md` as the source of truth.
4.  Implement one feature at a time.

## Mandatory Rules

- Never rewrite unrelated files.
- Never duplicate business logic.
- Reuse existing components.
- Use strict TypeScript.
- Prefer Server Components.
- Keep Client Components minimal.
- Avoid unnecessary dependencies.
- Build only what is requested.

## Development Workflow

1.  Understand the task.
2.  Identify affected files.
3.  Make the smallest required changes.
4.  Run type check, lint, and build.
5.  Fix all errors before stopping.
6.  Update `PROJECT_STATE.md`.
7.  Summarize completed work.

## Debugging Rules

- Read the complete error.
- Find the root cause.
- Fix the underlying issue instead of masking it.
- Verify no regressions.

## Documentation

After every completed feature:

- Update `PROJECT_STATE.md`.
- Record modified files.
- Record known bugs.
- Record the next recommended task.

## Definition of Done

A feature is complete only when:

- It works as specified.
- Build succeeds.
- TypeScript passes.
- Lint passes.
- Documentation is updated.

## Session Closing

Always provide:

- Summary
- Files modified
- Bugs fixed
- Remaining issues
- Next recommended task

If any instruction conflicts with `PROJECT.md`, follow `PROJECT.md`.
