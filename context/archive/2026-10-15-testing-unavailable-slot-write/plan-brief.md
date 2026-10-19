# Reject blocked, taken, and incomplete consultation writes — Plan Brief

> Full plan: `context/changes/testing-unavailable-slot-write/plan.md`
> Research: `context/changes/testing-unavailable-slot-write/research.md`

## What & Why

Klient nie może zostać z konsultacją na godzinie, którą behawiorysta już zablokował, na terminie zajętym przez inną konsultację `pending`, ani z ankietą, której opis celów ma mniej niż 20 znaków. Smoke dziś widzi tylko kody 400 i 409, a moduł sesji używany przez ten `POST` się nie parsuje.

## Starting Point

Zapis odrzuca zły schemat przed insertem i odrzuca slot, którego nie ma na świeżo załadowanej liście. Drugie `pending` lub `accepted` zatrzymuje częściowy indeks. `rejected` indeks zwalnia. Lista `/consultations` pokazuje imię psa właściciela. Rolę behawiorysty nadaje się SQL-em, nie przez API.

## Desired End State

Na podglądzie z lokalnym Supabase trzy niedozwolone zapisy nie zostawiają imienia psa na liście autora. Po odrzuceniu konsultacji ten sam termin daje drugiemu klientowi nową konsultację. Plik sesji znowu się parsuje, a cookbook planu testów opisuje ten wzorzec.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Warstwa | Rozszerzyć `scripts/smoke.mjs` | Zielony test filtra listy nie dochodzi do insertu. | Research |
| Brak wiersza | Imię psa nie występuje na `/consultations` autora | Sam status 409 już jest w smoke i nie sprawdza wiersza. | Research |
| Blokada | Jedna godzina warszawska przez `POST /api/availability-blocks` | To scenariusz z wywiadu; dzień i godzina i tak są zakresami w tej samej funkcji. | Plan |
| Strefa godziny | `Intl` i `Europe/Warsaw`, nie `getUTCHours` | Slot z API jest w UTC, a CI nie chodzi w czasie Warszawy. | Plan |
| Rola | `supabase db query --local` i `update` z README | API nie zmienia `profiles.role`, a job smoke już ma CLI. | Research |
| `rejected` | Ten sam termin potem daje 201 | Indeks go nie trzyma; drugi 409 byłby fałszywą ochroną. | Research |
| `accepted` | Osobnego kroku HTTP nie ma | Dzieli predykat indeksu z `pending`. | Research |
| Wyścig odczyt–insert | Poza fazą | Baza go nie domyka, a asercja byłaby zależna od czasu. | Research |
| Klamra | Najpierw domknąć `requireBehavioristForm` | Bez tego podgląd nie załaduje `POST`. | Research |

## Scope

**In scope:**

- Domknięcie klamry w `src/lib/consultation-api.ts`
- Kroki smoke: krótki `goals`, zablokowana godzina, drugie `pending`, ponowny zapis po `rejected`
- Jedno zdanie w sekcji smoke w `README.md`
- §6.2, §6.4 i §6.6 w `context/foundation/test-plan.md`

**Out of scope:**

- Konflikt dla `accepted`, wyścig odczyt–insert, lista ras, Playwright, nowy test jednostkowy slotów
- Migracja i typy bazy
- Ryzyko #3 oraz §1, §2 i statusy w §3 planu testów

## Architecture / Approach

Smoke zostaje skryptem HTTP bez nowych zależności. Jedno konto jest promowane lokalnym CLI, blokuje godzinę endpointem aplikacji, a klient próbuje zapisać stary slot. Brak konsultacji to brak imienia na jego własnej liście. Odrzucenie idzie istniejącym `POST /api/consultations/<id>/decision`.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Domknięcie klamry | Moduł sesji się parsuje | `astro check` może złapać coś więcej niż samą klamrę |
| 2. Smoke trzech zapisów | Cztery asercje zapisu na podglądzie | Zła godzina warszawska blokuje inny slot niż wysłany |
| 3. Cookbook | Wzorzec w §6 planu testów | Przypadkowa edycja zamrożonych §1–§2 |

**Prerequisites:** lokalny Supabase i podgląd, tak jak w jobie `smoke`. Faza 1 wystarczy z `npx astro check` i `npm test`.
**Estimated effort:** jedna sesja, trzy fazy.

## Open Risks & Assumptions

- Badanie nie uruchamiało `astro build`. Faza 1 jest pierwszym sprawdzeniem, że sama klamra wystarcza parserowi.
- `npm run smoke` bez lokalnego stosu nie zrobi promocji roli.
- Okno między odczytem slotów a insertem nadal może przyjąć blokadę. Ta faza tego nie łapie.

## Success Criteria (Summary)

- Za krótki opis celów i zapis na zablokowaną albo zajętą godzinę nie zostawiają imienia psa na liście autora.
- Po odrzuceniu ten sam termin zostawia konsultację drugiego klienta.
- Cookbook mówi, jak dodać kolejny taki test, i nie przepisuje strategii planu testów.
