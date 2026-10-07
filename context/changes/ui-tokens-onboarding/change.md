---
change_id: ui-tokens-onboarding
title: Ui tokens onboarding
status: preparing
created: 2026-10-06
updated: 2026-10-07
archived_at: null
---

## Notes

One view: `/dashboard` (`src/pages/dashboard.astro`), the screen after login.
Token source: existing shadcn tokens in `src/styles/global.css` (`:root` / `.dark`, published through `@theme inline`). Contract: fresh starter with a dead token file — extend these tokens; do not add a second palette.
Shared components: `src/components/ui/` (`button.tsx`). This view does not import them.
