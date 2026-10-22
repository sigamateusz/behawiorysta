# Report auth outage — Plan Brief

> Full plan: `context/changes/report-auth-outage/plan.md`

## What & Why

Awaria GoTrue albo odczytu `profiles` jest dziś tym samym co brak logowania: przekierowanie na `/auth/signin` albo na `/`, a w API status 401 lub 403. Użytkownik widzi formularz albo „brak uprawnień”, a w logu nie ma statusu z auth ani kodu PostgREST. Ta zmiana zwraca 503 i zostawia krótki wpis diagnostyczny.

## Starting Point

`src/middleware.ts` odrzuca `error` z `getUser()` i z `profiles`. Auth-js przy sieci i HTTP 5xx zwraca `AuthRetryableFetchError` zamiast rzucać. `POST /api/auth/signin` po udanym haśle ignoruje `profileError` i i tak przekierowuje. W repozytorium nie ma Sentry. Vitest testuje czyste funkcje w `src/lib/`, a Playwright tylko ekran po zalogowaniu.

## Desired End State

Przy awarii każde żądanie dostaje 503 i zdanie „Usługa jest chwilowo niedostępna. Spróbuj ponownie.” Przeglądarka dostaje HTML, `fetch` dostaje JSON `{ error }`. Log ma `name`, `status`, `code`, `pathname` i `userId`, bez e-maila. Zwykły brak sesji nadal otwiera logowanie. Brak wiersza profilu nadal ląduje na `/`. Złe hasło nadal wraca na formularz.

## Key Decisions Made

| Decision                    | Choice                                                   | Why (1 sentence)                                                                 | Source |
| --------------------------- | -------------------------------------------------------- | -------------------------------------------------------------------------------- | ------ |
| Które żądania dostają 503   | Każde żądanie, na którym klasyfikator zwróci awarię      | Inaczej API dalej udaje 401, a strona główna dalej udaje brak logowania          | Plan   |
| Co jest awarią              | Sieć, HTTP 5xx z auth, albo dowolny `error` z `profiles` | `AuthSessionMissingError` i błąd 401 zostają ścieżką logowania, bez wpisu w logu | Plan   |
| Jak zgłaszać                | `console.error` tych pięciu pól, bez nowego SDK          | W tym commicie nie ma trackera, a Cloudflare observability jest włączone         | Plan   |
| Błąd profilu przy logowaniu | Ta sama reguła 503, ciasteczka zostają                   | Udane hasło i martwa tabela profili nie kończą się wejściem na `/`               | Plan   |
| Gdzie test                  | Vitest przy `src/lib/session-gate.ts`                    | Plan testów zabrania mockowania sesji w smoke i Playwrightu                      | Plan   |
| Ciało 503                   | HTML, gdy `Accept` zawiera `text/html`, inaczej JSON     | Formularz logowania to nawigacja dokumentu, a ankieta woła `fetch`               | Plan   |

## Scope

**In scope:**

- Klasyfikator sesji i jego testy.
- 503 i log w middleware dla każdego żądania z awarią.
- 503 w `POST /api/auth/signin`, gdy hasło się uda, a odczyt profilu zwróci błąd.

**Out of scope:**

- Sentry i brak konfiguracji Supabase.
- Złe hasło, walidacja i błąd samego `signInWithPassword`.
- Banery 200, `?decided=error`, `block_error` i `jsonError` obcinające `cause`.
- Nowy test e2e albo smoke udający awarię GoTrue.

## Architecture / Approach

`classifySession` w `src/lib/session-gate.ts` zwraca `anonymous`, `missing-role`, `ready` albo `outage`. Middleware i logowanie tylko stosują ten wynik. Przy `outage` budują jedną odpowiedź 503 i wołają `console.error`. Przy pozostałych wynikach zostaje dzisiejsze przekierowanie.

## Phases at a Glance

| Phase                 | What it delivers                                 | Key risk                                                             |
| --------------------- | ------------------------------------------------ | -------------------------------------------------------------------- |
| 1. Klasyfikacja sesji | Funkcja i testy sześciu wyników, bez zmiany HTTP | Zły warunek znowu uzna awarię za anonima                             |
| 2. Middleware         | 503 i log na każdym żądaniu z awarią             | 503 na zwykłym braku sesji zablokuje formularz logowania             |
| 3. Logowanie          | Błąd profilu po udanym haśle zwraca 503          | Przypadkowe wyczyszczenie ciasteczka albo zmiana ścieżki złego hasła |

**Prerequisites:** lokalny Supabase do Playwrighta i do ręcznego logowania w fazach 2 i 3.
**Estimated effort:** jedna sesja, trzy krótkie fazy.

## Open Risks & Assumptions

- Zbieranie `console.error` przez Cloudflare jest założeniem z `observability.enabled`. Alertów ten plan nie dodaje.
- Jeśli GoTrue zacznie zwracać awarię jako 401, a nie jako `AuthRetryableFetchError`, ten przypadek zostanie anonimem i nie trafi do logu.
- Ręcznie nie da się tu zgasić GoTrue. Ścieżka 503 jest udowodniona testem jednostkowym.

## Success Criteria (Summary)

- Anonim nadal wchodzi na formularz logowania, a behawiorysta na `/dashboard`.
- Awaria auth albo `profiles` daje 503 i wpis z kodem, bez e-maila.
- Złe hasło i konto bez wiersza profilu zachowują się jak dziś.
