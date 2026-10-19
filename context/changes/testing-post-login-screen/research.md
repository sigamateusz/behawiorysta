---
date: 2026-10-19T20:20:28+02:00
researcher: Mateusz
git_commit: d37d05d7cee6c1b74d52e92a2403f61592663afd
branch: testing-post-login-screen
repository: behawiorysta
topic: "Ekran po zalogowaniu na podglądzie: rola w sesji, adres lądowania i luka wobec tablicy tras"
tags: [research, codebase, auth, roles, playwright, preview]
status: complete
last_updated: 2026-10-19
last_updated_by: Mateusz
---

# Research: Ekran po zalogowaniu na podglądzie

**Date**: 2026-10-19T20:20:28+02:00
**Researcher**: Mateusz
**Git Commit**: d37d05d7cee6c1b74d52e92a2403f61592663afd
**Branch**: testing-post-login-screen
**Repository**: behawiorysta

## Research Question

Dla fazy 2 planu testów (ryzyko #3, zmiana `testing-post-login-screen`): skąd bierze się rola w żądaniu po zalogowaniu, na jaki adres trafia klient i behawiorysta, czym podgląd (`build` + `preview`) różni się od testu tablicy tras w pamięci, i które istniejące asercje tego lądowania nie dowodzą.

## Summary

Na commicie `d37d05d7cee6c1b74d52e92a2403f61592663afd` udany `POST /api/auth/signin` czyta `profiles.role` w tym samym żądaniu, gdy `data.user.id` jest ustawione. Gdy odczyt wraca bez błędu i `profile.role === "behaviorist"`, odpowiedź przekierowuje na `/dashboard`. Gdy ten warunek nie zachodzi — pusty `userId`, błąd odczytu, brak wiersza albo inna wartość roli — lokalna rola zostaje `null`, a `redirectAfterSignIn` zwraca `/`.

Ankieta z kopią „Najpierw wypełnij ankietę…” jest stroną `/consultations/new`. Kalendarz behawiorysty jest siatką miesiąca na `/dashboard` (nagłówki `Pn`–`Nd`, linki miesiąca). Strona `/` renderuje powitanie startera; pasek zalogowanego klienta prowadzi do `/consultations`, a stamtąd link „Umów konsultację” prowadzi do ankiety.

Rola używana przy przekierowaniu jest kolumną `public.profiles.role`, nie claimem z `getUser()`. Middleware powtarza ten odczyt na następnym żądaniu i zapisuje go w `context.locals.role`.

`src/lib/role-routes.test.ts` porównuje zwroty dwóch funkcji. Nie wysyła `POST`, nie czyta profilu i nie otwiera podglądu. Playwright na tym commicie jest ustawiony na `npm run build && npm run preview`, a w `tests/e2e` są dwa pliki: setup jednego konta z `.env` oraz seed wizyty bez sesji na `/auth/signin`. W przejrzanym `.github/workflows/ci.yml` żaden krok nie uruchamia `npx playwright test`.

Zdanie dowodu w `context/foundation/test-plan.md` (wiersz ryzyka #3) mówi, że sesja klienta ląduje w ankiecie, a sesja behawiorysty w kalendarzu, na runtime podglądu. Handler sign-in i kontrakt S-02 wysyłają klienta na `/`, a behawiorystę na `/dashboard`. Który adres ma asercja przeglądarki fazy 2, zostaje wyborem planu.

## Detailed Findings

### Rola w żądaniu sign-in i w następnym żądaniu

Cookie sesji składa `createClient` z nagłówka `Cookie` (`src/lib/supabase.ts:6-21`). Brak `SUPABASE_URL` albo `SUPABASE_KEY` zwraca z tej funkcji `null` (`src/lib/supabase.ts:7-8`). Handler sign-in przy `null` przekierowuje na `/auth/signin?error=…` z tekstem „Supabase is not configured” (`src/pages/api/auth/signin.ts:11-12`).

Gdy klient Supabase istnieje i `signInWithPassword` się udaje, handler czyta jeden wiersz `profiles.role` po `data.user.id` (`src/pages/api/auth/signin.ts:20-27`). Zmienna `role` startuje jako `null` i dostaje `"behaviorist"` wyłącznie w gałęzi `!profileError && profile?.role === "behaviorist"` (`src/pages/api/auth/signin.ts:21-30`). Ten handler nie podstawia literału `"client"` do `redirectAfterSignIn`.

Middleware, na żądaniu, które przez niego przechodzi, woła `supabase.auth.getUser()` i zapisuje użytkownika w `context.locals.user` (`src/middleware.ts:18-22`). Dla ustawionego `user` wykonuje drugi `select` `profiles.role` i zapisuje wynik `toRole` w `context.locals.role` (`src/middleware.ts:24-26`). `toRole` zostawia `"client"` i `"behaviorist"`; inny tekst, w tym `undefined`, daje `null` (`src/middleware.ts:8-9`). Ten `select` w przejrzanym middleware nie czyta pola `error`. Typ `Locals.role` to `"client" | "behaviorist" | null` (`src/env.d.ts:1-6`).

Nowe konto dostaje rolę z triggera `handle_new_user`: insert `(new.id, 'client')` po insertcie do `auth.users` (`supabase/migrations/20261001182110_client_survey_and_slot.sql:21-37`). Kolumna ma `default 'client'` i check `('client', 'behaviorist')` (`supabase/migrations/20261001182110_client_survey_and_slot.sql:5-8`). Grant dla `authenticated` na `profiles` w tej migracji to `select` własnego wiersza (`supabase/migrations/20261001182110_client_survey_and_slot.sql:13-19`). Promocja behawiorysty w smoke jest osobnym SQL: `update public.profiles set role = 'behaviorist' …` przez `npx supabase db query --local` (`scripts/smoke.mjs:102-107`).

Wyszukanie `app_metadata` i `user_metadata` w `src/**/*.{ts,astro}` na tym commicie nie zwróciło trafień. Odczyt roli w otwartych `signin.ts` i `middleware.ts` idzie przez `profiles.role`.

### Adres po udanym sign-in

`redirectAfterSignIn` zwraca `"/dashboard"` dla argumentu `"behaviorist"` i `"/"` dla `"client"` oraz `null` (`src/lib/role-routes.ts:11-16`). Sign-in woła `context.redirect` z tym wynikiem (`src/pages/api/auth/signin.ts:33`). Trzy kroki smoke dla haseł kont klienta oczekują statusu `302` i nagłówka `Location` zaczynającego się od `"/"` (`scripts/smoke.mjs:147-149`, `165-167`, `281-283`). Krok „behaviorist signin reaches dashboard” oczekuje statusu `302` i `Location` zaczynającego się od `"/dashboard"` (`scripts/smoke.mjs:222-229`).

`stepPassed` uznaje lokalizację za zgodną, gdy `actual.location.startsWith(expected.location)` (`scripts/smoke.mjs:117-119`). Przy oczekiwanym `"/"` warunek spełnia nagłówek, którego tekst zaczyna się od `/`, a więc także teksty `"/dashboard"` i `"/consultations"`, o ile runtime zwraca ścieżkę względną. Tego nagłówka nie złapano w tym badaniu na żywym podglądzie.

`/` nie jest na liście `PROTECTED_ROUTES` (`src/middleware.ts:5`). Wejście na `/` po sign-in klienta nie uruchamia `dashboardRedirect`. Strona `/` renderuje `Welcome` (`src/pages/index.astro:1-7`). W przejrzanym `Welcome.astro` hero „10x Astro Starter” oraz linki „Sign In” i „Sign Up” są bez gałęzi roli (`src/components/Welcome.astro:22-40`). Pasek, gdy `role === "client"`, dodaje link „Moje konsultacje” na `/consultations`; w gałęzi zalogowanego użytkownika o innej roli link nazywa się „Dashboard” i prowadzi na `/dashboard` (`src/components/Topbar.astro:7-25`).

Lista klienta ma tytuł „Moje zgłoszenia” i link „Umów konsultację” na `/consultations/new` zarówno przy pustej liście, jak i przy niepustej (`src/pages/consultations/index.astro:47-56`, `74-78`). Strona ankiety ma nagłówek „Umów konsultację” i akapit „Najpierw wypełnij ankietę o swoim psie, a potem wybierz wolny termin.” (`src/pages/consultations/new.astro:17-23`).

Siatka na `/dashboard` renderuje `WEEKDAYS` (`Pn`, `Wt`, `Śr`, `Cz`, `Pt`, `So`, `Nd`) oraz linki „Poprzedni miesiąc” i „Następny miesiąc” (`src/pages/dashboard.astro:34`, `310-327`).

### Strażniki, gdy rola otwiera cudzy adres

Dla ścieżki zaczynającej się od `/dashboard`, przy ustawionym `locals.user`, middleware przekierowuje, gdy `dashboardRedirect(locals.role)` nie jest `null` (`src/middleware.ts:38-42`). Ta funkcja zwraca `null` dla `"behaviorist"`, `"/consultations"` dla `"client"` i `"/"` dla `null` (`src/lib/role-routes.ts:1-8`).

Dla ścieżki zaczynającej się od `/consultations` middleware wysyła rolę `"behaviorist"` na `/dashboard`, a rolę różną od `"client"` na `/` (`src/middleware.ts:45-51`). Brak `locals.user` na ścieżce z `PROTECTED_ROUTES` (`"/dashboard"` i `"/consultations"`) idzie na `/auth/signin` (`src/middleware.ts:5`, `32-35`).

`dashboardRedirect` ma drugiego wołającego: `requireBehavioristForm` (`src/lib/consultation-api.ts:29-41`). To strażnik formularza behawiorysty, nie odpowiedź `POST /api/auth/signin`.

### Podgląd wobec testu w pamięci i wobec `astro dev`

Konfiguracja Astro ma `output: "server"` i adapter `cloudflare` (`astro.config.mjs:11-16`). Sekrety `SUPABASE_URL` i `SUPABASE_KEY` są opcjonalne (`astro.config.mjs:18-22`). Skrypty `dev`, `build` i `preview` to odpowiednio `astro dev`, `astro build` i `astro preview` (`package.json:6-8`). `npm run smoke` uruchamia `scripts/smoke.mjs` i samo nie startuje serwera (`package.json:13`, komentarz w `scripts/smoke.mjs:1-2`).

`playwright.config.ts` ładuje `.env`, gdy plik istnieje (`playwright.config.ts:5-6`). `webServer.command` to `` `npm run build && npm run preview -- --port ${PORT}` ``, z `PORT` równym `E2E_PORT` albo `4321`, `reuseExistingServer: !process.env.CI`, timeout `180_000` i `ASTRO_PREVIEW_BACKGROUND: "1"` (`playwright.config.ts:8-11`, `33-40`). Job `smoke` w CI buduje aplikację, kopiuje sekrety lokalnego Supabase do `.env` i do `.dev.vars`, potem odpala `npm run preview -- --port 4321` i `BASE_URL=http://localhost:4321 npm run smoke` (`.github/workflows/ci.yml:44-54`). Który z tych dwóch plików proces podglądu czyta w Astro 7, nie było sprawdzane w dokumentacji Astro w tym przebiegu.

Test jednostkowy woła funkcje z argumentem roli i porównuje string (`src/lib/role-routes.test.ts:4-29`). Sześć przypadków w tym pliku to: `dashboardRedirect` → `null`, `"/consultations"`, `"/"` oraz `redirectAfterSignIn` → `"/dashboard"`, `"/"`, `"/"`. Nie ma tam ciasteczka, drugiego selectu profilu ani procesu `astro preview`.

Rozjazd, który tablica w pamięci pomija na tej ścieżce: sign-in decyduje o `Location` ze swojego selectu (`src/pages/api/auth/signin.ts:23-33`), a kolejne `GET /dashboard` decyduje ponownie w middleware (`src/middleware.ts:24-42`). Przeglądarka, która idzie za przekierowaniem na podglądzie, widzi oba odczyty i bundle po `astro build`. Sam zwrot `redirectAfterSignIn("behaviorist") === "/dashboard"` widzi jeden literał.

### Co już jest zasertowane

W `tests/e2e` na tym commicie są dwa pliki.

`tests/e2e/seed.spec.ts` czyści `storageState`, otwiera `/dashboard` i oczekuje URL pasującego do `/auth/signin` oraz widocznych „Sign in” (nagłówek i przycisk) (`tests/e2e/seed.spec.ts:1-11`). Komentarz pliku nazywa ryzyko `auth-gate-redirect`: wizyta bez sesji.

`tests/e2e/auth.setup.ts` loguje jedno konto z `E2E_USERNAME` / `E2E_PASSWORD`, powtarza wypełnienie formularza, aż ścieżka przestanie zaczynać się od `/auth/signin`, oczekuje przycisku „Sign out” i zapisuje `playwright/.auth/user.json` (`tests/e2e/auth.setup.ts:5-24`). Projekt `chromium` używa tego pliku stanu i zależy od projektu `setup` (`playwright.config.ts:25-31`). Setup nie czyta roli i nie oczekuje `/`, `/dashboard` ani `/consultations/new`. Rola konta z `.env` nie jest w repozytorium (plik jest w `.gitignore` według komentarza konfiguracji; wartości nie otwierano).

Joby w przejrzanym `.github/workflows/ci.yml` to `ci` (lint, `astro check`, `npm test`, `npm run build`) i `smoke` (podgląd i `npm run smoke`). Wyszukanie `playwright` w `.github` nie zwróciło trafień. `context/foundation/test-plan.md:115` oznacza `npx playwright test` jako `planned (Phase 2)`.

Krok smoke „behaviorist signin reaches dashboard” sprawdza status i prefiks `Location` przy `redirect: "manual"` (`scripts/smoke.mjs:43-46`, `222-229`). Nie pobiera HTML `/dashboard` i nie szuka nagłówków dni. Plan archiwalny fazy zapisu niedostępnego terminu nazywa to sprawdzenie promocji fixture roli, nie testem ryzyka #3 (`context/archive/2026-10-15-testing-unavailable-slot-write/plan.md:33`, `:89`). To zdanie historyczne zostaje zgodne z tym, co krok smoke asertuje dzisiaj.

## Code References

- `src/lib/role-routes.ts:1-16` — `dashboardRedirect` i `redirectAfterSignIn`
- `src/pages/api/auth/signin.ts:11-33` — błąd braku Supabase, select roli, przekierowanie
- `src/middleware.ts:5-54` — sesja, drugi select roli, strażniki `/dashboard` i `/consultations`
- `src/lib/supabase.ts:6-21` — klient z ciastek; `null` bez sekretów
- `src/lib/role-routes.test.ts:4-29` — sześć porównań stringów
- `src/pages/index.astro:1-7` — `/` renderuje `Welcome`
- `src/pages/consultations/new.astro:17-23` — nagłówek i akapit ankiety
- `src/pages/dashboard.astro:34`, `310-327` — nagłówki dni i nawigacja miesiąca
- `playwright.config.ts:33-40` — webServer: build i preview
- `tests/e2e/seed.spec.ts:1-11` — wizyta bez sesji
- `tests/e2e/auth.setup.ts:5-24` — jedno konto, bez ścieżki docelowej
- `scripts/smoke.mjs:117-119`, `147-149`, `222-229` — prefiks `Location`
- `.github/workflows/ci.yml:10-54` — joby `ci` i `smoke`
- `supabase/migrations/20261001182110_client_survey_and_slot.sql:5-37` — domyślna rola `client` i trigger

## Architecture Insights

Dwa odczyty `profiles.role` stoją na drodze „behawiorysta widzi kalendarz”: jeden w `POST` sign-in, drugi w middleware przy `GET /dashboard`. Funkcja czysta pokrywa mapowanie argumentu na literał. Podgląd z prawdziwym ciasteczkiem pokrywa oba selecty i bundle po `astro build`.

Jedno `storageState` z `auth.setup.ts` opisuje jedno konto. Seed i tak je zeruje. Asercja dwóch ról na podglądzie potrzebuje dwóch sesji; rola konta `E2E_USERNAME` nie wynika z plików w repozytorium. Smoke rozdziela role, tworząc konta i promując jedno SQL-em (`scripts/smoke.mjs:102-107`).

Formularz sign-in w setupie Playwrighta jest wypełniany w pętli, bo wyspa React gubi tekst wpisany przed hydracją (`tests/e2e/auth.setup.ts:13-21`). To zachowanie setupu na tym commicie, nie osobny pomiar hydracji.

## Historical Context (from prior changes)

Każde zdanie osobno, wobec kodu na `d37d05d7cee6c1b74d52e92a2403f61592663afd`.

- **Wspierane.** Plan S-02: po udanym sign-in behawiorysta ląduje na `/dashboard`, klient na `/` (`context/archive/2026-10-08-behaviorist-submission-views/plan.md:197`). Zgadza się z `redirectAfterSignIn` i z gałęzią sign-in, która przekazuje `"behaviorist"` albo `null`.
- **Wspierane co do sensu, nieaktualne co do numerów linii.** Ten sam plan wskazywał krok smoke „dashboard renders…” przy `scripts/smoke.mjs:92` i oczekiwał dla klienta `302` na `/consultations` przy wejściu na `/dashboard` (`context/archive/2026-10-08-behaviorist-submission-views/plan.md:40`, `:185`). Dzisiaj ten krok jest w `scripts/smoke.mjs:151` i nadal oczekuje `{ status: 302, location: "/consultations" }`. Numery `88-92` z tamtego planu nie wskazują już tego kroku.
- **Wspierane.** Plan zapisu niedostępnego terminu: przekierowanie behawiorysty na `/dashboard` w smoke sprawdza promocję roli, nie ryzyko #3 (`context/archive/2026-10-15-testing-unavailable-slot-write/plan.md:33`, `:89`). Krok `scripts/smoke.mjs:222-229` sprawdza prefiks `Location` i przy `redirect: "manual"` nie czyta siatki.
- **Częściowo, z nazwanym wyjątkiem.** Plan testów, wiersz dowodu #3: „Sesja klienta ląduje w ankiecie, sesja behawiorysty w kalendarzu, na runtime podglądu” (`context/foundation/test-plan.md:57`). Część behawiorysty zgadza się z adresem `/dashboard` i siatką miesiąca. Część klienta nazywa ankietę; sign-in w kodzie zwraca dla gałęzi innej niż `behaviorist` adres `/`, a ankieta jest na `/consultations/new`. Linia 49 tego planu mówi, że Q3 przyjęło zdanie z przykładu wywiadu i że to strach, nie raport incydentu.
- **Wspierane jako cytat PRD, bez adresu URL.** FR-001 i FR-002 wymagają, żeby klient i behawiorysta mogli się zalogować (`context/foundation/prd.md:63-65`). Nie podają ścieżki po zalogowaniu. US w PRD ustawia kolejność „klient loguje się, wypełnia ankietę i wybiera termin” (`context/foundation/prd.md:38`, `:56`), bez adresu pierwszego ekranu.

## Related Research

- `context/archive/2026-10-08-behaviorist-submission-views/research.md` — widoki kalendarza i roli przed S-02
- `context/archive/2026-10-15-testing-unavailable-slot-write/plan.md` — smoke behawiorysty jako fixture roli
- `context/foundation/test-plan.md` — faza 2 i ryzyko #3
- `context/foundation/test-stack.md` — konfiguracja Playwrighta i seed `auth-gate-redirect`

## Open Questions

- Asercja fazy 2 dla klienta: adres `/` z kontraktu S-02 i obecnego sign-in, czy `/consultations/new` ze zdania dowodu w `test-plan.md:57`. Oba źródła są na dysku; wybór należy do planu.
- Rola konta `E2E_USERNAME` w gitignorowanym `.env` — nieodczytana. Jedno `storageState` nie rozdziela klienta i behawiorysty.
- Który plik sekretów czyta `astro preview` w Astro 7 (`.env` czy `.dev.vars`). CI zapisuje oba przed podglądem (`.github/workflows/ci.yml:47-48`); preferencji runtime nie sprawdzano w dokumentacji.
- Tego badania nie uruchamiano na żywym podglądzie, więc kształt nagłówka `Location` (ścieżka względna albo URL bezwzględny) zostaje właściwością matchera `startsWith`, nie zrzutem odpowiedzi.
