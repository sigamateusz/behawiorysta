# Godzina warszawska przy zmianie czasu — plan implementacji

## Overview

Faza 3 rolloutu testów przypina godzinę 10:00 i 17:00 Europe/Warsaw po obu stronach zmiany czasu 2026-10-25 do niezależnego UTC i do tekstu na ekranie. Istniejący test listy już trzyma instanty. Brakuje etykiety oraz jednego zapisu, który sam liczy offset.

## Current State Analysis

`warsawWallTimeToInstant` w `src/lib/slots.ts:63-67` zamienia ścianę warszawską na instant przez `Intl` i strefę `Europe/Warsaw`. Lista slotów i blokady wołają tę samą funkcję. `POST /api/consultations` wstawia ISO przysłane z listy, gdy `getTime()` zgadza się z `getAvailableSlots` (`src/pages/api/consultations/index.ts:36-50`). Drugiej konwersji w tym handlerze nie ma.

Etykietę konsultacji składa `formatSlotLabel` (`src/lib/slot-label.ts:7-23`). Siatka pulpitu składa godzinę zgłoszenia lokalną funkcją `warsawHourMinute` (`src/pages/dashboard.astro:90-99`, wywołanie w `:249`). Ta funkcja nie ma pliku testu.

`src/lib/slots.test.ts:30-36` przy `now = 2026-10-22T10:00:00Z` wymaga literalnych `2026-10-23T08:00:00.000Z`, `2026-10-23T15:00:00.000Z`, `2026-10-26T09:00:00.000Z` i `2026-10-26T16:00:00.000Z`. Plan S-01 nazywa `08:00Z` i `09:00Z` godziną 10:00. Przy tych offsetach `15:00Z` i `16:00Z` to 17:00. Test listy tej etykiety nie wywołuje.

`blockSelection` dla godzin jest pokryty dniem 2026-10-12 (`src/lib/blocks.test.ts:31-44`). Granice 25-godzinnej niedzieli 2026-10-25 są w `src/lib/blocks.test.ts:24-28`. Godzina 10:00 w piątek 23.10 i w poniedziałek 26.10 nie ma tam asercji. `blockSelection` odrzuca sobotę i niedzielę (`src/lib/blocks.ts:27-28`), więc sam 25.10 nie jest dniem zapisu godziny.

Vitest ustawia `TZ=America/New_York` (`vitest.config.ts:13`).

### Key Discoveries:

- Zielony test listy zostaje zielony przy błędzie `formatSlotLabel` albo `warsawHourMinute` (`context/changes/testing-warsaw-clock-change/research.md`).
- Zapis konsultacji kopiuje ISO. Konwersja, która trafia do insertu jako nowy instant, jest w `blockSelection` → `toISOString()` (`src/pages/api/availability-blocks/index.ts:38-41`).
- Wyrocznia ma być literałem. Pełna polska nazwa miesiąca z `pl-PL` nie jest sygnałem ryzyka #2.
- Godzina 2 w dniu cofnięcia nie wchodzi do `SLOT_STARTS` (`src/lib/slots.ts:5`).

## Desired End State

Dla instantów `2026-10-23T08:00:00.000Z` i `2026-10-26T09:00:00.000Z` ekran pokazuje 10:00. Dla `2026-10-23T15:00:00.000Z` i `2026-10-26T16:00:00.000Z` ekran pokazuje 17:00. Zapis blokady godziny 10:00 w te dwa dni niesie te same instanty 10:00, z końcem po 60 minutach. Oczekiwane wartości w testach są literałami. §6.1 planu testów opisuje ten wzorzec.

Weryfikacja: `npm test` dla nowych asercji, potem `npm run lint` i `npx astro check` po przeniesieniu formattera.

## What We're NOT Doing

- Playwright i smoke z żywym zegarem. Okno rezerwacji zależy od daty uruchomienia, więc nie utrzyma 23.10 i 26.10.
- Mock sesji albo bazy pod `POST /api/consultations`. Ten handler nie liczy offsetu.
- Druga kopia testu `availableSlots` z tymi samymi czterema literałami.
- Godzina 02:00 w dniu cofnięcia, wiosenna zmiana 2026-03-29 i zmiana algorytmu `warsawWallTimeToInstant`.
- Gałąź `formatHour` na panelu blokady. Pokazuje numer z `SLOT_STARTS`, gdy instant równa się konwersji tej godziny.
- Poprawka liczby „6 plików testów” w §4 planu testów.

## Implementation Approach

Najtańsza warstwa z planu testów to asercja instantu wobec niezależnego UTC. Etykieta dostaje własne testy, bo leży poza `availableSlots`. `warsawHourMinute` przenosimy do `src/lib/slot-label.ts`, żeby siatka pulpitu wołała funkcję objętą testem.

Jeden zapis to `blockSelection` godziny 10:00 na 2026-10-23 i 2026-10-26. To payload, który endpoint blokady wstawia jako `starts_at` / `ends_at`. Godzina 10:00 jest tą, którą S-01 nazywa wprost. `now` bierzemy z istniejącego testu blokad, `2026-10-11T10:00:00.000Z`, bo obie daty są późniejszymi dniami roboczymi.

## Critical Implementation Details

Testy mają zostać przy `TZ=America/New_York`. Oczekiwane `10:00` i `17:00` wpisujemy jako literały. Asercja nie woła `formatSlotLabel`, `warsawHourMinute` ani `warsawWallTime`, żeby zbudować wartość oczekiwaną.

Wyrocznia `formatSlotLabel` to końcówka `· 10:00` albo `· 17:00`. Nazwa dnia tygodnia i miesiąca z `pl-PL` zostaje poza asercją. `warsawHourMinute` zwraca dokładnie `10:00` albo `17:00`, z zerem wiodącym, tak jak dzisiejsza funkcja pulpitu (`padStart`). `warsawDayKey` dla tych instantów to literały `2026-10-23` i `2026-10-26`.

## Faza 1: Etykieta godziny po obu stronach zmiany

### Overview

Wspólny formatter godziny i minuty oraz testy etykiety dla czterech instantów już obecnych w teście listy.

### Changes Required:

#### 1. Formatter pulpitu

**File**: `src/lib/slot-label.ts`, `src/pages/dashboard.astro`

**Intent**: Siatka pulpitu ma składać godzinę zgłoszenia funkcją, którą da się testować obok `formatSlotLabel`. Lokalna kopia w `dashboard.astro` schodzi z pliku, żeby regresja strefy nie została tylko w widoku.

**Contract**: `warsawHourMinute(instant: Date | string): string` eksportowana z `src/lib/slot-label.ts`. Strefa `Europe/Warsaw`, `hourCycle: "h23"`, godzina i minuta z wiodącym zerem. `dashboard.astro` importuje ją i usuwa lokalną funkcję o tej samej nazwie. Wywołania przy `src/pages/dashboard.astro:135` i `:249` zostają. `formatHour` zostaje lokalną funkcją numeru siatki.

#### 2. Test etykiety

**File**: `src/lib/slot-label.test.ts`

**Intent**: Etykieta i klucz dnia dla czterech instantów z `src/lib/slots.test.ts:32-35` mają zgodzić się z godziną z planu S-01 i z dniem kalendarzowym tych instantów.

**Contract**: Literały wejścia i oczekiwanego tekstu:

| Instant                    | `warsawHourMinute` | końcówka `formatSlotLabel` | `warsawDayKey` |
| -------------------------- | ------------------ | -------------------------- | -------------- |
| `2026-10-23T08:00:00.000Z` | `10:00`            | `· 10:00`                  | `2026-10-23`   |
| `2026-10-26T09:00:00.000Z` | `10:00`            | `· 10:00`                  | `2026-10-26`   |
| `2026-10-23T15:00:00.000Z` | `17:00`            | `· 17:00`                  | `2026-10-23`   |
| `2026-10-26T16:00:00.000Z` | `17:00`            | `· 17:00`                  | `2026-10-26`   |

### Success Criteria:

#### Automated Verification:

- `npm test` przechodzi i obejmuje tabelę czterech instantów z tej fazy
- `npm run lint` oraz `npx astro check` przechodzą po przeniesieniu `warsawHourMinute`

#### Manual Verification:

- Na pulpicie czas zgłoszenia nadal widać jako godzinę i minutę

**Implementation Note**: Po zielonych sprawdzeniach automatycznych zatrzymaj się na potwierdzenie ręczne, zanim zacznie się faza 2. Bloki faz używają zwykłych myślników. Odpowiadające im `- [ ]` są w `## Progress`.

---

## Faza 2: Zapis godziny 10:00 po obu stronach zmiany

### Overview

Jeden zapis, który sam liczy offset: blokada godziny 10:00 w piątek przed zmianą czasu i w poniedziałek po niej. Potem wzorzec ląduje w §6.1.

### Changes Required:

#### 1. Payload blokady

**File**: `src/lib/blocks.test.ts`

**Intent**: Godzina 10:00 wybrana po obu stronach 2026-10-25 ma trafić do zakresu, który endpoint blokady wstawia, i zakres ma równać się literałom UTC z planu S-01.

**Contract**: Przy `now = 2026-10-11T10:00:00.000Z` (stała już użyta w tym pliku) `blockSelection` dla samego `{ day, wholeDay: false, hours: [10] }` zwraca `ok: true` i jeden zakres:

| `day`        | `starts_at`                | `ends_at`                  |
| ------------ | -------------------------- | -------------------------- |
| `2026-10-23` | `2026-10-23T08:00:00.000Z` | `2026-10-23T09:00:00.000Z` |
| `2026-10-26` | `2026-10-26T09:00:00.000Z` | `2026-10-26T10:00:00.000Z` |

Oczekiwane `Date` budujemy z tych literałów. Istniejący przypadek 2026-10-12 zostaje.

#### 2. Wzorzec w cookbooku

**File**: `context/foundation/test-plan.md`

**Intent**: §6.1 ma opisać wyrocznię, którą ta faza wprowadza, w miejscu oznaczonym jako TBD do fazy 3.

**Contract**: Zostają punkty Location i Run locally. Bullet TBD o wzorcu instantu warszawskiego schodzi. W jego miejscu: oczekiwany UTC i tekst godziny są literałami; `2026-10-23T08:00:00.000Z` oraz `2026-10-26T09:00:00.000Z` to 10:00; zapis godziny 10:00 idzie przez `blockSelection` i te same dwa starty; oczekiwanej wartości nie bierze się z wywołania funkcji pod testem. Reszta §6 i status fazy 3 w §3 zostają bez zmian.

### Success Criteria:

#### Automated Verification:

- `npm test` przechodzi i obejmuje dwa zakresy `blockSelection` z tabeli tej fazy
- W §6.1 `context/foundation/test-plan.md` nie ma już TBD wzorca instantu; jest opis literałów 10:00 dla 23.10 i 26.10

**Implementation Note**: Po zielonym `npm test` i po odczycie §6.1 faza jest domknięta automatycznie. Odpowiadające `- [ ]` są w `## Progress`.

---

## Testing Strategy

### Unit Tests:

- `src/lib/slot-label.test.ts` — cztery instanty, literały `10:00` i `17:00`, klucze dnia `2026-10-23` i `2026-10-26`.
- `src/lib/blocks.test.ts` — godzina 10:00 w 2026-10-23 i 2026-10-26 wobec literalnego UTC, przy `now` z 2026-10-11.
- Istniejący test listy w `src/lib/slots.test.ts` zostaje świadkiem instantu listy. Tej fazy nie rozszerzamy o duplikat tych czterech `toContain`.

### Integration Tests:

- Brak nowego smoke. Zapis sprawdzamy na czystej funkcji, której wynik endpoint wstawia jako ISO.

### Manual Testing Steps:

1. Po fazie 1 otwórz pulpit zalogowanego behawiorysty i sprawdź, że przy zgłoszeniu widać czas `HH:MM`.

## Performance Considerations

Nie dotyczy. Dwa formatowania `Intl` na widok pulpitu zostają przy tym samym koszcie co lokalna funkcja.

## Migration Notes

Nie dotyczy. Brak zmian schematu i brak migracji danych.

## References

- Research: `context/changes/testing-warsaw-clock-change/research.md`
- Kontrakt S-01: `context/archive/2026-10-01-client-survey-and-slot/plan.md:49`
- Ryzyko #2 i faza 3: `context/foundation/test-plan.md`
- Test listy: `src/lib/slots.test.ts:30-36`
- Zapis blokady: `src/lib/blocks.ts:38-45`, `src/pages/api/availability-blocks/index.ts:38-41`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Etykieta godziny po obu stronach zmiany

#### Automated

- [x] 1.1 `npm test` przechodzi i obejmuje tabelę czterech instantów z tej fazy
- [x] 1.2 `npm run lint` oraz `npx astro check` przechodzą po przeniesieniu `warsawHourMinute`

#### Manual

- [x] 1.3 Na pulpicie czas zgłoszenia nadal widać jako godzinę i minutę

### Phase 2: Zapis godziny 10:00 po obu stronach zmiany

#### Automated

- [x] 2.1 `npm test` przechodzi i obejmuje dwa zakresy `blockSelection` z tabeli tej fazy
- [x] 2.2 W §6.1 `context/foundation/test-plan.md` nie ma już TBD wzorca instantu; jest opis literałów 10:00 dla 23.10 i 26.10
