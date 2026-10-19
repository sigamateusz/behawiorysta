# Lint staged scripts in pre-commit Implementation Plan

## Overview

Pre-commit already runs lint-staged, but only for `*.{ts,tsx,astro}`. Staged JavaScript can land without the ESLint pass that CI already applies. This change adds that pass for `*.{js,mjs,cjs}` and leaves the heavier local gates off the commit hook.

## Current State Analysis

`.husky/pre-commit` is a single command, `npx lint-staged`. The `*.{ts,tsx,astro}` entry runs `eslint --fix` and then `node scripts/check-view-tokens.mjs`. `*.{json,css,md}` is formatted with Prettier. CI runs `npm run lint`, which is `eslint .` plus the view-token script, so JavaScript is already gated on pull requests.

The JavaScript sources ESLint includes today are `eslint.config.js`, `astro.config.mjs`, `scripts/smoke.mjs`, `scripts/check-view-tokens.mjs`, and `scripts/agent-hooks.test.mjs`. `eslint` on those five files exits 0. There are no `*.cjs` sources. `.cursor/**` is ignored by ESLint; passing an ignored file explicitly prints a warning and still exits 0, so a staged hook script would not fail the commit.

## Desired End State

Staging a `.js`, `.mjs`, or `.cjs` file and committing runs `eslint --fix` on that file through the existing Husky hook. A TypeScript, TSX, or Astro commit still runs both ESLint and the view-token check. `astro check` and `npm test` still do not run on commit.

### Key Discoveries:

- Commit lint is `package.json` `lint-staged` (`*.{ts,tsx,astro}` pairs `eslint --fix` with `node scripts/check-view-tokens.mjs`), invoked from `.husky/pre-commit`.
- CI already lints the same non-ignored JavaScript via `eslint .` (`.github/workflows/ci.yml` job `ci`).
- `scripts/**/*.mjs` is the ESLint scripts override (`eslint.config.js` `scriptsConfig`): type-aware rules off, `no-console` off.
- The view-token script always scans its fixed view list and ignores the filename lint-staged passes. It must stay off the new JavaScript entry.
- Archive plan `context/archive/2026-10-06-ui-tokens-onboarding/plan.md` already treats lint-staged as the commit gate for ESLint and the token script.

## What We're NOT Doing

- Adding `astro check`, `npm test`, smoke, or build to the commit hook.
- Adding a pre-push hook.
- Running `scripts/check-view-tokens.mjs` when the staged set is only JavaScript.
- Changing the `*.{ts,tsx,astro}` or `*.{json,css,md}` entries.
- Changing `.husky/pre-commit`.
- Making ESLint lint `.cursor/**`.
- Adding a new test file for the lint-staged config.

## Implementation Approach

Add a separate `lint-staged` key for `*.{js,mjs,cjs}` whose only command is `eslint --fix`. A separate key keeps the view-token script on the view glob. `--fix` matches the existing commit entry and `npm run lint:fix`. The glob includes `.cjs` even though none exist yet, because the change notes name that extension. Husky stays a one-line call to lint-staged.

## Phase 1: Extend lint-staged

### Overview

Staged JavaScript gets the same ESLint fix pass CI already runs, without pulling view-token checks or the slow gates onto every commit.

### Changes Required:

#### 1. lint-staged JavaScript entry

**File**: `package.json`

**Intent**: Close the gap where a staged script skips the ESLint pass that `npm run lint` already enforces, without attaching the view-token scan to script-only commits.

**Contract**: `lint-staged["*.{js,mjs,cjs}"]` is exactly `["eslint --fix"]`. `lint-staged["*.{ts,tsx,astro}"]` stays `["eslint --fix", "node scripts/check-view-tokens.mjs"]`. `lint-staged["*.{json,css,md}"]` stays `["prettier --write"]`. `.husky/pre-commit` stays `npx lint-staged`.

### Success Criteria:

#### Automated Verification:

- JavaScript lint-staged entry is only `eslint --fix`: `node -e "import fs from 'node:fs'; const p=JSON.parse(fs.readFileSync('package.json','utf8')); const got=p['lint-staged']['*.{js,mjs,cjs}']; if (JSON.stringify(got)!==JSON.stringify(['eslint --fix'])) process.exit(1);"`
- View entry is unchanged: `node -e "import fs from 'node:fs'; const p=JSON.parse(fs.readFileSync('package.json','utf8')); const got=p['lint-staged']['*.{ts,tsx,astro}']; if (JSON.stringify(got)!==JSON.stringify(['eslint --fix','node scripts/check-view-tokens.mjs'])) process.exit(1);"`
- Pre-commit command is unchanged: `node -e "import fs from 'node:fs'; const t=fs.readFileSync('.husky/pre-commit','utf8').trim(); if (t!=='npx lint-staged') process.exit(1);"`

#### Manual Verification:

- Stage only a whitespace edit of `scripts/check-view-tokens.mjs`, run `npx lint-staged`, confirm exit 0, confirm the task list shows `eslint --fix` and does not show `node scripts/check-view-tokens.mjs`, then restore and unstage the file.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

## Testing Strategy

### Unit Tests:

- No new unit test. The three automated checks assert the config contract directly.

### Integration Tests:

- The manual lint-staged run is the integration check: one staged `.mjs`, ESLint task only.

### Manual Testing Steps:

1. Edit `scripts/check-view-tokens.mjs` with a trailing newline, `git add` that file only.
2. Run `npx lint-staged`. Expect exit 0 and a task list that contains `eslint --fix` and does not contain `node scripts/check-view-tokens.mjs`.
3. Restore the file and unstage it so the verification does not stay in the index.

## Performance Considerations

The new task runs only when a matching file is staged. Those files are few and `eslint` on the current five already exits 0 in about 9 seconds cold. Commit does not gain `astro check` (~30 seconds) or `npm test`.

## Migration Notes

No data migration. Existing branches pick up the entry when they contain this `package.json`. A commit that stages an already-failing JavaScript file will fail ESLint locally the same way CI would.

## References

- Change notes: `context/changes/pre-commit-script-lint/change.md`
- Commit hook: `.husky/pre-commit`
- lint-staged config: `package.json`
- ESLint scripts override and `.cursor/` ignore: `eslint.config.js`
- CI lint step: `.github/workflows/ci.yml`
- Prior commit-gate pattern: `context/archive/2026-10-06-ui-tokens-onboarding/plan.md`
- Quality gates (local + CI, not a commit-hook map): `context/foundation/test-plan.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Extend lint-staged

#### Automated

- [x] 1.1 JavaScript lint-staged entry is only `eslint --fix` — 3705410
- [x] 1.2 View entry is unchanged — 3705410
- [x] 1.3 Pre-commit command is unchanged — 3705410

#### Manual

- [x] 1.4 Stage only a whitespace edit of `scripts/check-view-tokens.mjs`, run `npx lint-staged`, confirm exit 0, confirm the task list shows `eslint --fix` and does not show `node scripts/check-view-tokens.mjs`, then restore and unstage the file. — 3705410
