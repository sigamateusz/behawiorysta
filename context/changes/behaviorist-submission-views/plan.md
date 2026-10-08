# Widoki zgłoszeń behawiorysty — plan implementacji

## Overview

Plasterek S-02 z `context/foundation/roadmap.md`. Behawiorysta loguje się, ląduje na `/dashboard` i widzi ten sam zbiór zgłoszeń na dwa sposoby: miesiąc w Europe/Warsaw oraz listę. Z listy i z dnia w siatce otwiera szczegóły z kompletną ankietą i terminem. Akceptacja, odrzucenie i blokady zostają w S-04 i S-03.

## Current State Analysis

Logowanie behawiorysty działa na tym samym formularzu co klient, o ile `profiles.role = behaviorist`. Ankieta i termin są jednym wierszem `public.consultations`. Kalendarza, listy behawiorysty i strony szczegółów nie ma. `POST /api/auth/signin` kończy się na `/` (`src/pages/api/auth/signin.ts:19`). Middleware wpuszcza na `/dashboard` każdego zalogowanego i wyrzuca behawiorystę z `/consultations` na `/dashboard` (`src/middleware.ts:31-43`).

Polityka `consultations_select_own` przepuszcza wiersz tylko gdy `client_id = auth.uid()` (`supabase/migrations/20261001182110_client_survey_and_slot.sql:70-72`). Klient ciasteczkowy używa klucza publishable, więc sesja behawiorysty nie odczyta cudzej ankiety. `profiles` nie ma e-maila. W `src/` nie ma klienta service role.

Lista klienta sortuje po `slot_start` i nie linkuje pozycji (`src/pages/consultations/index.astro:28-94`). Etykiety statusu: „Oczekuje na decyzję”, „Zaakceptowana”, „Odrzucona”. Godzinę slotu formatuje `formatSlotLabel` w Europe/Warsaw (`src/lib/slot-label.ts:7-23`). Koniec slotu nie jest kolumną; `SLOT_MINUTES = 60` (`src/lib/slots.ts:6`).

`/dashboard` renderuje angielską `DashboardCard` na tokenach (`src/pages/dashboard.astro:8-16`). `npm run lint` skanuje ten plik, `Topbar.astro`, `DashboardCard.tsx` i `src/pages/dev/dashboard-states.astro` (`scripts/check-view-tokens.mjs:9-14`). W `src/components/ui/` są tylko `button` i `card`. Nie ma komponentu kalendarza wydarzeń ani date-fns.

Smoke po sign-inie świeżego konta (rola `client`) oczekuje 200 na `/dashboard` (`scripts/smoke.mjs:88-92`).

## Desired End State

Behawiorysta po udanym sign-in jest na `/dashboard`. Widzi miesiąc (domyślnie bieżący miesiąc Warszawy, da się przewinąć `?month=YYYY-MM`) i listę **tego samego** zbioru:

- `pending` — zawsze, także gdy termin minął
- `accepted` — dopóki `slot_start + 60 min > now`; w chwili równości wizyta znika
- `rejected` oraz zakończone `accepted` — nie ma ich na liście, w siatce ani pod `/dashboard/[id]` (tam 404, bez pól ankiety)

Kolejność listy: `slot_start` rosnąco, potem `created_at` rosnąco, potem `id` rosnąco (`localeCompare`). Lista nie jest obcięta do widocznego miesiąca.

Przy „teraz” = 8.10.2026 15:00 Europe/Warsaw widać Fafika (oczekuje, 7.10 10:00), Burka (oczekuje, 9.10 10:00) i Azora (zaakceptowany, 2.11 17:00). Reks (odrzucony, 9.10 11:00) i Luna (zaakceptowana, 5.10 10:00) są schowani. Azor jest na liście już w październiku, a w siatce dopiero w listopadzie.

Szczegóły pokazują imię psa, rasę, wiek (`{age_years} lat, {age_months} mies.`), `basic_info`, `goals`, termin z `formatSlotLabel` i status po polsku. E-maila klienta nie ma.

Klient wchodzący na `/dashboard` lub `/dashboard/[id]` ląduje na `/consultations`. Rola `null` ląduje na `/`. Brak sesji ląduje na `/auth/signin`. Sign-in klienta nadal kończy się na `/`.

### Key Discoveries:

- `src/middleware.ts:4` — `startsWith("/dashboard")` obejmuje też `/dashboard/[id]`.
- `src/middleware.ts:37-39` — szczegóły nie mogą żyć pod `/consultations`, bo behawiorysta jest stamtąd wyrzucany.
- `supabase/migrations/20261001182110_client_survey_and_slot.sql:62-63` — częściowy unikalny indeks slotu dla `pending` i `accepted`. Remis `slot_start` w zbiorze widocznym nie wystąpi w bazie; test sortowania i tak go ma na czystej funkcji.
- `scripts/smoke.mjs:92` — krok „dashboard renders for signed-in user” oczekuje 200 dla sesji klienta. Po tej zmianie ma oczekiwać 302 na `/consultations`.
- `context/deployment/deploy-plan.md:98` — bez klucza service role. Odczyt idzie polityką RLS na kliencie ciasteczkowym.

## What We're NOT Doing

- E-mail klienta, kopia adresu na `consultations`, odczyt `auth.users`.
- Przyciski akceptacji i odrzucenia (S-04) oraz UI blokad (S-03). Siatka nie edytuje dostępności.
- Podsumowanie AI (FR-009).
- Archiwum odrzuconych i odbytych wizyt. Bezpośrednie zapytanie behawiorysty do PostgREST nadal je zobaczy, bo RLS puszcza każdy wiersz; chowa je tylko aplikacja.
- Przekierowanie klienta po sign-in (zostaje `/`). Tłumaczenie Welcome, „Sign out” i „Dashboard” w pasku. Usuwanie `DashboardCard` i `/dev/dashboard-states`.
- Link ze listy klienta do szczegółów. Przeróbka `/consultations` na tokeny.
- Biblioteka dat i shadcn Calendar (to wybór daty, nie siatka wydarzeń).
- Paginacja, wielu behawiorystów, maile.

## Implementation Approach

Najpierw czysta funkcja zbioru, z testem pięciu psów i granicy końca slotu, plus jedna polityka `select` dla roli `behaviorist` na wszystkich wierszach `consultations`. Filtr widoczności zostaje w aplikacji, żeby S-04 nie potrzebowało nowej polityki, gdy odrzucone mają wrócić na ekran. Potem reguły wejścia (middleware, sign-in, smoke klienta). Na końcu strony Astro czytają wiersze tym samym klientem ciasteczkowym co lista klienta i przepuszczają je przez funkcję zbioru. `now` jest argumentem, nie zegarem schowanym w module.

## Critical Implementation Details

**Koniec slotu, nie start.** Zaakceptowana wizyta 14:00–15:00 jest widoczna o 14:30 i znika o 15:00, gdy `slot_start + SLOT_MINUTES > now` przestaje być prawdą. Porównanie jest na instantach UTC. 2.11.2026 17:00 Warszawa to już CET: `2026-11-02T16:00:00.000Z`, nie `15:00Z`.

**RLS jest szersze niż ekran.** Polityka behawiorysty puszcza każdy wiersz. 404 dla Luny i Reksa robi zapytanie strony po `visibleSubmissions`, nie klauzula `USING`.

**Smoke.** Świeże konto w `scripts/smoke.mjs` ma rolę `client`. Krok z linii 92 nie może dalej oczekiwać 200 na `/dashboard`.

## Faza 1: Zbiór i odczyt

### Overview

Zbiór „najbliższych wydarzeń” jest jedną funkcją z testem, a behawiorysta w ogóle może przeczytać `consultations`.

### Changes Required:

#### 1. Funkcja zbioru

**File**: `src/lib/behaviorist-submissions.ts`

**Intent**: Jedno miejsce decyduje, które wiersze widać i w jakiej kolejności, żeby lista, siatka i szczegóły nie rozjechały się z testem.

**Contract**: Eksport `visibleSubmissions`. Wiersz wchodzi, gdy `status === "pending"`, albo gdy `status === "accepted"` i `Date.parse(slot_start) + SLOT_MINUTES * 60_000 > now.getTime()`. Inny status, nieparsowalny `slot_start` albo nieparsowalny `created_at` odpada. Sortowanie: instant `slot_start`, potem instant `created_at`, potem `id.localeCompare`. `SLOT_MINUTES` bierze z `src/lib/slots.ts`.

```ts
export function visibleSubmissions<T extends {
  id: string;
  status: string;
  slot_start: string;
  created_at: string;
}>(rows: readonly T[], now: Date): T[]
```

#### 2. Test pięciu psów i granicy slotu

**File**: `src/lib/behaviorist-submissions.test.ts`

**Intent**: Utwardza decyzję o zbiorze, zanim powstanie UI. Fixture używa instantów UTC, nie strefy maszyny.

**Contract**: Przy `now = 2026-10-08T13:00:00.000Z` (15:00 Warszawa, jeszcze CEST) funkcja zwraca wyłącznie, w tej kolejności:

| id | status | slot Warszawa | `slot_start` |
| --- | --- | --- | --- |
| fafik | pending | 7.10.2026 10:00 | `2026-10-07T08:00:00.000Z` |
| burek | pending | 9.10.2026 10:00 | `2026-10-09T08:00:00.000Z` |
| azor | accepted | 2.11.2026 17:00 | `2026-11-02T16:00:00.000Z` |

Schowane: `reks` rejected `2026-10-09T09:00:00.000Z`, `luna` accepted `2026-10-05T08:00:00.000Z`.

Osobne przypadki: accepted o starcie `2026-10-08T12:00:00.000Z` jest widoczny przy `now = 2026-10-08T12:30:00.000Z` i schowany przy `now = 2026-10-08T13:00:00.000Z`. Dwa wiersze z tym samym `slot_start`: wcześniejszy `created_at` pierwszy; przy równym `created_at` wygrywa mniejszy `id`.

#### 3. Polityka odczytu

**File**: `supabase/migrations/<nowy-znacznik>_behaviorist_select_consultations.sql`

**Intent**: Sesja behawiorysty czyta zgłoszenia klientów bez service role. Istniejącej migracji S-01 nie ruszamy.

**Contract**: Nowa polityka `consultations_select_behaviorist`, `for select to authenticated`, `using` z `exists` na `public.profiles` gdzie `id = (select auth.uid())` i `role = 'behaviorist'`. Bez filtra statusu i czasu. Grant `select` dla `authenticated` już jest. Polityka `consultations_select_own` zostaje. Kolumn nie dodajemy, `src/db/database.types.ts` bez zmian.

### Success Criteria:

#### Automated Verification:

- Testy zbioru przechodzą: `npm test` obejmuje pięć psów (Fafik, Burek, Azor; bez Reksa i Luny) oraz granicę `slot_start + 60 min > now`
- Lint przechodzi: `npm run lint`

#### Manual Verification:

- Migracja nakłada `consultations_select_behaviorist`: sesja behawiorysty czyta cudzy wiersz, sesja klienta nadal nie

**Implementation Note**: Po tej fazie i zielonej weryfikacji automatycznej zatrzymaj się na ręczne potwierdzenie, zanim przejdziesz dalej.

---

## Faza 2: Wejście

### Overview

Na widoki wchodzi tylko behawiorysta, a po zalogowaniu trafia tam od razu. Klient i smoke klienta zostają na swoich dotychczasowych lądowaniach, z wyjątkiem `/dashboard`.

### Changes Required:

#### 1. Reguły ról

**File**: `src/lib/role-routes.ts`

**Intent**: Middleware i sign-in korzystają z tej samej tablicy decyzji, a test nie podnosi serwera.

**Contract**:

```ts
export function dashboardRedirect(role: "client" | "behaviorist" | null): "/consultations" | "/" | null
export function redirectAfterSignIn(role: "client" | "behaviorist" | null): "/dashboard" | "/"
```

`dashboardRedirect`: `behaviorist` → `null`, `client` → `"/consultations"`, `null` → `"/"`. `redirectAfterSignIn`: `behaviorist` → `"/dashboard"`, w pozostałych przypadkach `"/"`.

#### 2. Test reguł

**File**: `src/lib/role-routes.test.ts`

**Intent**: Łapie zamianę klienta z rolą `null` i behawiorysty z klientem.

**Contract**: Trzy role dla obu funkcji, zgodnie z kontraktem wyżej.

#### 3. Middleware

**File**: `src/middleware.ts`

**Intent**: Chronione `/dashboard` i `/dashboard/[id]` przepuszczają tylko rolę `behaviorist`. Brak sesji dalej idzie na `/auth/signin` obecnym sprawdzeniem `PROTECTED_ROUTES`.

**Contract**: Gdy użytkownik jest i ścieżka zaczyna się od `/dashboard`, wynik `dashboardRedirect` inny niż `null` jest redirectem. Sprawdzenie roli jest po sprawdzeniu sesji.

#### 4. Sign-in

**File**: `src/pages/api/auth/signin.ts`

**Intent**: Behawiorysta po haśle widzi kalendarz bez postoju na Welcome. Klient dalej ląduje na `/`.

**Contract**: Po udanym `signInWithPassword` odczytaj `profiles.role` tego użytkownika klientem ciasteczkowym. Do `redirectAfterSignIn` wchodzi tylko dokładnie `behaviorist`; błąd odczytu, brak wiersza i każda inna wartość dają `"/"`.

#### 5. Smoke klienta

**File**: `scripts/smoke.mjs`

**Intent**: Istniejący przepływ klienta zostaje zielony, gdy `/dashboard` przestaje być stroną klienta.

**Contract**: Sign-in klienta nadal oczekuje 302 na `/`. Krok z linii 92, dziś „dashboard renders for signed-in user” z oczekiwanym 200, oczekuje 302 na `/consultations`. Nie dodajemy w smoke konta behawiorysty.

### Success Criteria:

#### Automated Verification:

- Reguły tras przechodzą w `npm test`: behaviorist zostaje, klient idzie na `/consultations`, rola null na `/`, po logowaniu tylko behaviorist ląduje na `/dashboard`
- Typy i lint: `npx astro check` oraz `npm run lint`
- Smoke klienta: `npm run smoke` — sign-in klienta kończy się na `/`, a jego `/dashboard` daje 302 na `/consultations`

#### Manual Verification:

- Behawiorysta po udanym sign-in ląduje na `/dashboard`; klient po udanym sign-in ląduje na `/`
- Klient wchodzący na `/dashboard` i `/dashboard/<id>` ląduje na `/consultations`; brak sesji ląduje na `/auth/signin`; rola null ląduje na `/`

**Implementation Note**: Po tej fazie i zielonej weryfikacji automatycznej zatrzymaj się na ręczne potwierdzenie, zanim przejdziesz dalej.

---

## Faza 3: Widoki

### Overview

`/dashboard` staje się kalendarzem i listą, a `/dashboard/[id]` ankietą. Oba ekrany używają funkcji z fazy 1 i tokenów.

### Changes Required:

#### 1. Miesiąc i lista

**File**: `src/pages/dashboard.astro`

**Intent**: Zastępuje angielską kartę powitania dwoma widokami tego samego zbioru. `DashboardCard` i `/dev/dashboard-states` zostają nietknięte.

**Contract**: Strona SSR, bez wyspy, czyta `consultations` kolumny `id, dog_name, breed, slot_start, status, created_at` i woła `visibleSubmissions(rows, new Date())`. `?month=YYYY-MM` jest miesiącem siatki, gdy miesiąc jest 01–12; inaczej i przy braku parametru — miesiąc Warszawy z `now` (ten sam `Intl` i `Europe/Warsaw` co `warsawDayKey`). Tydzień zaczyna się w poniedziałek. Dzień jest zaznaczony, gdy `warsawDayKey` widocznego wiersza wpada w ten miesiąc; przy kilku zgłoszeniach każde jest osobnym linkiem z imieniem psa i godziną `HH:mm`. Link prowadzi do `/dashboard/{id}`. Lista pod siatką (albo obok) pokazuje **cały** zbiór, nie tylko ten miesiąc, każdy wiersz linkiem, z `formatSlotLabel` i etykietą statusu jak na liście klienta. Pusty zbiór: polski komunikat, że nie ma zgłoszeń do pokazania. Błąd odczytu lub brak klienta Supabase: polski komunikat „Nie udało się wczytać zgłoszeń.”, bez `error.message`. Klasy tokenów (`bg-background`, `text-foreground`, `border-border` i reszta z `global.css`). Szerokość strony: klasa `max-w-*` bez nawiasów kwadratowych, dość szeroka na siatkę miesiąca. `Topbar` zostaje.

#### 2. Szczegóły

**File**: `src/pages/dashboard/[id].astro`

**Intent**: Behawiorysta czyta ankietę jednego zgłoszenia ze zbioru. Wiersz spoza zbioru nie ujawnia treści.

**Contract**: Odczyt po `id` kolumn `id, dog_name, breed, age_years, age_months, basic_info, goals, slot_start, status, created_at`. Błąd odczytu: ten sam polski komunikat co lista, status odpowiedzi zostaje 200. Brak wiersza albo `visibleSubmissions` zwraca pustkę: status 404 i polski komunikat, że nie ma takiego zgłoszenia, bez pól ankiety. Wiersz widoczny: imię, rasa, `{age_years} lat, {age_months} mies.`, `basic_info`, `goals`, `formatSlotLabel(slot_start)`, status „Oczekuje na decyzję” albo „Zaakceptowana”, link powrotu na `/dashboard`. Bez e-maila i bez przycisków decyzji.

#### 3. Skan tokenów

**File**: `scripts/check-view-tokens.mjs`

**Intent**: Nowe pliki widoku podpadają pod tę samą regułę co dzisiejszy dashboard.

**Contract**: `viewFiles` obejmuje `src/pages/dashboard/[id].astro` oraz każdy nowy plik Astro lub TSX tego widoku spoza `src/components/ui/`. `DashboardCard.tsx` zostaje na liście.

### Success Criteria:

#### Automated Verification:

- Lint, typy i build: `npm run lint`, `npx astro check`, `npm run build`
- Testy jednostkowe dalej przechodzą: `npm test`
- `scripts/check-view-tokens.mjs` wymienia nowe pliki widoku behawiorysty, a `npm run lint` kończy się kodem 0

#### Manual Verification:

- Przy „teraz” 8.10.2026 15:00 Warszawa lista pokazuje Fafika, Burka i Azora w tej kolejności; siatka października nie zawiera Azora, siatka listopada zawiera
- Szczegóły Burka pokazują imię, rasę, wiek, basic_info, goals, termin i status, bez e-maila
- `/dashboard/<id>` Luny i Reksa odpowiada 404 i nie pokazuje pól ankiety
- Pusty zbiór pokazuje polski stan pusty; błąd odczytu pokazuje polski komunikat bez treści błędu z bazy

**Implementation Note**: Po tej fazie i zielonej weryfikacji automatycznej zatrzymaj się na ręczne potwierdzenie, zanim przejdziesz dalej.

---

## Testing Strategy

### Unit Tests:

- `visibleSubmissions`: fixture pięciu psów, granica 14:30 kontra 15:00, remis `created_at` i `id`
- `dashboardRedirect` i `redirectAfterSignIn` dla `behaviorist`, `client` i `null`

### Integration Tests:

- `npm run smoke` na lokalnym Supabase: sign-in klienta → `/`, jego `/dashboard` → `/consultations`
- CI (`.github/workflows/ci.yml`) już odpala lint, `astro check`, `npm test`, build i smoke

### Manual Testing Steps:

1. Nadaj ręcznie `profiles.role = behaviorist` jednemu kontu. Zaloguj się i sprawdź lądowanie na `/dashboard`.
2. Z drugim kontem klienta złóż zgłoszenia z fixture (albo ustaw `slot_start` i `status` w Studio) i porównaj listę oraz październik/listopad z tabelą fazy 1.
3. Otwórz Burka i sprawdź, że ankieta jest kompletna, a e-maila nie ma. Wejdź w id Luny i Reksa i sprawdź 404.
4. Z konta klienta wejdź na `/dashboard` i na `/dashboard/<id>` — oba kończą się na `/consultations`. Wyloguj się i wejdź na `/dashboard` — lądowanie na `/auth/signin`.

## Performance Considerations

Jeden behawiorysta i mała liczba wierszy. Strona czyta wszystkie konsultacje i filtruje w procesie. Paginacji nie ma. Osobnego indeksu pod ten odczyt nie dodajemy.

## Migration Notes

Nowa migracja dokłada tylko politykę `select`. Danych nie przepisujemy. Migracji `20261001182110_client_survey_and_slot.sql` nie edytujemy. Po nałożeniu migracji sesja klienta nadal wpada wyłącznie w `consultations_select_own`.

## References

- Badanie: `context/changes/behaviorist-submission-views/research.md`
- PRD: `context/foundation/prd.md:77-80` (FR-005, FR-006)
- Roadmapa: `context/foundation/roadmap.md` (S-02)
- Odczyt własnego wiersza: `supabase/migrations/20261001182110_client_survey_and_slot.sql:70-72`
- Wejście i role: `src/middleware.ts:31-43`
- Sign-in na `/`: `src/pages/api/auth/signin.ts:19`
- Długość slotu: `src/lib/slots.ts:6`
- Etykiety i lista klienta: `src/pages/consultations/index.astro:10-31`
- Smoke klienta na dashboardzie: `scripts/smoke.mjs:88-92`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Zbiór i odczyt

#### Automated

- [x] 1.1 Testy zbioru przechodzą: `npm test` obejmuje pięć psów (Fafik, Burek, Azor; bez Reksa i Luny) oraz granicę `slot_start + 60 min > now` — b56aab4
- [x] 1.2 Lint przechodzi: `npm run lint` — b56aab4

#### Manual

- [x] 1.3 Migracja nakłada `consultations_select_behaviorist`: sesja behawiorysty czyta cudzy wiersz, sesja klienta nadal nie — b56aab4

### Phase 2: Wejście

#### Automated

- [x] 2.1 Reguły tras przechodzą w `npm test`: behaviorist zostaje, klient idzie na `/consultations`, rola null na `/`, po logowaniu tylko behaviorist ląduje na `/dashboard` — b001485
- [x] 2.2 Typy i lint: `npx astro check` oraz `npm run lint` — b001485
- [x] 2.3 Smoke klienta: `npm run smoke` — sign-in klienta kończy się na `/`, a jego `/dashboard` daje 302 na `/consultations` — b001485

#### Manual

- [x] 2.4 Behawiorysta po udanym sign-in ląduje na `/dashboard`; klient po udanym sign-in ląduje na `/` — b001485
- [x] 2.5 Klient wchodzący na `/dashboard` i `/dashboard/<id>` ląduje na `/consultations`; brak sesji ląduje na `/auth/signin`; rola null ląduje na `/` — b001485

### Phase 3: Widoki

#### Automated

- [x] 3.1 Lint, typy i build: `npm run lint`, `npx astro check`, `npm run build`
- [x] 3.2 Testy jednostkowe dalej przechodzą: `npm test`
- [x] 3.3 `scripts/check-view-tokens.mjs` wymienia nowe pliki widoku behawiorysty, a `npm run lint` kończy się kodem 0

#### Manual

- [x] 3.4 Przy „teraz” 8.10.2026 15:00 Warszawa lista pokazuje Fafika, Burka i Azora w tej kolejności; siatka października nie zawiera Azora, siatka listopada zawiera
- [x] 3.5 Szczegóły Burka pokazują imię, rasę, wiek, basic_info, goals, termin i status, bez e-maila
- [x] 3.6 `/dashboard/<id>` Luny i Reksa odpowiada 404 i nie pokazuje pól ankiety
- [x] 3.7 Pusty zbiór pokazuje polski stan pusty; błąd odczytu pokazuje polski komunikat bez treści błędu z bazy
