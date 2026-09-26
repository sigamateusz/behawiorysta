---
bootstrapped_at: 2026-09-26T10:26:07Z
starter_id: 10x-astro-starter
starter_name: "10x Astro Starter (Astro + Supabase + Cloudflare)"
project_name: behawiorysta
language_family: js
package_manager: npm
cwd_strategy: git-clone
bootstrapper_confidence: first-class
phase_3_status: ok
audit_command: "npm audit --json"
---

## Hand-off

```yaml
---
starter_id: 10x-astro-starter
package_manager: npm
project_name: behawiorysta
hints:
  language_family: js
  team_size: solo
  deployment_target: cloudflare-pages
  ci_provider: github-actions
  ci_default_flow: auto-deploy-on-merge
  bootstrapper_confidence: first-class
  path_taken: standard
  quality_override: false
  self_check_answers: null
  has_auth: true
  has_payments: false
  has_realtime: false
  has_ai: false
  has_background_jobs: false
---
```

## Why this stack

Behawiorysta to mała aplikacja webowa dla jednego behawiorysty i jego klientów, z terminem trzech tygodni pracy po godzinach. Wybrany został domyślny starter dla aplikacji webowej w JavaScript i TypeScript: Astro, React, TypeScript, Supabase i Cloudflare Pages. Logowanie dwóch ról, ankieta i kalendarz siadają na kontach i bazie Supabase bez składania tego stosu ręcznie. Podsumowanie zgłoszenia przez AI zostaje poza tym hand-offem: w PRD jest nice-to-have poza przepływem trzech tygodni, a żaden starter z rejestru nie dokłada modelu językowego od razu. Wdrożenie idzie na Cloudflare Pages. CI to GitHub Actions z automatycznym deployem po merge do main. Złożenie projektu jest na poziomie first-class: starter jest podpięty pod poprawne polecenie, ale nie był sprawdzany wielokrotnie od końca do końca.

## Pre-scaffold verification

| Signal             | Value                                                                 | Severity | Notes                                                                                          |
| ------------------ | --------------------------------------------------------------------- | -------- | ---------------------------------------------------------------------------------------------- |
| npm package        | not run                                                               | n/a      | `cmd_template` starts with `git clone`; npm package recency does not apply                    |
| GitHub repo        | przeprogramowani/10x-astro-starter last pushed 2026-09-12             | fresh    | from card `docs_url`. `gh` was not installed; timestamp read from the public GitHub API      |

## Scaffold log

**Resolved invocation**: `git clone https://github.com/przeprogramowani/10x-astro-starter .bootstrap-scaffold && cd .bootstrap-scaffold && npm install`
**Strategy**: git-clone
**Exit code**: 0
**Files moved**: 30731 (22 top-level paths, including directories such as `src/`, `node_modules/`, and `.github/`)
**Conflicts (.scaffold siblings)**: none
**.gitignore handling**: moved silently
**.bootstrap-scaffold cleanup**: deleted

Git was not on PATH. Git for Windows 2.55.0 was installed for this run, then the clone ran. The cloned `.git/` was deleted before files were moved up, so the starter's history was not kept. `context/` in the current directory was left as-is. The scaffold did not contain a `context/` tree to drop.

`npm install` added 648 packages and exited 0. It also warned that install scripts for `esbuild@0.28.2`, `esbuild@0.28.1`, and `workerd@1.20260911.1` were not run (`allowScripts`). The `@esbuild/win32-x64` package is present without `esbuild.exe`.

## Post-scaffold audit

**Tool**: npm audit --json
**Summary**: 0 CRITICAL, 0 HIGH, 0 MODERATE, 0 LOW (info: 0; total: 0)
**Direct vs transitive**: not distinguished by this tool (npm audit JSON reported dependency counts only: prod 377, dev 269, optional 167, total 804; no `metadata.dependencies.direct` field and no advisories)

#### CRITICAL findings

none

#### HIGH findings

none

#### MODERATE findings

none

#### LOW / INFO findings

none

## Hints recorded but not acted on

| Hint                       | Value                |
| -------------------------- | -------------------- |
| bootstrapper_confidence    | first-class          |
| quality_override           | false                |
| path_taken                 | standard             |
| self_check_answers         | null                 |
| team_size                  | solo                 |
| deployment_target          | cloudflare-pages     |
| ci_provider                | github-actions       |
| ci_default_flow            | auto-deploy-on-merge |
| has_auth                   | true                 |
| has_payments               | false                |
| has_realtime               | false                |
| has_ai                     | false                |
| has_background_jobs        | false                |

## Next steps

Next: a future skill will set up agent context (CLAUDE.md, AGENTS.md). For now, your project is scaffolded and verified — happy hacking.

Useful manual steps in the meantime:
- `git init` (if you have not already) to start your own repo history.
- Review any `.scaffold` siblings the conflict policy created and decide which version of each file to keep.
- Address audit findings per your project's risk tolerance — the full breakdown is in this log.
