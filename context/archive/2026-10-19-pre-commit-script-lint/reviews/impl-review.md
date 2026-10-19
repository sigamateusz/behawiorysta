<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: Lint staged scripts in pre-commit

- **Plan**: context/changes/pre-commit-script-lint/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1
- **Date**: 2026-10-19
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 1 warning, 0 observations

## Verdicts

| Dimension           | Verdict |
| ------------------- | ------- |
| Plan Adherence      | WARNING |
| Scope Discipline    | PASS    |
| Safety & Quality    | PASS    |
| Architecture        | PASS    |
| Pattern Consistency | PASS    |
| Success Criteria    | PASS    |

## Findings

### F1 — Git commit does not run the Husky hook

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Adherence
- **Location**: package.json:5
- **Detail**: The lint-staged contract matches the plan. `*.{js,mjs,cjs}` is exactly `["eslint --fix"]`, the view and Prettier entries are unchanged, and `.husky/pre-commit` is still `npx lint-staged`. `git commit` still does not invoke that file. `core.hooksPath` is unset, `.git/hooks/pre-commit` does not exist, and `package.json` scripts have no `prepare` entry. `husky@9.1.7` is only a devDependency. This wiring was already missing at `61f5786`; the diff did not remove it. The phase checks read the hook file and the user proved `npx lint-staged` repairs a staged `.mjs`. They do not prove that `git commit` runs Husky. That is why a commit of blank lines succeeded before `npx lint-staged` was invoked directly.
- **Fix A ⭐ Recommended**: Add `"prepare": "husky"` and run `npx husky` so Git's `core.hooksPath` points at `.husky`.
  - Strength: `git commit` then runs the existing `npx lint-staged` hook, which is the plan's desired end state.
  - Tradeoff: Touches `package.json` outside the planned lint-staged key and sets a local Git config. The plan forbade editing `.husky/pre-commit`, not installing the hook.
  - Confidence: HIGH — Husky 9 documents `prepare` as the way `npm install` sets `core.hooksPath`.
  - Blind spot: Have not re-run a `git commit` after wiring, so the hook's interaction with the two local verification commits is untested.
- **Fix B**: Leave the checkout unwired and treat `npx lint-staged` as the proven gate.
  - Strength: Stays inside the reviewed phase. The config contract and the manual `npx lint-staged` run already match the plan.
  - Tradeoff: `git commit` keeps skipping ESLint for every glob, including the views that were already supposed to be gated.
  - Confidence: HIGH — the missing `core.hooksPath` was observed in this checkout.
  - Blind spot: None significant.
- **Decision**: FIXED via Fix A. Verified with `git hook run pre-commit` on a syntax error in `scripts/check-view-tokens.mjs`: `eslint --fix` failed, the hook exited 1, and the file was restored.
