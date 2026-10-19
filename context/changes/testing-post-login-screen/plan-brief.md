# Ekran po zalogowaniu na podglądzie — Plan Brief

> Full plan: `context/changes/testing-post-login-screen/plan.md`
> Research: `context/changes/testing-post-login-screen/research.md`

## What & Why

Po zalogowaniu klient ma otworzyć listę zgłoszeń, a behawiorysta kalendarz, na runtime podglądu. Dziś sign-in wysyła klienta na `/`, a testy tablicy tras i prefiks `Location` w smoke nie pokazują ekranu po buildzie.

## Starting Point

`redirectAfterSignIn` zwraca `/dashboard` dla behawiorysty i `/` dla klienta oraz dla `null`. Handler sign-in przekazuje tylko `behaviorist` albo `null`, więc rola `client` i tak ląduje na `/`. Playwright już robi `build` + `preview`, ale jedyny spec to wizyta bez sesji, a projekt `chromium` wymaga konta `E2E_USERNAME`. CI Playwrighta nie uruchamia.

## Desired End State

Konto `client` po sign-in widzi „Moje zgłoszenia” i pustą listę na `/consultations`. Konto `behaviorist` widzi kalendarz na `/dashboard` z linkiem „Poprzedni miesiąc”. `npx playwright test --project=preview` sprawdza oba ekrany na podglądzie, a CI odpala tę komendę po starcie lokalnego Supabase.

## Key Decisions Made

| Decision           | Choice                                              | Why (1 sentence)                                                               | Source   |
| ------------------ | --------------------------------------------------- | ------------------------------------------------------------------------------ | -------- |
| Ekran klienta      | `/consultations`, nagłówek „Moje zgłoszenia”        | Planowanie wybrało listę zgłoszeń                                              | Plan     |
| Rola `null`        | Zostaje `/`                                         | Brak wiersza i błąd odczytu nie są kontem klienta                              | Plan     |
| Ekran behawiorysty | `/dashboard` i link „Poprzedni miesiąc”             | Kod i zdanie dowodu już wskazują kalendarz                                     | Research |
| Konta w teście     | Dwa świeże: signup i SQL promocji, potem formularz  | Rola `E2E_USERNAME` nie jest w repozytorium; smoke promuje behawiorystę SQL-em | Research |
| Runtime            | `build` + `preview`, bez mocka sesji                | Plan testów, ryzyko #3                                                         | Research |
| Bramka CI          | Osobny job, `npx playwright test --project=preview` | Pełne `npx playwright test` odpala setup konta z `.env`                        | Plan     |
| Smoke              | Oczekiwany prefiks `/consultations`                 | Oczekiwanie `"/"` zostaje zielone, gdy `Location` to lista                     | Plan     |

## Scope

**In scope:**

- Przekazanie roli `client` z sign-in i zwrot `/consultations` z `redirectAfterSignIn`
- Aktualizacja testu jednostkowego i trzech kroków smoke
- Spec Playwrighta dwóch ról i projekt `preview` bez `storageState`
- Job CI oraz zdanie dowodu #3, §6.3 i komenda bramki w planie testów

**Out of scope:**

- Ankieta `/consultations/new` jako lądowanie
- Zmiana roli `null`, `dashboardRedirect` i middleware
- Mock sesji, konto `E2E_USERNAME` w specu #3, usunięcie lokalnego setupu
- Playwright poza ryzykiem #3
- Status fazy 2 w tabeli rolloutu §3

## Architecture / Approach

Sign-in czyta `profiles.role` i dla `client` przekierowuje na `/consultations`; middleware przy tym GET zostawia klienta na liście. Spec zakłada dwa konta na podglądzie, jedno promuje SQL-em i każde loguje przez formularz. Projekt `preview` nie zależy od setupu. Job CI powtarza start Supabase ze smoke i oddaje build oraz preview konfiguracji Playwrighta.

## Phases at a Glance

| Phase                     | What it delivers                                                                       | Key risk                                                                               |
| ------------------------- | -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| 1. Przekierowanie klienta | Sign-in klienta kończy się na `/consultations`; test jednostkowy i smoke tego oczekują | Zmiana samej funkcji, bez przekazania `"client"` z handlera, zostawia lądowanie na `/` |
| 2. Ekran na podglądzie    | Spec obu ról, job CI, zdanie dowodu i cookbook                                         | Setup z `.env` wywraca suite, jeśli spec wisi na projekcie `chromium`                  |

**Prerequisites:** lokalny Supabase oraz `.env` i `.dev.vars` jak przy smoke, Node 22
**Estimated effort:** jedna–dwie sesje, dwie fazy

## Open Risks & Assumptions

- Który plik sekretów czyta `astro preview`, nie było sprawdzane w dokumentacji Astro 7. Job zapisuje `.env` i `.dev.vars`, tak jak smoke.
- Matcher `startsWith("/consultations")` spełnia też `/consultations/new`. Ekran listy dowodzi nagłówek i tekst pustej listy w specu.
- `npx playwright test` bez `--project=preview` dalej uruchamia setup i potrzebuje `E2E_USERNAME`.

## Success Criteria (Summary)

- Klient po sign-in widzi listę „Moje zgłoszenia” na `/consultations`; behawiorysta widzi kalendarz z „Poprzedni miesiąc”.
- `npm test`, smoke na podglądzie i `npx playwright test --project=preview` przechodzą.
- CI uruchamia projekt `preview` po starcie lokalnego Supabase, a plan testów nazywa listę i tę komendę.
