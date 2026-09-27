# Repository Guidelines

Behawiorysta is an Astro 7 server-rendered app (npm name `10x-astro-starter`) using React 19 islands, Tailwind 4, Supabase cookie sessions, and `@astrojs/cloudflare`. First-time setup and the auth route table are in @README.md. Extended agent notes are in @CLAUDE.md.

## Hard rules

`output` is `"server"` in @astro.config.mjs. API modules export uppercase `POST` or `GET` handlers, as in @src/pages/api/auth/signin.ts.

Register protected paths in `PROTECTED_ROUTES` inside @src/middleware.ts. A missing session redirects to `/auth/signin`. The session user is `context.locals.user` (@src/env.d.ts).

Keep layout and static UI in `.astro` files. Add interactive UI as React islands under `src/components/`. Do not add a `"use client"` directive.

Merge Tailwind classes with `cn()` from `@/lib/utils` (@src/lib/utils.ts). Place shadcn/ui files in `src/components/ui/`; the style is `new-york` in @components.json. Add a component with `npx shadcn@latest add <name>`.

`SUPABASE_URL` and `SUPABASE_KEY` are server secrets in the Astro env schema. Local copies belong in `.env` and `.dev.vars`, both gitignored. Do not import those secrets into client components.

## Project structure

Pages are `src/pages/`, endpoints `src/pages/api/`, layouts `src/layouts/`, UI `src/components/` (auth forms in `src/components/auth/`), helpers `src/lib/`, styles `src/styles/global.css`. `@/*` resolves to `./src/*` (@tsconfig.json). There is no migration folder; auth uses Supabase `auth.users` only (@README.md).

## Build, test, and development

`npm run dev` starts the Cloudflare dev server. `npm run lint` runs ESLint. `npx astro check` is the typecheck CI runs. `npm run build` produces the worker build and needs both Supabase variables. `npm run smoke` calls a live server; `BASE_URL` defaults to `http://localhost:4321`. Use Node `22.14.0` (@.nvmrc). Before each commit, @.husky/pre-commit runs lint-staged from @package.json: `eslint --fix` on `*.{ts,tsx,astro}` and Prettier on `*.{json,css,md}`.

## Coding style

Follow @.prettierrc.json and @eslint.config.js (`strictTypeChecked` and `stylisticTypeChecked`). Unused names must match `^_` or lint fails. `no-console` warns except under `scripts/**/*.mjs`. `astro/no-set-html-directive` is an error.

## Testing

No unit-test or Playwright config is checked in. The automated check is `npm run smoke`. @README.md says that script guards starter upgrades and is not an application test suite. CI job `smoke` builds, serves `npm run preview`, and runs the script against a local Supabase.

## Commits and pull requests

The only commit is an imperative sentence stating why, without a Conventional Commits prefix. Open pull requests against `master`. @.github/workflows/ci.yml runs on push and pull request to `master`: job `ci` lints, runs `astro check`, and builds (repository secrets `SUPABASE_URL` and `SUPABASE_KEY`), and job `smoke` uses a local Supabase and needs no secrets.
