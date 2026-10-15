# Reject blocked, taken, and incomplete consultation writes — Implementation Plan

## Overview

Faza 1 rolloutu testów ma udowodnić, że zablokowana godzina, drugi zapis terminu `pending` i ankieta z za krótkim opisem celów nie zostawiają konsultacji. Istniejący smoke sprawdza tylko kody HTTP. Moduł sesji, z którego korzysta `POST`, w ogóle się nie parsuje.

## Current State Analysis

`POST` w `src/pages/api/consultations/index.ts` ma trzy różne odmowy. Nieudany `consultationSchema` zwraca 400 i nie woła `.insert` (`src/pages/api/consultations/index.ts:23-25`). Gdy przeładowana lista slotów nie zawiera żądanego instantu, handler zwraca 409 i też nie wstawia wiersza (`src/pages/api/consultations/index.ts:30-39`). Drugi insert tego samego `slot_start` przy istniejącym `pending` albo `accepted` dostaje `23505` i 409 (`src/pages/api/consultations/index.ts:55-57`, `supabase/migrations/20261001182110_client_survey_and_slot.sql:62-63`). `rejected` jest w checku kolumny i nie jest w predykacie indeksu (`supabase/migrations/20261001182110_client_survey_and_slot.sql:55`).

Smoke ma jeden 400 (`dog_name` puste) i jeden 409, oba tylko po statusie (`scripts/smoke.mjs:125-163`). Lista `/consultations` wypisuje `dog_name` właściciela (`src/pages/consultations/index.astro:86`). Nowe konto jest zawsze `client`; API nie zmienia roli (`supabase/migrations/20261001182110_client_survey_and_slot.sql:13-14`, `README.md:131-134`). Blokadę zapisuje `POST /api/availability-blocks` i wymaga roli `behaviorist` (`src/pages/api/availability-blocks/index.ts:8-15`).

`requireBehavioristForm` nie ma zamykającej klamry (`src/lib/consultation-api.ts:29-43`). Parser TypeScript zgłasza `'}' expected` na końcu pliku. Żaden plik `src/**/*.test.ts` tego modułu nie importuje, więc `npm test` zostaje zielony.

## Desired End State

Po tej zmianie podgląd z lokalnym Supabase odrzuca trzy zapisy i da się to zobaczyć na liście klienta: zablokowana godzina i drugie `pending` dają 409 bez nowego imienia psa, opis celów krótszy niż 20 znaków daje 400 bez nowego imienia. Po odrzuceniu konsultacji ten sam termin daje 201 i imię drugiego klienta pojawia się na jego liście. `src/lib/consultation-api.ts` się parsuje.

### Key Discoveries:

- Zapis nie ufa liście z przeglądarki: woła `getAvailableSlots` jeszcze raz (`src/pages/api/consultations/index.ts:30-39`). Baza nie odrzuca konsultacji nachodzącej na `availability_blocks`.
- Brak wiersza widać na `/consultations` tego klienta, bo lista czyta tylko jego wiersze.
- Rolę behawiorysty nadaje się SQL-em, tym samym `update`, który jest już w `README.md:133-134`. CLI w tym repozytorium ma `supabase db query --local`.
- Middleware czyta `profiles.role` przy każdym żądaniu (`src/middleware.ts:24-26`).

## What We're NOT Doing

- Osobnego testu konfliktu dla `accepted`. Predykat indeksu jest ten sam co dla `pending`.
- Wyścigu „blokada wpada między odczyt slotów a insert”. Nie ma więzu w bazie; ten przypadek nie jest asercją tej fazy.
- Listy dozwolonych ras. `breed` to tekst 1–80 znaków.
- Nowego testu jednostkowego `availableSlots` i Playwrighta.
- Migracji schematu i zmiany `src/db/database.types.ts`.
- Pokrycia ryzyka #3 (inny ekran po wdrożeniu). Wejście behawiorysty na `/dashboard` w smoke jest tylko sprawdzeniem fixture roli.
- Edycji §1, §2 i słownika statusów w §3 `context/foundation/test-plan.md`.

## Implementation Approach

Najpierw domknąć klamrę, żeby podgląd w ogóle załadował trasy importujące `consultation-api.ts`. Potem rozszerzyć `scripts/smoke.mjs`: jedno konto promowane do `behaviorist` przez `supabase db query --local`, blokada jednej godziny warszawskiej przez istniejący endpoint, asercje braku imienia na liście klienta. Na końcu opisać ten wzorzec w cookbooku planu testów.

## Critical Implementation Details

**Kolejność kroków smoke.** Lista slotów musi mieć co najmniej dwa instanty. Pierwszy jest blokowany, drugi rezerwowany. Krótki `goals` idzie na otwarty slot, zanim ten slot zostanie zajęty albo zablokowany. Konflikt `pending` jest sprawdzany, zanim behawiorysta odrzuci wiersz. Dopiero po odrzuceniu drugi klient powtarza ten sam `slot_start` i dostaje 201.

**Godzina blokady.** Instant z `GET /api/consultations/slots` jest UTC. Dzień i godzina formularza blokady biorą się z `Intl` ze strefą `Europe/Warsaw`, nie z `getUTCHours`. Zła godzina blokuje inny termin niż ten, który klient wysyła. Pole formularza to `day` (`YYYY-MM-DD`) i `hour` (liczba z `SLOT_STARTS`). Bez `whole_day`. Sukces endpointu to przekierowanie 303 na `/dashboard` bez `block_error` (`src/pages/api/availability-blocks/index.ts:50`).

**Promocja roli.** `update` z `README.md:133-134` leci przez `npx supabase db query --local` z katalogu repozytorium, po rejestracji konta i zanim to konto zapisze blokadę. Nowej zależności npm nie dodajemy. Job smoke w CI już stawia lokalny Supabase i ma CLI.

## Phase 1: Domknięcie klamry modułu sesji

### Overview

`src/lib/consultation-api.ts` znowu się parsuje. Zachowanie funkcji się nie zmienia.

### Changes Required:

#### 1. Klamra `requireBehavioristForm`

**File**: `src/lib/consultation-api.ts`

**Intent**: Domknąć funkcję otwartą w linii 29, żeby moduł importowany przez `POST /api/consultations` dał się sparsować.

**Contract**: Po `return supabase` funkcja `requireBehavioristForm` się kończy, zanim zaczyna się `export function requireBehavioristApi`. Sygnatury, kody 401/403/500 i treści błędów zostają.

### Success Criteria:

#### Automated Verification:

- `npx astro check` przechodzi
- `npm test` przechodzi

Brak kryteriów ręcznych. Faza jest domknięta, gdy obie komendy są zielone.

---

## Phase 2: Smoke trzech zapisów

### Overview

Smoke na podglądzie pokazuje, że trzy niedozwolone zapisy nie zostawiają konsultacji, a termin po `rejected` znowu przyjmuje zapis.

### Changes Required:

#### 1. Konto behawiorysty w smoke

**File**: `scripts/smoke.mjs`

**Intent**: Dać smoke sesję, która może zapisać blokadę, bez nowego klienta bazy w zależnościach npm.

**Contract**: Nowe konto z własnym słoikiem ciasteczek. Po signup ten sam `update` co w `README.md:133-134`, wykonany jako `npx supabase db query --local` z katalogu repozytorium. Email w SQL jest emailem tego konta. Potem sign-in. Przekierowanie na `/dashboard` jest tylko sprawdzeniem, że promocja się udała, nie testem ryzyka #3.

#### 2. Zapis na zablokowaną godzinę

**File**: `scripts/smoke.mjs`

**Intent**: Klient, który już widział listę slotów, nie może zapisać godziny zablokowanej później, i ten zapis nie zostawia jego psa na liście.

**Contract**: Z listy `GET /api/consultations/slots` (co najmniej dwa sloty) behawiorysta blokuje godzinę warszawską pierwszego slotu przez `POST /api/availability-blocks`. Klient A wysyła ten stary `slot_start` z imieniem `Blocked-${stamp}` i kompletną ankietą. Oczekiwane: 409. `GET /consultations` konta A nie zawiera `Blocked-${stamp}`. Dotychczasowy udany zapis A idzie na drugi slot, nie na zablokowany.

#### 3. Za krótki opis celów

**File**: `scripts/smoke.mjs`

**Intent**: Pominięcie reguły formularza nie tworzy konsultacji, gdy serwer odrzuca `goals`.

**Contract**: `POST /api/consultations` konta A, zanim slot zostanie zajęty: pozostałe pola jak w `surveyForm`, `goals` ma 19 znaków po `trim`, `dog_name` to `Short-${stamp}`, `slot_start` jest otwarty. Oczekiwane: 400. Lista A nie zawiera `Short-${stamp}`. Istniejący krok z pustym `dog_name` zostaje i dalej sprawdza tylko 400. Rasa spoza listy nie jest przypadkiem negatywnym.

#### 4. Konflikt `pending` i ponowny zapis po `rejected`

**File**: `scripts/smoke.mjs`

**Intent**: Drugi zapis zajętego terminu nie tworzy wiersza, a po odrzuceniu ten sam termin tworzy.

**Contract**: Udany zapis A zwraca 201 i `{ id }`; smoke zapamiętuje `id`. Konto B wysyła ten sam `slot_start` z imieniem `ClientB-${stamp}` i dostaje 409, a jego `/consultations` nie zawiera `ClientB-${stamp}`. Behawiorysta wysyła `POST /api/consultations/<id>/decision` z polem `decision=rejected`. Oczekiwane przekierowanie: status jak przy `context.redirect` bez trzeciego argumentu (smoke dla auth oczekuje 302) i `location` zaczynający się od `/dashboard?decided=rejected`. Potem B powtarza ten sam formularz: 201, a jego lista zawiera `ClientB-${stamp}`.

#### 5. Opis uruchomienia

**File**: `README.md`

**Intent**: Osoba uruchamiająca smoke lokalnie wie, że nowe kroki wołają lokalne CLI Supabase.

**Contract**: Sekcja smoke mówi, że promocja roli używa `supabase db query --local` i że lokalny stos musi działać. Nie zmieniać przykładu SQL w sekcji Roles ani nie ruszać zdania o ręcznych blokadach w Studio.

### Success Criteria:

#### Automated Verification:

- Krótki `goals` (19 znaków po trim) dostaje 400, a `Short-${stamp}` nie występuje na `/consultations` klienta A
- Zapis na zablokowaną godzinę dostaje 409, a `Blocked-${stamp}` nie występuje na `/consultations` klienta A
- Drugi zapis terminu `pending` dostaje 409, a `ClientB-${stamp}` nie występuje na `/consultations` klienta B
- Po odrzuceniu ten sam termin daje klientowi B 201, a `ClientB-${stamp}` występuje na jego `/consultations`
- `npm run smoke` przechodzi przy podglądzie i lokalnym Supabase

Brak kryteriów ręcznych. Faza jest domknięta, gdy smoke jest zielony.

---

## Phase 3: Wzorzec w cookbooku

### Overview

Następny test zapisu ma wzorzec w `context/foundation/test-plan.md`, bez ruszania zamrożonej strategii.

### Changes Required:

#### 1. Cookbook planu testów

**File**: `context/foundation/test-plan.md`

**Intent**: Zostawić sposób dodania tego rodzaju testu, skoro faza rolloutu właśnie go dostarczyła.

**Contract**: §6.2 opisuje wzorzec „zablokowany, zajęty albo niepełny zapis nie zostawia konsultacji” i wskazuje `scripts/smoke.mjs`. §6.4 mówi, że asercja obejmuje brak wiersza na liście klienta, nie sam kod statusu. §6.6 dostaje krótką notatkę tej fazy: promocja roli przez `supabase db query --local`, godzina blokady liczona w `Europe/Warsaw`. §1, §2 i słownik statusów w §3 bez zmian. Status fazy rolloutu w §3 zostawia orchestrator.

### Success Criteria:

#### Automated Verification:

- §6.2 nazywa wzorzec niedozwolonego zapisu i wskazuje `scripts/smoke.mjs`
- §6.4 wymaga braku wiersza, nie samego kodu statusu
- §6.6 opisuje promocję roli i strefę `Europe/Warsaw`
- §1, §2 i słownik statusów w §3 pozostają bez zmian

Brak kryteriów ręcznych. Faza jest domknięta, gdy te cztery zdania są prawdziwe w pliku.

---

## Testing Strategy

### Unit Tests:

- Istniejące `npm test` ma zostać zielone. Nie dodajemy testu filtra listy slotów.

### Integration Tests:

- `npm run smoke` na podglądzie z lokalnym Supabase: krótki `goals`, zablokowana godzina, drugie `pending`, ponowny zapis po `rejected`.

### Manual Testing Steps:

1. Brak. Sygnał jest w smoke.

## Performance Considerations

Smoke dostaje kilka żądań HTTP i jedno lokalne zapytanie SQL. Ścieżka produkcyjna zapisu się nie zmienia.

## Migration Notes

Brak migracji. Promocja roli dotyczy tylko konta utworzonego w tym przebiegu smoke, na lokalnej bazie, którą job i tak stawia od zera.

## References

- Badanie: `context/changes/testing-unavailable-slot-write/research.md`
- Plan testów: `context/foundation/test-plan.md`
- Zapis: `src/pages/api/consultations/index.ts:23-62`
- Indeks slotu: `supabase/migrations/20261001182110_client_survey_and_slot.sql:55-63`
- Promocja roli: `README.md:131-134`
- Smoke: `scripts/smoke.mjs:125-163`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Domknięcie klamry modułu sesji

#### Automated

- [x] 1.1 `npx astro check` przechodzi — 94dc60d
- [x] 1.2 `npm test` przechodzi — 94dc60d

### Phase 2: Smoke trzech zapisów

#### Automated

- [x] 2.1 Krótki `goals` (19 znaków po trim) dostaje 400, a `Short-${stamp}` nie występuje na `/consultations` klienta A — 80cf9ea
- [x] 2.2 Zapis na zablokowaną godzinę dostaje 409, a `Blocked-${stamp}` nie występuje na `/consultations` klienta A — 80cf9ea
- [x] 2.3 Drugi zapis terminu `pending` dostaje 409, a `ClientB-${stamp}` nie występuje na `/consultations` klienta B — 80cf9ea
- [x] 2.4 Po odrzuceniu ten sam termin daje klientowi B 201, a `ClientB-${stamp}` występuje na jego `/consultations` — 80cf9ea
- [x] 2.5 `npm run smoke` przechodzi przy podglądzie i lokalnym Supabase — 80cf9ea

### Phase 3: Wzorzec w cookbooku

#### Automated

- [x] 3.1 §6.2 nazywa wzorzec niedozwolonego zapisu i wskazuje `scripts/smoke.mjs`
- [x] 3.2 §6.4 wymaga braku wiersza, nie samego kodu statusu
- [x] 3.3 §6.6 opisuje promocję roli i strefę `Europe/Warsaw`
- [x] 3.4 §1, §2 i słownik statusów w §3 pozostają bez zmian
