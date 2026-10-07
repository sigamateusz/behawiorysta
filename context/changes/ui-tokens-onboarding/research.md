---
date: 2026-10-07T22:10:26+02:00
researcher: Mateusz
git_commit: 60af90708d4c5d029e5c7c321524ad5c8aaba336
branch: main
repository: sigamateusz/behawiorysta
topic: "Two-way token and component audit of /dashboard"
tags: [research, codebase, dashboard, tokens, shadcn]
status: complete
last_updated: 2026-10-07
last_updated_by: Mateusz
---

# Research: Two-way token and component audit of /dashboard

**Date**: 2026-10-07T22:10:26+02:00
**Researcher**: Mateusz
**Git Commit**: 60af90708d4c5d029e5c7c321524ad5c8aaba336
**Branch**: main
**Repository**: sigamateusz/behawiorysta

## Research Question

For the one view `/dashboard` (`src/pages/dashboard.astro`), where do the shadcn values and shared components live, which of those does this view actually read, and which literals on the screen should have been a token or a repo component? The contract in `change.md` is to extend `src/styles/global.css` and not add a second palette.

## Summary

On this checkout of `main` (`60af907`), `/dashboard` renders a protected starter card that does not use the semantic color utilities published from `src/styles/global.css`. The token file is not unread everywhere: `@layer base` paints `body` with `bg-background` and `text-foreground`, and `src/components/ui/button.tsx` uses `bg-primary` and `focus-visible:ring-ring`. The dashboard covers that body with `bg-cosmic` and palette classes, and its Sign out control is a raw `<button>`.

A hardcoded-value scan of `src/pages/dashboard.astro` matched 6 lines and 11 palette utilities (`white`, `blue`, `purple`). The same scan does not flag `bg-cosmic` on line 9, because that name is a custom utility whose hex lives in `global.css`. Logged-out requests to `/dashboard` redirect to `/auth/signin`. A successful sign-in redirects to `/`, so this page is not the post-login landing.

## Charges

### 1. Missing tokens — the card uses palette utilities

`src/pages/dashboard.astro` lines 14, 15, 18, 19, 21, and 25 contain 11 palette utilities: `border-white/10`, `bg-white/10`, `text-white`, `from-blue-200`, `to-purple-200`, `text-blue-100/80`, `text-white`, `text-blue-100/50`, `border-white/20`, `bg-white/10`, `hover:bg-white/20`. The published roles that match those jobs are `bg-card`, `text-card-foreground`, `text-muted-foreground`, `border-border`, and `bg-primary` / `text-primary-foreground` (`src/styles/global.css:80-96`).

The signed-in card stays a blue-purple glass panel, so editing `--primary` or the `.dark` block does not change what this screen shows.

### 2. Missing tokens — `bg-cosmic` bakes a second palette into the token file

`src/pages/dashboard.astro:9` sets `bg-cosmic min-h-screen` on the outer wrapper. `src/styles/global.css:113-115` defines that utility as `linear-gradient(to bottom, #0a0e1a, #0f1529, #0a0e1a)`. `src/styles/global.css:121-123` does set `body` to `bg-background text-foreground`, and `src/layouts/Layout.astro:2` imports that stylesheet, but the dashboard wrapper covers the viewport.

The page background stays that navy gradient whether `:root` or `.dark` is active, because the utility does not read `--background`.

### 3. Missing shared component — two hand-rolled sign-outs, no focus ring

The card button at `src/pages/dashboard.astro:23-28` is a raw `<button>` with `hover:bg-white/20` and no `focus-visible` class. The top bar rendered at `src/pages/dashboard.astro:11` adds a second Sign out at `src/components/Topbar.astro:19-22`, styled `text-purple-300` with `hover:text-purple-100`. `src/components/ui/button.tsx:8` and `:35-50` already export `Button` with `focus-visible:ring-ring/50`. `dashboard.astro:2-3` imports `Layout` and `Topbar` only.

Keyboard users get two different Sign out controls on one screen, and neither shows the shared ring.

### 4. Missing shared component — the panel has no Card to import

Under `src/components/ui/`, this checkout has `button.tsx` and `LibBadge.astro`. There is no `card` module. `src/pages/dashboard.astro:14` builds the panel with `rounded-2xl border border-white/10 bg-white/10 … backdrop-blur-xl`. The `@theme inline` block publishes `--radius-sm`, `--radius-md`, `--radius-lg`, and `--radius-xl` (`src/styles/global.css:76-79`) and does not publish `--radius-2xl`.

The panel is a one-off shell, so its radius and surface are not a component the next view can import.

### 5. Accidental architecture — login does not land here, and a logged-out request is redirected

`src/pages/api/auth/signin.ts:19` redirects a successful sign-in to `/`. `src/pages/index.astro:6` renders `Welcome` at that URL. `src/middleware.ts:4` lists `/dashboard` in `PROTECTED_ROUTES`, and `src/middleware.ts:31-34` sends a request with no `locals.user` to `/auth/signin` with no return path. Authenticated non-clients get a Dashboard link at `src/components/Topbar.astro:15-17`. A behaviorist who opens `/consultations` is sent to `/dashboard` at `src/middleware.ts:37-39`.

Someone who just signed in sees the home landing, not this dashboard. Someone who opens `/dashboard` logged out sees the sign-in page, not an empty card or raw JSON.

## Detailed Findings

### Token source and who reads it

`src/styles/global.css:6-39` holds light `:root` values and `:41-73` holds `.dark` values, including `--primary`, `--card`, `--muted-foreground`, `--destructive`, and `--ring`. `@theme inline` at `:75-111` republishes them as `--color-*`. `components.json:3` sets shadcn style `new-york`, `:8` points CSS at `src/styles/global.css`, and `:9` sets `baseColor` to `neutral`.

A search of `src/**/*.astro` and `src/**/*.tsx` for semantic utilities (`bg-primary`, `text-primary-foreground`, `bg-background`, `bg-secondary`, `bg-destructive`, `bg-accent`, `text-primary`, `border-ring`, `ring-ring`, and the related `destructive` / `accent` / `input` classes in the same pattern) matched `src/components/ui/button.tsx` at lines 8, 12, 14, and 16-19, and no other file. That search does not see `@apply` in CSS. The other token reads in this inspection are `src/styles/global.css:117-123` (`border-border`, `outline-ring/50` on `*`; `bg-background text-foreground` on `body`).

No `class="dark"` assignment showed up in a search of `src/**/*.astro`, `src/**/*.tsx`, and `src/**/*.ts`. `.dark` exists as a CSS block (`global.css:41`). `button.tsx` uses `dark:` variants (lines 8, 14, 16, 18). `src/layouts/Layout.astro:14` sets `<html lang="en">` with no theme class.

`bg-cosmic` is defined once (`global.css:113`) and referenced in these 7 files: `src/pages/dashboard.astro:9`, `src/pages/auth/signin.astro:9`, `src/pages/auth/signup.astro:9`, `src/pages/auth/confirm-email.astro:22`, `src/pages/consultations/index.astro:42`, `src/pages/consultations/new.astro:13`, `src/components/Welcome.astro:5`. Those other six are the same pattern, outside this change's one view.

### Shared components

`Button` is imported from `@/components/ui/button` in 3 files: `src/components/auth/SubmitButton.tsx:3`, `src/components/consultations/SlotPicker.tsx:2`, `src/components/consultations/SurveyStep.tsx:4`. `SubmitButton.tsx:18` passes `bg-purple-600 text-white hover:bg-purple-500`, which overrides the default `bg-primary` variant for that submit control. A content search for `LibBadge` in `*.astro`, `*.tsx`, `*.ts`, and `*.md` returned no matches, so no inspected source file imports `src/components/ui/LibBadge.astro`. That file's own markup uses `bg-blue-900/50` and `text-purple-200` (`LibBadge.astro:10-12`).

`Topbar.astro` is imported by 4 files: `src/pages/dashboard.astro:3`, `src/components/Welcome.astro:2`, `src/pages/consultations/index.astro:3`, `src/pages/consultations/new.astro:3`. A class change in Topbar shows up on those four screens, not only on `/dashboard`.

`AGENTS.md` (the repository guidelines line that places shadcn files in `src/components/ui/`, names style `new-york`, and says to add a component with `npx shadcn@latest add <name>`) does not mention token roles or forbid palette classes. `.cursor/rules/10x-course.mdc` tells UI work to go through `/10x-ui` and does not instruct arbitrary values such as `w-[123px]`. `context/foundation/lessons.md` is absent.

### What `/dashboard` implements

The page imports `Layout` and `Topbar` (`dashboard.astro:2-3`) and does not fetch data. The template does not branch on the card: after middleware calls `next()`, the markup includes the card, `{user?.email}` (`dashboard.astro:19`), and the sign-out form. `src/env.d.ts:3` types `locals.user` as Supabase `User | null`. Middleware sets that from `getUser()` (`src/middleware.ts:18-21`) and blocks the page when it is null, so the `?.` is not the logged-out branch. This repo's page does not branch when `email` is missing; the welcome line still renders. Whether a real Supabase user can lack `email` was not confirmed from `node_modules` typings.

| State | On this screen, in the current markup |
| --- | --- |
| default | Card and top bar use the literals in charges 1–3 |
| hover | Card Sign out uses `hover:bg-white/20` (`dashboard.astro:25`). Topbar links and its Sign out use `hover:text-purple-100` (`Topbar.astro:11,15,20`) |
| focus-visible | No `focus-visible` class on the dashboard button or on Topbar controls |
| disabled | Neither sign-out button sets `disabled` |
| error | The page has no error branch. `Layout.astro:22-35` can render `Banner variant="error"` when `missingConfigs` is non-empty. That list is Supabase env missing (`src/lib/config-status.ts:11-21`) |
| empty | No empty-state branch. The card is static |
| loading | No fetch, skeleton, or pending flag in `dashboard.astro` or `Topbar.astro` |

## Code References

- `src/pages/dashboard.astro:9-28` — cosmic wrapper, glass card, gradient title, raw Sign out
- `src/styles/global.css:75-124` — `@theme inline` publication, `bg-cosmic` hex gradient, base `body` tokens
- `src/components/ui/button.tsx:8-19` — semantic variants and focus ring
- `src/components/Topbar.astro:5-22` — palette bar and second Sign out, including the `/dashboard` link
- `src/middleware.ts:4-43` — `/dashboard` auth gate and behaviorist redirect
- `src/pages/api/auth/signin.ts:19` — success redirect to `/`
- `src/layouts/Layout.astro:2` — a search of `src` for `global.css` matched this import and no other file
- `components.json:3-16` — `new-york`, CSS path, `baseColor: neutral`, ui alias `@/components/ui`

## Architecture Insights

This file stores values on `:root` and `.dark`, then publishes them as `--color-*` in `@theme inline` (`global.css:75-111`). `bg-cosmic` skips that split: the gradient hex is written on the utility (`global.css:114`), so the `.dark` custom properties are not inputs to it. Dashboard classes then paint over the base layer, which is why the token file can be both wired up and invisible on this view.

Interactive UI in this repo is React islands (`AGENTS.md`). `/dashboard` is a static `.astro` page. Using `Button` here means either an island or an Astro wrapper. That is an integration choice, not something the current imports decide.

`Topbar` is shared by the four importers listed above. Restyling it to fix charge 3 changes Welcome and both consultation pages in the same edit.

## Historical Context (from prior changes)

- `context/changes/ui-tokens-onboarding/change.md:12` — "the screen after login." **Partial.** `/dashboard` requires a session (`middleware.ts:31-34`). Sign-in success goes to `/` (`signin.ts:19`), not to this page.
- `context/changes/ui-tokens-onboarding/change.md:13` — "fresh starter with a dead token file." **Partial.** Dashboard class strings do not read semantic color utilities. `global.css:117-123` and `button.tsx` do. `bg-cosmic` is a live hex utility in that same file.
- `context/changes/ui-tokens-onboarding/change.md:14` — "This view does not import them." **Supported** for `dashboard.astro:2-3`.
- `context/changes/ui-tokens-onboarding/change.md:13` — "extend these tokens; do not add a second palette." **Constraint for the plan**, not a description of current CSS. The file already contains both the neutral shadcn variables and the `bg-cosmic` hex gradient.
- `context/archive/2026-10-01-client-survey-and-slot/plan.md:229` — "Teksty UI po polsku." **Supported as a sentence in that archived plan.** It sits with the consultation slice. This dashboard card's visible strings are English (`dashboard.astro:16-27`: "Dashboard", "Welcome", "This page is only for authenticated users.", "Sign out"). Topbar mixes that with "Moje konsultacje" (`Topbar.astro:12`). Do not treat the archive line as a token requirement for this view.

No other `research.md` exists under `context/changes/` or `context/archive/`. `context/foundation/prd.md` and `context/foundation/tech-stack.md` do not specify a visual token system. `context/foundation/lessons.md` is absent.

## Related Research

Not applicable. This is the first `research.md` in `context/changes/` and `context/archive/` on this checkout.

## Open Questions

- Whether sign-in should redirect to `/dashboard` is a product choice. The current success target is `/` (`signin.ts:19`). Charge 5 records the mismatch; it does not settle a new landing page.
- Whether this change may edit `Topbar.astro`, given the four importers above, or only the card in `dashboard.astro`.
- Whether the panel should gain a shadcn Card (`npx shadcn@latest add card`, per `AGENTS.md`) or stay Astro markup that references `bg-card` and `border-border`. No Card file exists today.
- `.dark` values exist and nothing in the inspected `src` markup turns them on. Adding a theme toggle is outside the evidence for this view.
- The states table has no disabled, error, empty, or loading UI on the dashboard card. The plan can mark those N/A with that reason, or add them only if the view grows a control that needs them. The focus-visible gap is not N/A: both sign-out controls are keyboard-reachable.
