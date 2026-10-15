---
date: 2026-10-15T22:21:09+02:00
researcher: Mateusz
git_commit: 33037f25bab244e55d3ff654582f97c7513a58dc
branch: main
repository: behawiorysta
topic: "Does a blocked, already-taken, or incomplete consultation write persist a row?"
tags: [research, codebase, consultations, availability, smoke]
status: complete
last_updated: 2026-10-15
last_updated_by: Mateusz
---

# Research: Does a blocked, already-taken, or incomplete consultation write persist a row?

**Date**: 2026-10-15T22:21:09+02:00
**Researcher**: Mateusz
**Git Commit**: 33037f25bab244e55d3ff654582f97c7513a58dc
**Branch**: main
**Repository**: behawiorysta

## Research Question

Ground rollout Phase 1 of `context/foundation/test-plan.md` for risks #1, #5, and #6: a blocked slot, a second booking of the same slot, and an incomplete survey must not leave a consultation. Verify the planned response guidance against the code. Do not treat hot-spot directories as the place the failure lives.

## Summary

On `POST` in `src/pages/api/consultations/index.ts`, three branches return before a successful insert, and they are not the same branch.

- When `consultationSchema.safeParse` fails, this handler returns 400 and does not call `.insert` (`src/pages/api/consultations/index.ts:23-25`). A missing form field arrives as `""` (`src/lib/consultation-api.ts:57-59`).
- When that parse succeeds and `getAvailableSlots` does not contain the requested instant, this handler returns 409 and does not call `.insert` (`src/pages/api/consultations/index.ts:30-39`). That reload is what a stale slot list hits, if the block is already committed before the reload.
- When `.insert` returns `error.code === "23505"`, this handler returns 409 and does not write again (`src/pages/api/consultations/index.ts:55-57`). The partial unique index `consultations_active_slot_uidx` is on `slot_start` where `status in ('pending', 'accepted')` (`supabase/migrations/20261001182110_client_survey_and_slot.sql:62-63`).

`rejected` is in the column check and is not in that index predicate (`supabase/migrations/20261001182110_client_survey_and_slot.sql:55`). No inspected migration adds a constraint that rejects a consultation overlapping `availability_blocks`. Smoke checks one 400 and one 409 by HTTP status only (`scripts/smoke.mjs:125-129`, `scripts/smoke.mjs:155-163`, `scripts/smoke.mjs:59-61`).

`src/lib/consultation-api.ts` does not parse. TypeScript `createSourceFile` on that file at this commit reported one parse diagnostic: `'}' expected` at line 71. `requireBehavioristForm` opens at line 29 and the next function starts at line 43 with no closing brace. No file matching `src/**/*.test.ts` imports this module, so `npm test` does not load it.

## Detailed Findings

### Risk #1 — blocked slot, stale list

A block row is a half-open `timestamptz` range. The inspected table constraint is `ends_at > starts_at` (`supabase/migrations/20261001182110_client_survey_and_slot.sql:88-95`). In `src/lib/blocks.ts`, `wholeDay` produces one Warsaw midnight-to-midnight range (`src/lib/blocks.ts:31-33`). A non-empty hour selection produces one 60-minute range per chosen hour from `SLOT_STARTS` (`src/lib/blocks.ts:42-46`, `src/lib/slots.ts:5-6`). `TIME_ZONE` in this file is `"Europe/Warsaw"` (`src/lib/slots.ts:1`).

`GET` `src/pages/api/consultations/slots.ts` and the create `POST` both call `getAvailableSlots` (`src/lib/availability.ts:5-23`). `availableSlots` drops a generated hour when a block overlaps `[start, start+60min)` (`src/lib/slots.ts:134-136`). The create handler then requires the requested instant to be in that reloaded list (`src/pages/api/consultations/index.ts:36-39`). It does not read the list the browser already held.

Verdict on the planned guidance: the assumption “hiding the hour on the list means the write also rejects” is false as a general rule, and on this handler the write does reload. A block committed before `getAvailableSlots` returns makes `slotOpen` false, and `.insert` at `src/pages/api/consultations/index.ts:41` is not reached. The database will not reject that insert on its own: the four SQL migrations were searched for a constraint linking `consultations.slot_start` to `availability_blocks`, and none was found. A block committed after that read and before `.insert` is outside this check. That interleaving was not executed.

Cheapest useful test for the stated scenario (list already open, block already saved, then POST): HTTP with a client session. Save the block, POST that `slot_start`, expect 409, and show that this POST did not add a consultation. Another unit test of `availableSlots` does not reach `.insert`.

### Risk #5 — second booking

The column check names the set `pending`, `accepted`, `rejected` (`supabase/migrations/20261001182110_client_survey_and_slot.sql:55`). The unique index predicate names `pending` and `accepted` only (`supabase/migrations/20261001182110_client_survey_and_slot.sql:62-63`). `taken_slot_starts` uses that same status pair (`supabase/migrations/20261001182110_client_survey_and_slot.sql:118-120`). The create insert omits `status`, so the column default `pending` is what the insert policy also requires (`src/pages/api/consultations/index.ts:41-51`, `supabase/migrations/20261001182110_client_survey_and_slot.sql:74-78`).

The decision route updates one `pending` row to `accepted` or `rejected` (`src/pages/api/consultations/[id]/decision.ts:22-27`). After `rejected`, that row no longer matches the index predicate. A later insert of the same `slot_start` is not a `23505` from this index. After `accepted`, the row still matches the predicate.

The 409 body for both the pre-insert miss and `23505` is `{ error: "Ten termin został właśnie zajęty albo jest niedostępny — wybierz inny." }` (`src/lib/consultation-api.ts:7-10`, `src/pages/api/consultations/index.ts:38`, `src/pages/api/consultations/index.ts:56-57`). The handler does not count rows after either branch.

Smoke’s “B cannot take A's slot” expects status 409 and does not set `json`, `bodyIncludes`, or `bodyExcludes` (`scripts/smoke.mjs:155-163`). `stepPassed` then compares status only (`scripts/smoke.mjs:59-61`). The first booking’s status is not read. `availableSlots` is tested with `taken: ["2026-10-06T08:00:00+00:00"]`, a list of instants with no status field (`src/lib/slots.test.ts:107-110`).

Verdict: one 409 after a fresh 201 does not cover `accepted` or `rejected`. The useful assertion for `pending` is 409 plus evidence the second client’s dog was not stored. `rejected` is the case that must be allowed to store a new row, not another 409. `accepted` shares the index predicate and is not what this smoke step sets up.

### Risk #6 — incomplete survey

`consultationSchema` requires `dog_name`, `breed`, `age_years`, `age_months`, `basic_info`, `goals`, and `slot_start`, plus `age_years * 12 + age_months >= 1` (`src/lib/consultation-schema.ts:18-47`). Text fields are trimmed. `goals` minimum length on this schema is 20 (`src/lib/consultation-schema.ts:28-32`). `breed` is length 1–80 with no membership check (`src/lib/consultation-schema.ts:20`). The table checks match those length and age bounds and do not name a breed list (`supabase/migrations/20261001182110_client_survey_and_slot.sql:48-57`).

On this POST, a failed parse returns 400 `{ errors: Record<string, string> }` and does not insert (`src/pages/api/consultations/index.ts:23-25`). That body key is `errors`, not the `error` key used by `jsonError`. A logged-in client is required first: `requireClientApi` returns 401 when `context.locals.user` is missing and 403 when `context.locals.role !== "client"` (`src/lib/consultation-api.ts:15-26`). The handler then reads `formData` directly (`src/pages/api/consultations/index.ts:12`). It does not check that the body came from the React form.

`consultation-schema.test.ts` asserts parse failures for whitespace and bounds on those fields. It does not send HTTP and does not look for a row. Smoke sends `{ dog_name: "" }` and expects 400 (`scripts/smoke.mjs:125-129`), with no row check.

Verdict: one 400 for an empty `dog_name` does not show that the server rejects the other fields, and the schema unit tests do not show that a direct POST skips the form without inserting. The missing HTTP case is a payload that fails a server rule smoke does not send — `goals` shorter than 20, other schema fields valid, `slot_start` still open — expecting 400 and no new consultation. Do not assert that `breed` must belong to the datalist.

### Parse error in the imported module

`requireBehavioristForm` is missing its closing brace (`src/lib/consultation-api.ts:29-43`). TypeScript `createSourceFile` on `src/lib/consultation-api.ts` at commit `33037f25bab244e55d3ff654582f97c7513a58dc` reported one parse diagnostic, `'}' expected`, at 71:1. The create handler imports `requireClientApi`, `readFormString`, `jsonError`, and `SLOT_CONFLICT_MESSAGE` from this file (`src/pages/api/consultations/index.ts:3`). A parse error fails the module, not only `requireBehavioristForm`. `astro build` was not run. No `src/**/*.test.ts` imports the module, so the existing Vitest run does not observe this.

HTTP tests against a preview cannot load this POST until the file parses. That is a precondition of the phase, not a fourth product risk.

## Code References

- `src/pages/api/consultations/index.ts:23-39` — 400 before insert, then 409 before insert when the reloaded slot list misses the instant
- `src/pages/api/consultations/index.ts:55-57` — `23505` returns 409 and does not write again
- `src/lib/consultation-api.ts:7-10` — shared conflict message
- `src/lib/consultation-api.ts:29-43` — `requireBehavioristForm` has no closing brace
- `src/lib/consultation-schema.ts:18-47` — server field rules for this POST
- `src/lib/availability.ts:5-23` — loads blocks and `taken_slot_starts`
- `src/lib/slots.ts:134-136` — overlap test used by the list inside `availableSlots`
- `supabase/migrations/20261001182110_client_survey_and_slot.sql:55-63` — status check and partial unique index
- `supabase/migrations/20261001182110_client_survey_and_slot.sql:88-95` — block range check is `ends_at > starts_at`
- `src/pages/api/consultations/[id]/decision.ts:22-27` — `pending` becomes `accepted` or `rejected` in place
- `scripts/smoke.mjs:125-163` — one 400 and one 409, status only

## Architecture Insights

The create path is application check, then insert, then the partial unique index. On this POST, the block overlap test that runs is `availableSlots` (`src/lib/slots.ts:134-136`). The insert object does not compare `availability_blocks` (`src/pages/api/consultations/index.ts:41-51`). When two inserts both pass the availability read, `consultations_active_slot_uidx` rejects the second `slot_start` for `pending` and `accepted`. A block does not match that index, so it does not produce `23505` from `consultations_active_slot_uidx`.

## Historical Context (from prior changes)

- `context/archive/2026-10-01-client-survey-and-slot/plan.md` — claimed one slot function for the list and the write, a partial unique index, and `23505` mapped to the client. **Partial.** Both entry points call `getAvailableSlots` (`src/lib/availability.ts:5`). The index and the `23505` branch match the current handler for `pending` and `accepted`. The same plan’s “UI and server cannot diverge” does not hold for a block that lands after the availability read: no inspected migration constrains the insert against `availability_blocks`.
- `context/archive/2026-10-01-client-survey-and-slot/plan.md` — smoke would reject an incomplete survey with 400 and a second booking with 409. **Supported** as status checks (`scripts/smoke.mjs:125-129`, `scripts/smoke.mjs:155-163`). **Not supported** as a row-absence check: those two steps do not set a body or JSON expectation (`scripts/smoke.mjs:59-61`).

## Related Research

`context/archive/2026-10-06-ui-tokens-onboarding/research.md` and `context/archive/2026-10-08-behaviorist-submission-views/research.md` exist. They were not read. This question does not use them.

## Open Questions

- No HTTP request was sent, so the 400, 409, and 201 shapes are what the handler returns in source, not a captured response.
- The block-between-read-and-insert window was not executed.
- `astro build` was not run, so the TypeScript parse diagnostic is not yet a bundler result.
- Which offset spellings `z.iso.datetime({ offset: true })` accepts, besides the ISO case already in `src/lib/consultation-schema.test.ts`, was not enumerated.
