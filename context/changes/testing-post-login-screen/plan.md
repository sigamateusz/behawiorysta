# Ekran po zalogowaniu na podglądzie — Implementation Plan

## Overview

Klient po udanym sign-in ląduje na liście zgłoszeń (`/consultations`). Behawiorysta ląduje na kalendarzu (`/dashboard`). Playwright na podglądzie (`build` + `preview`) sprawdza oba ekrany z prawdziwą sesją, a CI uruchamia ten projekt.

## Current State Analysis

`redirectAfterSignIn("client")` zwraca `"/"` (`src/lib/role-routes.ts:11-16`). Handler sign-in i tak nie przekazuje literału `"client"`: lokalna rola startuje jako `null` i staje się `"behaviorist"` tylko przy `profile.role === "behaviorist"` (`src/pages/api/auth/signin.ts:21-33`). Rola `client`, błąd odczytu i brak wiersza idą tą samą ścieżką na `/`.

Lista „Moje zgłoszenia” jest pod `/consultations`, z tekstem „Nie masz jeszcze żadnych zgłoszeń.” przy pustym zbiorze (`src/pages/consultations/index.astro:47-79`). Ankieta jest osobną stroną `/consultations/new`. Kalendarz na `/dashboard` pokazuje link „Poprzedni miesiąc” dopiero gdy odczyt się uda; przy błędzie zostaje komunikat „Nie udało się wczytać kalendarza.” (`src/pages/dashboard.astro:296-314`).

`dashboardRedirect` już wysyła klienta z `/dashboard` na `/consultations` (`src/lib/role-routes.ts:1-8`). Tego strażnika ta zmiana nie rusza.

Smoke przy `redirect: "manual"` uznaje lokalizację, gdy nagłówek `startsWith` oczekiwanego tekstu (`scripts/smoke.mjs:117-119`). Trzy kroki sign-in klienta oczekują `"/"` (`scripts/smoke.mjs:149`, `:167`, `:283`). Tekst `"/consultations"` spełnia oczekiwanie `"/"`.

Playwright buduje i podnosi podgląd (`playwright.config.ts:33-40`). Projekt `chromium` zależy od `setup`, które loguje `E2E_USERNAME` i zapisuje `playwright/.auth/user.json` (`playwright.config.ts:25-31`, `tests/e2e/auth.setup.ts:5-24`). Rola tego konta nie jest w repozytorium. Seed `auth-gate-redirect` sprawdza wizytę bez sesji (`tests/e2e/seed.spec.ts:1-11`). W `.github/workflows/ci.yml` są joby `ci` i `smoke`; Playwrighta nie ma. Lokalny Supabase ma `enable_confirmations = false` (`supabase/config.toml:209`), więc smoke loguje się zaraz po signupie, który kończy się na `/auth/confirm-email`.

## Desired End State

Po sign-in konto z `profiles.role = client` otwiera listę swoich zgłoszeń. Konto z rolą `behaviorist` otwiera kalendarz. Rola `null`, błąd odczytu profilu i brak wiersza dalej kończą sign-in na `/`.

`npx playwright test --project=preview` na podglądzie przechodzi dla obu ról i dla seeda wizyty bez sesji. Job CI robi to samo po starcie lokalnego Supabase. Zdanie dowodu ryzyka #3 i cookbook §6.3 nazywają listę, nie ankietę.

### Key Discoveries:

- Dwa odczyty `profiles.role`: select w `POST` sign-in i drugi select w middleware na następnym żądaniu (`src/pages/api/auth/signin.ts:23-33`, `src/middleware.ts:24-42`). Przeglądarka, która idzie za przekierowaniem, widzi oba.
- Promocja behawiorysty jest SQL-em `update public.profiles set role = 'behaviorist'`, wołanym przez `npx supabase db query --local` (`scripts/smoke.mjs:102-107`). Aplikacja nie ma endpointu zmiany roli.
- Formularz sign-in gubi tekst wpisany przed hydracją wyspy; setup powtarza fill i submit (`tests/e2e/auth.setup.ts:13-21`).
- CI smoke zapisuje sekrety do `.env` i do `.dev.vars` przed buildem (`.github/workflows/ci.yml:44-48`).

## What We're NOT Doing

- Lądowanie klienta na ankiecie `/consultations/new`.
- Zmiana lądowania roli `null` (zostaje `/`).
- Zmiana `dashboardRedirect` i strażników middleware.
- Mock sesji albo użycie `E2E_USERNAME` jako klienta lub behawiorysty w specu ryzyka #3.
- Usunięcie projektu `setup` / `chromium` dla lokalnego konta z `.env`.
- Playwright dla ryzyk innych niż #3.
- Zmiana statusu fazy 2 w tabeli rolloutu `context/foundation/test-plan.md` §3. To zostaje przy `/10x-test-plan`.

## Implementation Approach

Najpierw sign-in zaczyna przekazywać rolę `client`, a `redirectAfterSignIn` wysyła ją na `/consultations`. Test jednostkowy i trzy kroki smoke łapią ten adres. Potem spec na podglądzie zakłada dwa świeże konta (signup jak smoke, jedno promowane tym samym SQL-em), loguje każde przez formularz we własnym kontekście i sprawdza widoczny ekran. Job CI uruchamia projekt bez setupu z `.env`.

## Critical Implementation Details

Sam zapis `redirectAfterSignIn("client") === "/consultations"` nie zmienia odpowiedzi sign-in. Handler musi wstawić `"client"`, gdy `profiles.role` jest `client`. Inaczej klient dalej jedzie jako `null` na `/`.

Matcher smoke to `startsWith`. Oczekiwanie `"/"` zostaje zielone, gdy `Location` to `/consultations`. Te trzy kroki mają oczekiwać `"/consultations"`.

Projekt `chromium` wymaga pliku `playwright/.auth/user.json` i konta `E2E_USERNAME`. Job CI i spec ryzyka #3 idą projektem bez tej zależności i bez `storageState`. `webServer` sam robi `build` i `preview`; job nie podnosi drugiego podglądu.

## Phase 1: Przekierowanie klienta

### Overview

Udany sign-in konta `client` przekierowuje na `/consultations`. Rola `null` zostaje na `/`. Behawiorysta zostaje na `/dashboard`. Test jednostkowy i smoke oczekują listy.

### Changes Required:

#### 1. Mapa lądowania

**File**: `src/lib/role-routes.ts`

**Intent**: Klient po sign-in ma trafić na listę zgłoszeń, zgodnie z wyborem z planowania.

**Contract**: `redirectAfterSignIn("client")` zwraca `"/consultations"`. `"behaviorist"` zwraca `"/dashboard"`. `null` zwraca `"/"`. Typ zwracany obejmuje te trzy literały. `dashboardRedirect` bez zmian.

#### 2. Odczyt roli w sign-in

**File**: `src/pages/api/auth/signin.ts`

**Intent**: Lista ma być lądowaniem konta `client`, a strona główna lądowaniem braku roli. Dziś obie gałęzie są `null`.

**Contract**: Lokalna rola ma typ `"client" | "behaviorist" | null`. Po udanym `signInWithPassword` i przy ustawionym `userId` select `profiles.role` ustawia `"behaviorist"`, gdy wartość to `behaviorist`, i `"client"`, gdy wartość to `client`. `profileError`, brak wiersza, inny tekst oraz brak `userId` zostawiają `null`. Do `redirectAfterSignIn` wchodzi ta wartość.

#### 3. Test tablicy

**File**: `src/lib/role-routes.test.ts`

**Intent**: Tablica tras ma oczekiwać listy dla klienta, żeby regresja na `/` była czerwona w `npm test`.

**Contract**: `redirectAfterSignIn("client")` oczekuje `"/consultations"`. Przypadki `behaviorist` → `"/dashboard"` i `null` → `"/"` oraz trzy przypadki `dashboardRedirect` zostają.

#### 4. Smoke sign-in klienta

**File**: `scripts/smoke.mjs`

**Intent**: Trzy kroki klienta mają przestać akceptować samą stronę główną.

**Contract**: Kroki „signin accepts correct password”, „A signin accepts correct password” i „B signin accepts correct password” mają `location: "/consultations"`. Matcher `startsWith` zostaje. Krok „behaviorist signin reaches dashboard” zostaje przy `location: "/dashboard"`.

### Success Criteria:

#### Automated Verification:

- `npm test` przechodzi: `redirectAfterSignIn("client")` zwraca `/consultations`, `behaviorist` zwraca `/dashboard`, `null` zwraca `/`
- `npm run smoke` na podglądzie z lokalnym Supabase przechodzi, a kroki „signin accepts correct password”, „A signin accepts correct password” i „B signin accepts correct password” oczekują `location: "/consultations"`

#### Manual Verification:

- Ręczne logowanie klienta na podglądzie otwiera `/consultations` z nagłówkiem „Moje zgłoszenia”; behawiorysta otwiera `/dashboard`

**Implementation Note**: Po zielonej weryfikacji automatycznej zatrzymaj się na ręczne potwierdzenie, zanim przejdziesz do fazy 2.

---

## Phase 2: Ekran na podglądzie

### Overview

Spec Playwrighta na podglądzie sprawdza widoczną listę klienta i widoczny kalendarz behawiorysty. CI uruchamia ten projekt. Plan testów nazywa listę i komendę projektu.

### Changes Required:

#### 1. Projekt bez konta z `.env`

**File**: `playwright.config.ts`

**Intent**: Bramka ryzyka #3 ma przechodzić bez `E2E_USERNAME` i bez pliku `storageState`.

**Contract**: Projekt o nazwie `preview` ma `testMatch` na `*.spec.ts`, bez `storageState` i bez `dependencies` na `setup`. Projekty `setup` i `chromium` zostają dla lokalnego konta z `.env`. `webServer` zostaje `npm run build && npm run preview`.

#### 2. Spec dwóch ról

**File**: `tests/e2e/post-login-screen.spec.ts`

**Intent**: Prawdziwa sesja na podglądzie ma pokazać listę klientowi i kalendarz behawioryście. Seed wizyty bez sesji tego nie robi.

**Contract**: Dwa świeże konta przez `POST /api/auth/signup` na podgląd, tymi polami co smoke. Jedno promowane tym samym `update public.profiles set role = 'behaviorist'` i `npx supabase db query --local` z katalogu repozytorium, z tą samą obsługą Windows co `promoteBehaviorist` w `scripts/smoke.mjs`. Każde konto loguje się przez formularz we własnym kontekście, z powtórzeniem fill i submit jak w `tests/e2e/auth.setup.ts`, bez `E2E_USERNAME`. Klient: ścieżka dokładnie `/consultations`, nagłówek „Moje zgłoszenia”, tekst „Nie masz jeszcze żadnych zgłoszeń.”. Behawiorysta: ścieżka `/dashboard`, link „Poprzedni miesiąc”. Spec nie ustawia `storageState` konta z `.env`.

#### 3. Job CI

**File**: `.github/workflows/ci.yml`

**Intent**: Bramka z planu testów ma być w CI, na tym samym lokalnym Supabase co smoke.

**Contract**: Nowy job, obok `ci` i `smoke`, na `ubuntu-latest` i Node 22. Start Supabase z tymi samymi wykluczeniami usług co job `smoke`, zapis `SUPABASE_URL` i `SUPABASE_KEY` do `.env` i do `.dev.vars`, potem `npx playwright install --with-deps chromium` i `npx playwright test --project=preview`. Job nie uruchamia własnego `npm run preview`. `supabase stop` w `if: always()`.

#### 4. Plan testów

**File**: `context/foundation/test-plan.md`

**Intent**: Zdanie dowodu i cookbook mają nazywać listę, którą wybrało planowanie, oraz komendę, którą odpala CI.

**Contract**: Wiersz dowodu ryzyka #3 mówi, że sesja klienta ląduje na liście `/consultations` („Moje zgłoszenia”), a sesja behawiorysty w kalendarzu (`/dashboard`, „Poprzedni miesiąc”), na runtime podglądu. §6.3 opisuje ten spec, komendę `npx playwright test --project=preview` i zakaz mocka sesji; znika TBD fazy 2. Wiersz bramki `npx playwright test` w §5 podaje komendę `--project=preview` i `required`. Kolumna Status fazy 2 w §3 zostaje bez zmian.

### Success Criteria:

#### Automated Verification:

- `npx playwright test --project=preview` przechodzi: świeży klient ląduje na `/consultations` z nagłówkiem „Moje zgłoszenia” i tekstem „Nie masz jeszcze żadnych zgłoszeń.”, świeży behawiorysta ląduje na `/dashboard` z linkiem „Poprzedni miesiąc”
- Ten sam projekt przechodzi seed `auth-gate-redirect`: wizyta bez sesji na `/dashboard` kończy się na `/auth/signin`
- `.github/workflows/ci.yml` ma job, który startuje lokalny Supabase, zapisuje `.env` i `.dev.vars`, instaluje Chromium i uruchamia `npx playwright test --project=preview`

#### Manual Verification:

- Ręczne logowanie klienta i behawiorysty na podglądzie pokazuje te same ekrany co spec
- W `context/foundation/test-plan.md` wiersz dowodu #3 i §6.3 nazywają listę `/consultations` oraz komendę `npx playwright test --project=preview`

**Implementation Note**: Po zielonej weryfikacji automatycznej zatrzymaj się na ręczne potwierdzenie obu ról na podglądzie.

---

## Testing Strategy

### Unit Tests:

- `redirectAfterSignIn` dla `client`, `behaviorist` i `null`.
- `dashboardRedirect` zostaje przy obecnych trzech przypadkach.

### Integration Tests:

- Smoke: trzy sign-iny klienta oczekują prefiksu `/consultations`; sign-in behawiorysty oczekuje `/dashboard`.
- Playwright `--project=preview`: lista pustego klienta, kalendarz behawiorysty, seed wizyty bez sesji.

### Manual Testing Steps:

1. Na podglądzie zaloguj świeżego klienta i sprawdź `/consultations`, nagłówek „Moje zgłoszenia” i pustą listę.
2. Zaloguj konto po promocji SQL i sprawdź `/dashboard` oraz link „Poprzedni miesiąc”.
3. Wejdź na `/dashboard` bez sesji i sprawdź `/auth/signin`.

## Performance Considerations

`webServer` buduje aplikację raz na uruchomienie Playwrighta. Job CI nie startuje drugiego podglądu obok tego procesu.

## Migration Notes

Brak migracji. Istniejące konto `client` przy następnym sign-in dostaje `/consultations`. Ciasteczka już zalogowanej sesji ta zmiana nie przepisuje.

## References

- Related research: `context/changes/testing-post-login-screen/research.md`
- Plan testów, ryzyko #3: `context/foundation/test-plan.md`
- Promocja roli i signup: `scripts/smoke.mjs:102-107`, `scripts/smoke.mjs:136-149`
- Powtórzenie hydracji: `tests/e2e/auth.setup.ts:13-21`
- Podgląd CI: `.github/workflows/ci.yml:44-54`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Przekierowanie klienta

#### Automated

- [x] 1.1 `npm test` przechodzi: `redirectAfterSignIn("client")` zwraca `/consultations`, `behaviorist` zwraca `/dashboard`, `null` zwraca `/`
- [x] 1.2 `npm run smoke` na podglądzie z lokalnym Supabase przechodzi, a kroki „signin accepts correct password”, „A signin accepts correct password” i „B signin accepts correct password” oczekują `location: "/consultations"`

#### Manual

- [ ] 1.3 Ręczne logowanie klienta na podglądzie otwiera `/consultations` z nagłówkiem „Moje zgłoszenia”; behawiorysta otwiera `/dashboard`

### Phase 2: Ekran na podglądzie

#### Automated

- [ ] 2.1 `npx playwright test --project=preview` przechodzi: świeży klient ląduje na `/consultations` z nagłówkiem „Moje zgłoszenia” i tekstem „Nie masz jeszcze żadnych zgłoszeń.”, świeży behawiorysta ląduje na `/dashboard` z linkiem „Poprzedni miesiąc”
- [ ] 2.2 Ten sam projekt przechodzi seed `auth-gate-redirect`: wizyta bez sesji na `/dashboard` kończy się na `/auth/signin`
- [ ] 2.3 `.github/workflows/ci.yml` ma job, który startuje lokalny Supabase, zapisuje `.env` i `.dev.vars`, instaluje Chromium i uruchamia `npx playwright test --project=preview`

#### Manual

- [ ] 2.4 Ręczne logowanie klienta i behawiorysty na podglądzie pokazuje te same ekrany co spec
- [ ] 2.5 W `context/foundation/test-plan.md` wiersz dowodu #3 i §6.3 nazywają listę `/consultations` oraz komendę `npx playwright test --project=preview`
