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

## Why this stack

Behawiorysta to mała aplikacja webowa dla jednego behawiorysty i jego klientów, z terminem trzech tygodni pracy po godzinach. Wybrany został domyślny starter dla aplikacji webowej w JavaScript i TypeScript: Astro, React, TypeScript, Supabase i Cloudflare Pages. Logowanie dwóch ról, ankieta i kalendarz siadają na kontach i bazie Supabase bez składania tego stosu ręcznie. Podsumowanie zgłoszenia przez AI zostaje poza tym hand-offem: w PRD jest nice-to-have poza przepływem trzech tygodni, a żaden starter z rejestru nie dokłada modelu językowego od razu. Wdrożenie idzie na Cloudflare Pages. CI to GitHub Actions z automatycznym deployem po merge do main. Złożenie projektu jest na poziomie first-class: starter jest podpięty pod poprawne polecenie, ale nie był sprawdzany wielokrotnie od końca do końca.
