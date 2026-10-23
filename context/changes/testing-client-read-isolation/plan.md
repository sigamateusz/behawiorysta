# Client Read Isolation Implementation Plan

## Overview

Rozszerzyć `scripts/smoke.mjs` tak, żeby jeden krok listy klienta B nie uchodził za pokrycie każdego odczytu i zapisu zgłoszenia. Behawiorysta ma zobaczyć psa A, dopóki wiersz jest `pending`. Decyzja wysłana przez klienta B albo anonima nie może zdjąć tego stanu. Po zapisie B lista A nie zawiera jego psa.

## Current State Analysis

Zgłoszenie jest wierszem `public.consultations`. Lista klienta nie filtruje `client_id`; właściciela wymaga polityka `consultations_select_own`. Jedyna aktualizacja wiersza to `POST /api/consultations/:id/decision`, a handler przekierowuje klienta i anonima, zanim wywoła `update`.

Smoke ma już listę B bez psa A (`scripts/smoke.mjs:301-303`), konflikt slotu i odrzucenie przez behawiorystę. Nie ma odczytu `/dashboard` ani `/dashboard/${bookedId}` sesją behawiorysty, nie ma decyzji z `jarB` ani `jarAnon` i nie sprawdza listy A po udanym zapisie B.

Sekcja „Wszystkie zgłoszenia” renderuje każde zgłoszenie zwrócone przez `visibleSubmissions`, nie tylko dni siatki bieżącego miesiąca (`src/pages/dashboard.astro:423-438`). Wiersz `pending` zostaje w tym zbiorze (`src/lib/behaviorist-submissions.ts:20-21`). Szczegół wypisuje `dog_name` (`src/pages/dashboard/[id].astro:67`).

## Desired End State

`npm run smoke` na podglądzie z lokalnym Supabase przechodzi z nowymi krokami. Behawiorysta, zanim ktokolwiek odrzuci wiersz A, dostaje `dogName` na `GET /dashboard` i na `GET /dashboard/${bookedId}`. Decyzja klienta B i anonima na to id nie psuje późniejszego odrzucenia behawiorysty. Lista A po zapisie B zawiera psa A i nie zawiera `ClientB-${stamp}`. Cookbook w §6.4 i §6.6 opisuje ten wzorzec.

### Key Discoveries:

- Samo 302 z decyzji nie pokazuje, że wiersz został `pending`. Dowodem jest istniejący krok odrzucenia, który oczekuje `/dashboard?decided=rejected` (`scripts/smoke.mjs:311-318`).
- `request` nie podąża za przekierowaniem (`scripts/smoke.mjs:46`). Puste body przy 302 nie jest odczytem kolumn zgłoszenia.
- `GET /dashboard` klienta jest już sprawdzone jako 302 na `/consultations` (`scripts/smoke.mjs:151`). To ta sama gałąź middleware co `/dashboard/${id}` i nie rozróżnia właściciela.

## What We're NOT Doing

- `GET /dashboard/${bookedId}` sesją klienta.
- Playwright i nowe trasy, polityki RLS albo porównanie `client_id` w aplikacji.
- Asercję `taken_slot_starts` ponad istniejący krok slotów B.
- Mock sesji albo zapytanie SQL w roli klienta.
- Zmianę §1, §2 i słownika statusów w §3 planu testów. Status fazy rolloutu zostawia orchestrator.

## Implementation Approach

Zostajemy przy runnerze kroków w `scripts/smoke.mjs` i przy dwóch kontach, które smoke już zakłada. Nowe kroki wchodzą w istniejący ciąg, w oknie `pending` wiersza A. Cookbook dostaje opis po tym, jak kroki są w pliku, tak jak przy fazie zapisu niedostępnego terminu.

## Critical Implementation Details

- **State sequencing** — Odczyty behawiorysty oraz `POST` decyzji klienta B i anonima stoją przed krokiem „behaviorist rejects A's booking”. Lista A bez psa B stoi po kroku „B books the slot after rejection”. Wcześniej wiersz B nie istnieje, a po odrzuceniu A termin jest wolny i B dopiero go zajmuje.

---

## Phase 1: Kroki izolacji w smoke

### Overview

Smoke pokazuje odczyt behawiorysty, odmowę zmiany przez klienta B i anonima oraz brak psa B na liście A.

### Changes Required:

#### 1. Odczyt behawiorysty, póki wiersz jest pending

**File**: `scripts/smoke.mjs`

**Intent**: Behawiorysta ma zobaczyć zgłoszenie A na liście i w szczegółach, zanim ktokolwiek je odrzuci.

**Contract**: Po kroku „A consultations list shows the dog”, a przed „behaviorist rejects A's booking”, dwa `GET` z `jarBehaviorist`: `/dashboard` i `/dashboard/${bookedId}`. Oba: status 200 i `bodyIncludes: dogName`. Nie dodawać parametru `month`.

#### 2. Decyzja klienta B i anonima

**File**: `scripts/smoke.mjs`

**Intent**: Cudzy zapis decyzji nie zmienia wiersza A. Samo przekierowanie tego nie dowodzi, więc zostaje późniejsze odrzucenie behawiorysty.

**Contract**: Po „B signin accepts correct password”, a przed „behaviorist rejects A's booking”, `POST /api/consultations/${bookedId}/decision` z polem `decision=rejected`. Sesja B: status 302 i `location` zaczynający się od `/consultations`. `jarAnon`: status 302 i `location` zaczynający się od `/auth/signin`. Krok „behaviorist rejects A's booking” zostaje i dalej oczekuje `location` zaczynającego się od `/dashboard?decided=rejected`.

#### 3. Lista A po zapisie B

**File**: `scripts/smoke.mjs`

**Intent**: Konto A nie czyta zgłoszenia, które B właśnie utworzyło.

**Contract**: Po „B books the slot after rejection” `GET /consultations` z `jarA`: status 200, `bodyIncludes: dogName`, `bodyExcludes: ClientB-${stamp}`. Istniejący krok listy B bez psa A zostaje.

### Success Criteria:

#### Automated Verification:

- Gdy wiersz A jest `pending`, `GET /dashboard` i `GET /dashboard/${bookedId}` sesji behawiorysty zawierają `dogName`
- `POST` decyzji klienta B na to id zwraca 302 z `location` zaczynającym się od `/consultations`, a anonim 302 z `location` zaczynającym się od `/auth/signin`
- Istniejący krok odrzucenia behawiorysty dalej oczekuje `location` zaczynającego się od `/dashboard?decided=rejected`
- Po 201 zapisu B `GET /consultations` konta A ma status 200, zawiera `dogName` i nie zawiera `ClientB-${stamp}`
- `npm run smoke` przechodzi przy podglądzie i lokalnym Supabase

Brak kryteriów ręcznych. Faza jest domknięta, gdy smoke jest zielony.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Wzorzec w cookbooku

### Overview

Następny test cudzego zgłoszenia ma wzorzec w `context/foundation/test-plan.md`, bez ruszania zamrożonej strategii.

### Changes Required:

#### 1. Cookbook planu testów

**File**: `context/foundation/test-plan.md`

**Intent**: Zostawić sposób sprawdzenia cudzego odczytu i zapisu, skoro faza rolloutu właśnie go dostarczyła.

**Contract**: W §6.4 znika linia TBD fazy 4. Zostaje zdanie, że asercja zapisu to brak wiersza na liście autora, nie sam kod statusu. Dochodzi wzorzec cudzego zgłoszenia: lista właściciela na statusie 200 nie zawiera imienia psa drugiego klienta; `POST` decyzji tego klienta i anonima nie zdejmuje `pending`, co widać po odrzuceniu behawiorysty kończącym się na `decided=rejected`; `GET /dashboard` i `GET /dashboard/{id}` behawiorysty zawierają to imię, póki wiersz jest `pending`. `GET /dashboard/{id}` klienta nie jest w tym wzorcu. §6.6 dostaje notatkę: odczyt behawiorysty oraz decyzja klienta i anonima padają przed odrzuceniem, a lista A po udanym zapisie B. §1, §2 i słownik statusów w §3 bez zmian. Status fazy rolloutu w §3 zostawia orchestrator.

### Success Criteria:

#### Automated Verification:

- §6.4 opisuje cudzy odczyt i zapis i nie zawiera TBD fazy 4
- §6.6 mówi, że odczyt behawiorysty i decyzja klienta oraz anonima padają przed odrzuceniem, a lista A po zapisie B
- §1, §2 i słownik statusów w §3 pozostają bez zmian

Brak kryteriów ręcznych. Faza jest domknięta, gdy te trzy zdania są prawdziwe w pliku.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Testing Strategy

### Unit Tests:

- Istniejące `npm test` ma zostać zielone. Nie dodajemy testu filtra listy w pamięci.

### Integration Tests:

- `npm run smoke` na podglądzie z lokalnym Supabase: odczyt behawiorysty, decyzja klienta B, decyzja anonima, lista A po zapisie B.

### Manual Testing Steps:

1. Brak. Sygnał jest w smoke.

## Performance Considerations

Nie dotyczy. Smoke woła kilka dodatkowych żądań HTTP na istniejącym podglądzie.

## Migration Notes

Nie dotyczy. Plan nie zmienia schematu ani danych.

## References

- Related research: `context/changes/testing-client-read-isolation/research.md`
- Similar implementation: `context/archive/2026-10-15-testing-unavailable-slot-write/plan.md`
- Smoke runner: `scripts/smoke.mjs:43-56`, `scripts/smoke.mjs:117-130`
- Lista behawiorysty: `src/pages/dashboard.astro:423-438`
- Szczegół: `src/pages/dashboard/[id].astro:37-67`
- Decyzja: `src/lib/consultation-api.ts:29-41`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Kroki izolacji w smoke

#### Automated

- [x] 1.1 Gdy wiersz A jest `pending`, `GET /dashboard` i `GET /dashboard/${bookedId}` sesji behawiorysty zawierają `dogName` — ec58786
- [x] 1.2 `POST` decyzji klienta B na to id zwraca 302 z `location` zaczynającym się od `/consultations`, a anonim 302 z `location` zaczynającym się od `/auth/signin` — ec58786
- [x] 1.3 Istniejący krok odrzucenia behawiorysty dalej oczekuje `location` zaczynającego się od `/dashboard?decided=rejected` — ec58786
- [x] 1.4 Po 201 zapisu B `GET /consultations` konta A ma status 200, zawiera `dogName` i nie zawiera `ClientB-${stamp}` — ec58786
- [x] 1.5 `npm run smoke` przechodzi przy podglądzie i lokalnym Supabase — ec58786

### Phase 2: Wzorzec w cookbooku

#### Automated

- [x] 2.1 §6.4 opisuje cudzy odczyt i zapis i nie zawiera TBD fazy 4
- [x] 2.2 §6.6 mówi, że odczyt behawiorysty i decyzja klienta oraz anonima padają przed odrzuceniem, a lista A po zapisie B
- [x] 2.3 §1, §2 i słownik statusów w §3 pozostają bez zmian
