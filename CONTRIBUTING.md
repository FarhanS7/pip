# Contributing to Pip

## Branch Convention
- `main` — production only, never commit directly
- `dev` — integration branch
- `feature/[module]/[task]` — one branch per task

## Commit Convention
Format: `type(scope): description`
Types: feat, fix, test, refactor, docs, chore
One subtask = one commit. No bundling.

## Code Review
- Writer model never reviews in the same session
- Review model: always Claude Opus 5, always new session
- 2-3 review cycles per task
