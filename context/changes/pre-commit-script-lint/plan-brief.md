# Lint staged scripts in pre-commit — Plan Brief

> Full plan: `context/changes/pre-commit-script-lint/plan.md`

## What & Why

A script can be committed without ESLint even though CI already runs `eslint .`. Pre-commit should lint staged `*.{js,mjs,cjs}` the same way it already lints views, and it should not grow into the slow gates.

## Starting Point

`.husky/pre-commit` runs `npx lint-staged`. ESLint `--fix` plus the view-token script run for `*.{ts,tsx,astro}` only. Five JavaScript sources are already clean under `eslint`. There is no `*.cjs` file and no pre-push hook.

## Desired End State

Committing a staged `.js`, `.mjs`, or `.cjs` file runs `eslint --fix` on it. Committing a view still runs ESLint and the token check. `astro check` and `npm test` still wait for CI, or for someone to run them by hand.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) |
| --- | --- | --- |
| Where the check lives | New `lint-staged` key `*.{js,mjs,cjs}` | The existing view key also runs the token script, which must not run for a script-only commit |
| Command | `eslint --fix` only | Matches the current commit entry and `npm run lint:fix` |
| Hook file | Leave `.husky/pre-commit` as `npx lint-staged` | The behavior change is the config, not a second hook |
| `.cjs` | Include it | The change notes name that extension, even though no such file exists yet |
| Heavy gates | Off this change | `astro check` and `npm test` were explicitly kept out of pre-commit |
| Proof | Three config assertions plus one manual lint-staged run | No existing test covers lint-staged, and a new suite is out of scope |

## Scope

**In scope:**

- `package.json` `lint-staged` entry `*.{js,mjs,cjs}` → `eslint --fix`
- Proof that a staged `.mjs` is linted and that the token script does not start

**Out of scope:**

- `astro check`, `npm test`, smoke, build
- A pre-push hook
- View-token checks on JavaScript
- Editing the TypeScript/Astro or Prettier entries
- Linting `.cursor/**`
- A new unit test

## Architecture / Approach

Husky keeps calling lint-staged. lint-staged gains one glob. ESLint's existing ignore rules still skip `.cursor/**`; an explicit ignored file warns and exits 0, so hook scripts do not block the commit.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Extend lint-staged | JavaScript is ESLint-fixed on commit; view tokens stay on views | Folding the new extensions into the view glob would run the token script on every script commit |

**Prerequisites:** None. The five current JavaScript sources already pass `eslint`.
**Estimated effort:** One short session, one phase.

## Open Risks & Assumptions

- A staged file under `.cursor/` matches the new glob and ESLint ignores it with a warning and exit 0. The commit succeeds. That matches CI.
- A JavaScript file that fails ESLint will now fail the commit. That is the point of the change; CI would have failed the same file.

## Success Criteria (Summary)

- The new lint-staged entry is exactly `eslint --fix`.
- The view entry and the Husky command are unchanged.
- A staged `scripts/check-view-tokens.mjs` makes lint-staged run ESLint and not the token script.
