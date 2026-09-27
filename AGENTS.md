# Repository Guidelines

Behawiorysta is a dog-behaviorist booking app specified in @context/foundation/prd.md. The code on disk is an Astro 7 server app (npm name `10x-astro-starter`) with React 19 islands, Tailwind 4, Supabase cookie sessions, and `@astrojs/cloudflare`. Setup and the auth route table are in @README.md.

## Hard rules

`output` is `"server"` in @astro.config.mjs. Auth endpoints export an uppercase `POST` handler (@src/pages/api/auth/signin.ts). Read `SUPABASE_URL` and `SUPABASE_KEY` only from `astro:env/server` (@src/lib/supabase.ts). They are optional server secrets in the Astro env schema. Put local copies in `.env` and `.dev.vars` (both gitignored). Do not import `astro:env/server` from a client component.

Add a protected path to `PROTECTED_ROUTES` in @src/middleware.ts. A missing session redirects to `/auth/signin`. The session user is `context.locals.user` (@src/env.d.ts).

Keep layout and static UI in `.astro` files. Put interactive UI in React islands under `src/components/`. Do not add a `"use client"` directive. Merge Tailwind classes with `cn()` from `@/lib/utils` (@src/lib/utils.ts). Put shadcn/ui files in `src/components/ui/`; the style is `new-york` in @components.json. Add one with `npx shadcn@latest add <name>`.

## Project structure

Auth forms live in `src/components/auth/`. Other directories and the `@/*` alias: @README.md, @tsconfig.json.

## Build, test, and development

Dev, lint, build, smoke, the Node version, and the pre-commit hook: @package.json, @.nvmrc, @.husky/pre-commit, @README.md.

## Coding style

Follow @.prettierrc.json and @eslint.config.js.

## Testing

The smoke script's role: @README.md.

## Commits

Recent commits are one imperative sentence and do not use a Conventional Commits prefix.
