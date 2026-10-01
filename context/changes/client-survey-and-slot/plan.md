# Klient: ankieta psa i wybór terminu konsultacji — plan implementacji

## Overview

Plasterek S-01 z `context/foundation/roadmap.md`. Zalogowany klient wypełnia kompletną ankietę psa i dopiero wtedy wybiera wolny slot godzinowy. Zgłoszenie (ankieta + termin) trafia do bazy jako konsultacja `pending`. Przy okazji wchodzi pierwszy schemat domenowy: role (`profiles`), konsultacje, blokady terminów oraz izolacja danych klientów przez RLS. S-02 (widoki behawiorysty) i S-03 (UI blokad) dopinają się do tego modelu bez przeróbek.

## Current State Analysis

- Brak schematu domenowego: `supabase/` ma tylko `config.toml` (migracje włączone, `db.seed` wskazuje `./seed.sql`), nie ma katalogu `supabase/migrations/`. README (`README.md:115`) twierdzi, że aplikacja używa wyłącznie `auth.users`.
- Brak ról: `src/middleware.ts:4` chroni tylko `/dashboard`, a `App.Locals` (`src/env.d.ts:3`) ma jedynie `user`.
- Wzorce do naśladowania: endpointy z wielkim `POST` i `createClient()` (`src/pages/api/auth/signup.ts:4-19`), wyspy React z `FormField`, `SubmitButton`, `ServerError` (`src/components/auth/SignInForm.tsx:42-85`), strony Astro czytające `Astro.locals` (`src/pages/dashboard.astro:4`).
- `astro/zod` jest eksportowane przez Astro 7.3.2, więc walidacja nie wymaga nowej zależności. Vitest nie jest zainstalowany.
- Jedyny test to `scripts/smoke.mjs` (HTTP + słoik ciasteczek, bez zależności), uruchamiany w CI na lokalnym Supabase (`.github/workflows/ci.yml:27-55`). `supabase start` w CI aplikuje migracje, więc nowy schemat jest testowany automatycznie.
- `supabase/config.toml:209` — `enable_confirmations = false`, więc konta testowe logują się od razu po rejestracji.

## Desired End State

- Klient po rejestracji ma profil z rolą `client` (trigger). Behawiorystę nadaje się ręcznie jednym `update` (opisane w README).
- `/consultations/new`: krok 1 to ankieta (imię psa, rasa z podpowiedziami, wiek w latach i miesiącach, podstawowe informacje, nad czym pracować). Krok 2 (wybór slotu) jest dostępny dopiero po poprawnej ankiecie. Sloty: pn–pt, starty 10:00–17:00 co 60 min (Europe/Warsaw), od jutra do dnia „dziś + 28” włącznie, bez zablokowanych i zajętych.
- Zapis zgłoszenia jest atomowy względem wyścigu: dwa zgłoszenia na ten sam slot kończą się jednym sukcesem i jednym czytelnym komunikatem o zajętym terminie. Ankieta przegranego klienta zostaje w formularzu.
- `/consultations` pokazuje klientowi wyłącznie jego zgłoszenia (pies, termin, status). RLS gwarantuje, że inny klient nie odczyta ich nawet bezpośrednim zapytaniem.
- Blokada wpisana ręcznie w Studio (cały dzień albo zakres godzin) usuwa odpowiednie sloty z listy i odrzuca próbę zapisu na nie.
- Weryfikacja: `npm test`, `npm run lint`, `npx astro check`, `npm run build` i rozszerzony `npm run smoke` przechodzą lokalnie i w CI.

### Key Discoveries:

- `src/lib/supabase.ts:9` — `createServerClient` bez generyka. Po wygenerowaniu typów przechodzi na `createServerClient<Database>`.
- `src/middleware.ts:18` — ochrona tras przez `startsWith`, więc `/consultations` obejmie też `/consultations/new`.
- `scripts/smoke.mjs:23-36` — helper `request` zwraca tylko status i `location`. Sprawdzanie treści wymaga rozszerzenia o body.
- `src/pages/api/auth/signin.ts:19` — po zalogowaniu redirect na `/`. Smoke na tym polega (`scripts/smoke.mjs:54`), więc nie zmieniamy go w tym plasterku.

## What We're NOT Doing

- UI behawiorysty: kalendarz, lista, szczegóły (S-02), ekran blokowania dni i godzin (S-03), akceptacja/odrzucenie (S-04). Behawiorysta nie dostaje w tym plasterku żadnej polityki odczytu konsultacji.
- Konfigurowalne godziny pracy — są stałą w kodzie (zmiana = deploy).
- Kalendarz świąt — sloty są generowane pn–pt także w święta (np. 11.11, 24–26.12). Behawiorysta wycina je ręcznymi blokadami (README, później UI z S-03).
- Rezerwacje na dziś i dalej niż 28 dni w przód.
- Profile psów wielokrotnego użytku — każde zgłoszenie to nowa ankieta.
- Edycja i anulowanie zgłoszenia przez klienta.
- Maile, podsumowanie AI, przekierowanie po zalogowaniu zależne od roli.
- Pilnowanie godzin pracy i blokad na poziomie bazy (trigger). Te reguły egzekwuje serwer Astro, baza pilnuje tylko unikalności slotu i własności wiersza. Klucz Supabase jest wyłącznie po stronie serwera, więc ścieżka „z pominięciem serwera” wymaga świadomego wyciągnięcia tokenu z ciasteczka. Akceptowalne w v1.

## Implementation Approach

Kolejność: baza → czysta logika → endpointy/UI → testy przepływu. Reguły dostępności (godziny pracy, okno, blokady, zajętość) liczy jedna funkcja w czystym module `src/lib/slots.ts`, używana i przez stronę (lista slotów), i przez endpoint zapisu (ponowna kontrola). Dzięki temu UI i serwer nie mogą się rozjechać. Zajęte sloty klient poznaje przez funkcję SQL `security definer`, która zwraca same godziny startu, bo RLS nie pozwala mu czytać cudzych konsultacji. Wyścig rozstrzyga unikalny indeks częściowy, a endpoint tłumaczy błąd `23505` na komunikat dla klienta. Wyspa wysyła zgłoszenie `fetch`em i dostaje JSON, żeby przy konflikcie nie zgubić wypełnionej ankiety.

## Critical Implementation Details

**Strefa czasowa i zmiana czasu.** Sloty definiujemy w czasie lokalnym Europe/Warsaw, a zapisujemy jako `timestamptz` (UTC). Przeliczenie „data + godzina w Warszawie → instant UTC” musi korzystać z offsetu właściwego dla tej konkretnej daty (np. przez `Intl.DateTimeFormat` z `timeZone: "Europe/Warsaw"`), a nie ze stałego +1/+2. Zmiana czasu 25 października 2026 wypada w pierwszym oknie rezerwacji: pt 23.10 10:00 = 08:00Z, pn 26.10 10:00 = 09:00Z. To samo dotyczy wyznaczania „jutra” i „dziś + 28” — liczymy daty kalendarzowe w Warszawie, nie w UTC runtime'u Cloudflare. `now` jest parametrem funkcji, żeby testy były deterministyczne.

**Kolejność w migracji.** Trigger na `auth.users` tworzy profil tylko dla nowych kont. Migracja musi też dopisać profile `client` istniejącym użytkownikom, inaczej konta z wcześniejszych testów nie przejdą polityki `insert` na konsultacjach.

## Phase 1: Schemat danych, role i izolacja

### Overview

Pierwsza migracja domenowa, typy bazy i wczytywanie roli w middleware. Po tej fazie baza wymusza izolację klientów, a aplikacja zna rolę zalogowanego użytkownika.

### Changes Required:

#### 1. Migracja schematu

**File**: `supabase/migrations/<timestamp>_client_survey_and_slot.sql` (nowy, nazwa z `npx supabase migration new client_survey_and_slot`)

**Intent**: Wprowadzić role, konsultacje z ankietą i blokady terminów wraz z RLS, tak żeby klient widział i tworzył wyłącznie własne zgłoszenia, a dwa aktywne zgłoszenia nie mogły zająć jednego slotu.

**Contract**:
- `public.profiles`: `id uuid pk references auth.users on delete cascade`, `role text not null default 'client' check (role in ('client','behaviorist'))`, `created_at timestamptz default now()`. RLS: `select` własnego wiersza (`id = auth.uid()`). Brak `insert/update` z API.
- Funkcja `public.handle_new_user()` (`security definer`, `set search_path = ''`) + trigger `after insert on auth.users` wstawiający profil `client`. Backfill istniejących `auth.users`.
- `public.consultations`: `id uuid pk default gen_random_uuid()`, `client_id uuid not null default auth.uid() references public.profiles on delete cascade`, `dog_name text` (1–60), `breed text` (1–80), `age_years smallint` (0–25), `age_months smallint` (0–11), `basic_info text` (1–2000), `goals text` (20–2000), `slot_start timestamptz not null`, `status text not null default 'pending' check (status in ('pending','accepted','rejected'))`, `created_at timestamptz default now()`. Długości jako `check (char_length(...) between …)`, plus `check (age_years * 12 + age_months >= 1)`.
- Indeks unikalny częściowy `consultations_active_slot_uidx on (slot_start) where status in ('pending','accepted')`.
- RLS konsultacji: `select` gdy `client_id = auth.uid()`; `insert with check` gdy `client_id = auth.uid()`, `status = 'pending'` i profil autora ma rolę `client`. Brak `update/delete`.
- `public.availability_blocks`: `id uuid pk`, `starts_at timestamptz not null`, `ends_at timestamptz not null`, `note text null`, `created_at`, `check (ends_at > starts_at)`. RLS: `select` dla `authenticated`. Zapisy tylko z Studio (service role), polityka zapisu dla behawiorysty przyjdzie w S-03. Blokada całego dnia = zakres 00:00–24:00 czasu warszawskiego.
- Funkcja `public.taken_slot_starts(p_from timestamptz, p_to timestamptz) returns setof timestamptz` (`security definer`, `stable`, `set search_path = ''`) zwracająca `slot_start` aktywnych konsultacji w zakresie. `execute` tylko dla `authenticated` (`revoke` od `public`/`anon`).

#### 2. Typy bazy i klient Supabase

**File**: `src/db/database.types.ts` (generowany), `package.json`, `src/lib/supabase.ts`, `eslint.config.js`, `.prettierignore` (nowy)

**Intent**: Typowane zapytania do nowych tabel i RPC, a plik generowany wyłączony z lintowania i formatowania, żeby `eslint --fix` z lint-staged nie przepisywał go przy commicie.

**Contract**: skrypt `"db:types": "supabase gen types typescript --local > src/db/database.types.ts"`. `createServerClient<Database>(…)` w `createClient`. `src/db/database.types.ts` w `globalIgnores` w `eslint.config.js` i w `.prettierignore`.

#### 3. Rola w middleware i `Locals`

**File**: `src/env.d.ts`, `src/middleware.ts`

**Intent**: Udostępnić rolę stronom i chronić trasy klienta: niezalogowany → `/auth/signin`, zalogowany behawiorysta → `/dashboard`.

**Contract**: `App.Locals.role: "client" | "behaviorist" | null`. Rola czytana z `profiles` tylko dla zalogowanego użytkownika. `PROTECTED_ROUTES` dostaje `/consultations`, a nowa lista `CLIENT_ROUTES = ["/consultations"]` sprawdza rolę: `behaviorist` → `/dashboard`, `null` (brak profilu albo błąd zapytania) → `/` (fail closed). Endpointy `/api/consultations*` sprawdzają sesję i rolę same i zwracają JSON 401/403 (bez redirectu).

#### 4. Dokumentacja

**File**: `README.md`

**Intent**: Usunąć zdanie „No database tables or migrations are required” i opisać: `npx supabase db reset` (zastosowanie migracji), `npm run db:types`, nadanie roli behawiorysty (`update public.profiles set role = 'behaviorist' where id = (select id from auth.users where email = '…');`) oraz ręczne dodanie blokady w Studio do czasu S-03, z gotowym zapytaniem dla całego dnia liczonego w czasie polskim (`insert into public.availability_blocks (starts_at, ends_at) values ('2026-11-11 00:00'::timestamp at time zone 'Europe/Warsaw', '2026-11-12 00:00'::timestamp at time zone 'Europe/Warsaw');`). Dopisać nowe trasy do tabeli tras.

### Success Criteria:

#### Automated Verification:

- Migracja aplikuje się na czystej bazie: `npx supabase db reset`
- Typy wygenerowane i zgodne ze schematem: `npm run db:types` nie zmienia pliku po commicie
- Typy i lint przechodzą: `npx astro check` oraz `npm run lint`
- Istniejący smoke dalej przechodzi: `npm run smoke`

#### Manual Verification:

- Po rejestracji nowego konta w Studio widać wiersz w `profiles` z rolą `client`
- Zapytanie SQL jako klient A nie zwraca konsultacji klienta B (po wstawieniu po jednej konsultacji dla A i B przez SQL; `set role authenticated` + `request.jwt.claims` w Studio)
- Konto z rolą `behaviorist` wchodzące na `/consultations` trafia na `/dashboard`

**Implementation Note**: Po tej fazie i zielonej weryfikacji automatycznej zatrzymaj się na ręczne potwierdzenie przed fazą 2.

---

## Phase 2: Logika terminów i walidacja ankiety

### Overview

Czyste, testowalne moduły: generowanie slotów, lista ras i schemat ankiety. Do tego Vitest.

### Changes Required:

#### 1. Generator slotów

**File**: `src/lib/slots.ts`

**Intent**: Jedno źródło prawdy o tym, które sloty klient może wybrać, używane przez stronę i przez endpoint zapisu.

**Contract**:
- Stałe: `TIME_ZONE = "Europe/Warsaw"`, `WORKING_DAYS = pn–pt`, `SLOT_STARTS = 10:00…17:00`, `SLOT_MINUTES = 60`, `BOOKING_HORIZON_DAYS = 28`.
- `availableSlots({ now, blocks, taken }): Date[]` — sloty od jutra (data warszawska) do dnia `dziś + 28` włącznie, z pominięciem: weekendów, slotów nachodzących na blokadę (`block.starts_at < slotEnd && block.ends_at > slotStart`) i slotów, których start jest w `taken`. Wynik posortowany rosnąco.
- `bookingWindow(now): { from: Date; to: Date }` — zakres do zapytań o blokady i zajęte sloty.
- `isAvailableSlot(slot, ctx): boolean` — dokładne dopasowanie startu do wyniku `availableSlots`.

#### 2. Pobieranie dostępności z bazy

**File**: `src/lib/availability.ts`

**Intent**: Złożyć `availableSlots` z danymi z Supabase (blokady w oknie + `taken_slot_starts`), wspólnie dla strony, API slotów i endpointu zapisu.

**Contract**: `getAvailableSlots(supabase, now): Promise<Date[]>`. Rzuca błąd przy błędzie zapytania (endpoint zamienia go na 500).

#### 3. Lista ras

**File**: `src/lib/breeds.ts`

**Intent**: Podpowiedzi rasy w formularzu.

**Contract**: `export const BREEDS: readonly string[]` — około 200 polskich nazw najpopularniejszych ras FCI plus „Mieszaniec”, posortowane alfabetycznie (`localeCompare` `pl`). Wartość spoza listy jest dozwolona.

#### 4. Schemat zgłoszenia

**File**: `src/lib/consultation-schema.ts`

**Intent**: Wspólna walidacja ankiety i slotu na kliencie (krok 1 → krok 2) i na serwerze, z polskimi komunikatami błędów per pole.

**Contract**: `surveySchema` (z `astro/zod`): pola przycięte (`trim`), limity jak w migracji, `age_years`/`age_months` liczby całkowite z `coerce`, łączny wiek ≥ 1 miesiąc. `consultationSchema = surveySchema.extend({ slot_start: ISO datetime })`. Eksport typu `ConsultationInput`.

#### 5. Vitest

**File**: `package.json`, `vitest.config.ts` (jeśli potrzebny dla aliasu `@/*`), `src/lib/slots.test.ts`, `src/lib/consultation-schema.test.ts`, `.github/workflows/ci.yml`

**Intent**: Testy jednostkowe logiki, w której łatwo o błąd (DST, granice okna, nakładanie blokad).

**Contract**: `npm i -D vitest`, skrypt `"test": "vitest run"`, krok `npm test` w jobie `ci` przed `build`.

### Success Criteria:

#### Automated Verification:

- Testy jednostkowe przechodzą: `npm test`
- Test DST: pt 23.10 10:00 = `2026-10-23T08:00:00Z`, pn 26.10 10:00 = `2026-10-26T09:00:00Z`
- Test okna: `now` = pn 2026-10-05 23:30 → pierwszy slot wt 06.10 10:00, ostatni dzień 02.11, brak sb/nd i 18:00
- Test blokad: pełny dzień usuwa 8 slotów; 12:30–13:30 usuwa 12:00 i 13:00; 11:00–12:00 usuwa tylko 11:00
- Test zajętości: start w `taken` znika z wyniku
- Test schematu: odrzuca puste pola, krótkie `goals`, `age_months = 12`, wiek 0/0; akceptuje rasę spoza `BREEDS`
- Lint i typy: `npm run lint` oraz `npx astro check`

Wszystkie godziny w testach to czas Europe/Warsaw; „krótkie `goals`” = poniżej 20 znaków po `trim`; w teście DST `now` = 2026-10-22 12:00.

#### Manual Verification:

- Lista `BREEDS` zawiera popularne rasy w poprawnej polskiej pisowni

**Implementation Note**: Po tej fazie i zielonej weryfikacji automatycznej zatrzymaj się na ręczne potwierdzenie przed fazą 3.

---

## Phase 3: Endpointy i ekrany klienta

### Overview

API slotów i zapisu, dwukrokowy formularz oraz lista „Moje zgłoszenia”.

### Changes Required:

#### 1. API wolnych slotów

**File**: `src/pages/api/consultations/slots.ts`

**Intent**: Świeża lista slotów dla wyspy (odświeżenie po konflikcie) i dla smoke testu.

**Contract**: `GET` → `200 { slots: string[] }` (ISO UTC). `401` bez sesji, `403` gdy rola ≠ `client`.

#### 2. API zapisu zgłoszenia

**File**: `src/pages/api/consultations/index.ts`

**Intent**: Przyjąć ankietę i slot, ponownie sprawdzić kompletność i dostępność po stronie serwera, zapisać konsultację `pending`.

**Contract**: `POST` (`FormData`) → `201 { id }`; `400 { errors: Record<pole, string> }` dla nieprawidłowej ankiety; `409 { error: "Ten termin został właśnie zajęty albo jest niedostępny — wybierz inny." }` gdy `isAvailableSlot` zwraca `false` albo insert kończy się kodem `23505`; `401`/`403` jak wyżej; `500 { error }` przy błędzie bazy. `client_id` z sesji (default `auth.uid()`), nigdy z formularza.

#### 3. Formularz dwukrokowy

**File**: `src/pages/consultations/new.astro`, `src/components/consultations/ConsultationForm.tsx` (+ ewentualnie `SurveyStep.tsx`, `SlotPicker.tsx` w tym katalogu)

**Intent**: Klient najpierw wypełnia ankietę. Przycisk „Dalej: wybierz termin” waliduje `surveySchema` i dopiero wtedy pokazuje sloty pogrupowane po dniach. Wysyłka zgłoszenia `fetch`em.

**Contract**:
- Strona liczy `getAvailableSlots` na serwerze i przekazuje ISO stringi jako props (`client:load`).
- Rasa: `FormField` z `<datalist>` z `BREEDS` (dowolny tekst dozwolony). `FormField` (`src/components/auth/FormField.tsx`) dostaje opcjonalny prop `list?: string` przekazywany do `<input>`. Formularze auth się nie zmieniają.
- „Podstawowe informacje” i „Nad czym chcesz pracować”: nowy `src/components/consultations/TextareaField.tsx` w stylu `FormField` (etykieta, błąd pod polem), z licznikiem znaków przy polu celów (min. 20).
- Wiek: dwa pola liczbowe (lata, miesiące).
- Etykiety slotów: `Intl.DateTimeFormat("pl-PL", { timeZone: "Europe/Warsaw" })`, np. „wt 6 paź · 10:00”.
- Powrót do kroku 1 zachowuje wybrany slot i wartości pól.
- `201` → `window.location.assign("/consultations?created=1")`. `400` → błędy przy polach i powrót do kroku 1. `409` → komunikat, odświeżenie slotów z `GET /api/consultations/slots`, ankieta zostaje. Pusta lista slotów → komunikat „Brak wolnych terminów w najbliższych 4 tygodniach”.
- Teksty UI po polsku.

#### 4. Lista zgłoszeń klienta

**File**: `src/pages/consultations/index.astro`

**Intent**: Potwierdzenie złożenia i podgląd własnych zgłoszeń.

**Contract**: Odczyt `consultations` przez RLS (bez filtra po `client_id` w kodzie — RLS jest jedynym filtrem, co jednocześnie dowodzi izolacji), sortowanie po `slot_start`. Kolumny: pies, rasa, termin (format warszawski), status (`pending` → „Oczekuje na decyzję”, `accepted` → „Zaakceptowana”, `rejected` → „Odrzucona”). Baner sukcesu przy `?created=1`. Pusty stan z CTA „Umów konsultację” → `/consultations/new`.

#### 5. Nawigacja

**File**: `src/components/Topbar.astro`

**Intent**: Klient dociera do swoich konsultacji z każdej strony.

**Contract**: Dla `role === "client"` link „Moje konsultacje” (`/consultations`) zamiast „Dashboard”.

### Success Criteria:

#### Automated Verification:

- Lint, typy i build: `npm run lint`, `npx astro check`, `npm run build`
- Testy jednostkowe dalej przechodzą: `npm test`

#### Manual Verification:

- Klient nie przejdzie do wyboru terminu z niekompletną ankietą; błędy przy polach
- Podpowiedzi rasy po wpisaniu „lab”; wpis spoza listy akceptowany
- Złożone zgłoszenie widoczne na `/consultations` ze statusem i terminem w czasie polskim
- Zajęty slot znika dla drugiego klienta; konflikt pokazuje komunikat, ankieta zostaje, sloty się odświeżają
- Blokada z Studio (dzień i zakres godzin) usuwa właściwe sloty
- Wygląd spójny na mobile i desktopie

Szczegóły: „lab” podpowiada np. „Labrador retriever”, wpis spoza listy to np. „Mieszaniec w typie owczarka”; status nowego zgłoszenia to „Oczekuje na decyzję”; konflikt sprawdzamy dwiema kartami z tym samym slotem.

**Implementation Note**: Po tej fazie i zielonej weryfikacji automatycznej zatrzymaj się na ręczne potwierdzenie przed fazą 4.

---

## Phase 4: Smoke przepływu rezerwacji i domknięcie

### Overview

Rozszerzenie `scripts/smoke.mjs` o przepływ klienta, w tym wyścig o slot i izolację. Synchronizacja roadmapy.

### Changes Required:

#### 1. Smoke test

**File**: `scripts/smoke.mjs`, `README.md` (sekcja Smoke test)

**Intent**: Udowodnić na zbudowanej aplikacji i prawdziwym Supabase, że klient rezerwuje slot, slot nie da się zająć drugi raz, a drugi klient nie widzi cudzego zgłoszenia.

**Contract**: Osobne słoiki ciasteczek na dwóch klientów (A, B). `request` zwraca też `body` (tekst). Nowe kroki po istniejących:
- A: `GET /consultations` bez sesji → 302 `/auth/signin` (anonim)
- A rejestruje się i loguje
- A: `GET /consultations/new` → 200
- A: `GET /api/consultations/slots` → 200, co najmniej jeden slot
- A: `POST /api/consultations` z niepełną ankietą → 400
- A: `POST` z kompletną ankietą (unikalne imię psa, np. `Smoke-<timestamp>`) i pierwszym slotem → 201
- A: `GET /consultations` → 200, body zawiera imię psa
- B rejestruje się i loguje
- B: `GET /api/consultations/slots` nie zawiera slotu A
- B: `POST` na slot A → 409
- B: `GET /consultations` → body nie zawiera imienia psa A
- Anonim: `POST /api/consultations` → 401

#### 2. Roadmapa

**File**: `context/foundation/roadmap.md`

**Intent**: Odzwierciedlić decyzję, że S-03 obejmuje blokadę dni i konkretnych godzin, na modelu z S-01.

**Contract**: Outcome S-03 w tabeli „At a glance” i w treści: „behawiorysta blokuje dni lub konkretne godziny, a zablokowane terminy nie przyjmują nowych konsultacji”. Risk S-03 dopisuje, że model blokad i filtrowanie istnieją od S-01, a S-03 dokłada UI i politykę zapisu. (Status S-01 → `planning` zostaje ustawiony przy zapisie tego planu.)

### Success Criteria:

#### Automated Verification:

- Rozszerzony smoke przechodzi lokalnie (`npm run build && npm run preview` + `npm run smoke`)
- Job `smoke` w CI jest zielony na PR (migracje aplikowane przez `supabase start`)
- Job `ci` jest zielony (lint, `astro check`, `npm test`, build)

#### Manual Verification:

- Pełny przepływ klienta przeklikany na `npm run dev` (rejestracja → ankieta → termin → „Moje konsultacje”)
- Treść roadmapy S-03 opisuje blokadę dni i godzin

**Implementation Note**: Po tej fazie plasterek S-01 jest gotowy do archiwizacji po potwierdzeniu ręcznym.

---

## Testing Strategy

### Unit Tests:

- `slots.ts`: zmiana czasu (23.10 vs 26.10.2026), granice okna (jutro, dzień +28 włącznie, `now` tuż przed północą), weekendy, brak slotu 18:00, nakładanie blokad (pełny dzień, zakres w połowie slotu, styk końca blokady ze startem slotu), zajęte sloty.
- `consultation-schema.ts`: wymagane pola po `trim`, limity długości, wiek (12 miesięcy, 0/0), rasa spoza listy, niepoprawny `slot_start`.

### Integration Tests:

- Rozszerzony `scripts/smoke.mjs`: rezerwacja, walidacja 400, konflikt 409, izolacja dwóch klientów, 401 dla anonima.

### Manual Testing Steps:

1. Zarejestruj klienta, wypełnij ankietę z rasą z podpowiedzi i wiekiem „0 lat 4 miesiące”, wybierz slot, sprawdź „Moje konsultacje”.
2. W Studio dodaj blokadę całego najbliższego dnia roboczego i blokadę 12:00–14:00 innego dnia. Odśwież formularz i sprawdź sloty.
3. Otwórz formularz w dwóch przeglądarkach (dwa konta), wybierz ten sam slot, wyślij z obu.
4. Nadaj kontu rolę `behaviorist` i wejdź na `/consultations` — oczekiwany redirect na `/dashboard`.

## Performance Considerations

Okno to maks. ~20 dni roboczych × 8 slotów = 160 slotów. Strona robi dwa zapytania (blokady w oknie, `taken_slot_starts`) plus odczyt roli w middleware na trasach chronionych. Bez cache.

## Migration Notes

Pierwsza migracja domenowa. Lokalnie: `npx supabase db reset` (kasuje dane lokalne) albo `npx supabase migration up`. Na chmurowym projekcie: `npx supabase db push` przed deployem kodu, który czyta `profiles`. Backfill profili w migracji obsługuje istniejące konta. Rollback: nowa migracja usuwająca tabele/funkcje/trigger (dane domenowe w v1 są testowe).

## References

- PRD: `context/foundation/prd.md` (FR-001, FR-003, FR-004, US-01, Business Logic, Access Control)
- Roadmapa: `context/foundation/roadmap.md` (S-01, S-03)
- Wzorzec endpointu: `src/pages/api/auth/signup.ts:4-19`
- Wzorzec formularza: `src/components/auth/SignInForm.tsx:42-85`
- Middleware: `src/middleware.ts:4-25`
- Smoke: `scripts/smoke.mjs:23-59`, CI: `.github/workflows/ci.yml:27-55`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Schemat danych, role i izolacja

#### Automated

- [x] 1.1 Migracja aplikuje się na czystej bazie: `npx supabase db reset` — 1fa9358
- [x] 1.2 Typy wygenerowane i zgodne ze schematem: `npm run db:types` nie zmienia pliku po commicie — 1fa9358
- [x] 1.3 Typy i lint przechodzą: `npx astro check` oraz `npm run lint` — 1fa9358
- [x] 1.4 Istniejący smoke dalej przechodzi: `npm run smoke` — 1fa9358

#### Manual

- [x] 1.5 Po rejestracji nowego konta w Studio widać wiersz w `profiles` z rolą `client` — 1fa9358
- [x] 1.6 Zapytanie SQL jako klient A nie zwraca konsultacji klienta B (po wstawieniu po jednej konsultacji dla A i B przez SQL; `set role authenticated` + `request.jwt.claims` w Studio) — 1fa9358
- [x] 1.7 Konto z rolą `behaviorist` wchodzące na `/consultations` trafia na `/dashboard` — 1fa9358

### Phase 2: Logika terminów i walidacja ankiety

#### Automated

- [x] 2.1 Testy jednostkowe przechodzą: `npm test` — 79d3524
- [x] 2.2 Test DST: pt 23.10 10:00 = `2026-10-23T08:00:00Z`, pn 26.10 10:00 = `2026-10-26T09:00:00Z` — 79d3524
- [x] 2.3 Test okna: `now` = pn 2026-10-05 23:30 → pierwszy slot wt 06.10 10:00, ostatni dzień 02.11, brak sb/nd i 18:00 — 79d3524
- [x] 2.4 Test blokad: pełny dzień usuwa 8 slotów; 12:30–13:30 usuwa 12:00 i 13:00; 11:00–12:00 usuwa tylko 11:00 — 79d3524
- [x] 2.5 Test zajętości: start w `taken` znika z wyniku — 79d3524
- [x] 2.6 Test schematu: odrzuca puste pola, krótkie `goals`, `age_months = 12`, wiek 0/0; akceptuje rasę spoza `BREEDS` — 79d3524
- [x] 2.7 Lint i typy: `npm run lint` oraz `npx astro check` — 79d3524

#### Manual

- [x] 2.8 Lista `BREEDS` zawiera popularne rasy w poprawnej polskiej pisowni — 79d3524

### Phase 3: Endpointy i ekrany klienta

#### Automated

- [x] 3.1 Lint, typy i build: `npm run lint`, `npx astro check`, `npm run build` — f0e1ddb
- [x] 3.2 Testy jednostkowe dalej przechodzą: `npm test` — f0e1ddb

#### Manual

- [x] 3.3 Klient nie przejdzie do wyboru terminu z niekompletną ankietą; błędy przy polach — f0e1ddb
- [x] 3.4 Podpowiedzi rasy po wpisaniu „lab”; wpis spoza listy akceptowany — f0e1ddb
- [x] 3.5 Złożone zgłoszenie widoczne na `/consultations` ze statusem i terminem w czasie polskim — f0e1ddb
- [x] 3.6 Zajęty slot znika dla drugiego klienta; konflikt pokazuje komunikat, ankieta zostaje, sloty się odświeżają — f0e1ddb
- [x] 3.7 Blokada z Studio (dzień i zakres godzin) usuwa właściwe sloty — f0e1ddb
- [x] 3.8 Wygląd spójny na mobile i desktopie — f0e1ddb

### Phase 4: Smoke przepływu rezerwacji i domknięcie

#### Automated

- [x] 4.1 Rozszerzony smoke przechodzi lokalnie (`npm run build && npm run preview` + `npm run smoke`)
- [x] 4.2 Job `smoke` w CI jest zielony na PR (migracje aplikowane przez `supabase start`)
- [x] 4.3 Job `ci` jest zielony (lint, `astro check`, `npm test`, build)

#### Manual

- [x] 4.4 Pełny przepływ klienta przeklikany na `npm run dev` (rejestracja → ankieta → termin → „Moje konsultacje”)
- [x] 4.5 Treść roadmapy S-03 opisuje blokadę dni i godzin
