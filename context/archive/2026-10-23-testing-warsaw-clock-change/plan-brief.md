# Godzina warszawska przy zmianie czasu — Plan Brief

> Full plan: `context/changes/testing-warsaw-clock-change/plan.md`
> Research: `context/changes/testing-warsaw-clock-change/research.md`

## What & Why

Wybrana godzina warszawska ma być tą samą godziną w zapisie i na ekranie po obu stronach zmiany czasu 2026-10-25. Test listy już pilnuje instantów i zostaje zielony, gdy zepsuje się sama etykieta. Ta zmiana dopina etykietę i jeden zapis, który sam liczy offset.

## Starting Point

`warsawWallTimeToInstant` liczy instant listy i blokady. `formatSlotLabel` składa etykietę konsultacji. Pulpit ma drugą, nietestowaną kopię `warsawHourMinute`. `POST` konsultacji wstawia gotowe ISO z listy. `blockSelection` godziny 10:00 jest pokryty dniem przed zmianą czasu (2026-10-12), a pary 23.10 / 26.10 tam nie ma.

## Desired End State

Instant `2026-10-23T08:00:00.000Z` i `2026-10-26T09:00:00.000Z` pokazują 10:00. Instant `2026-10-23T15:00:00.000Z` i `2026-10-26T16:00:00.000Z` pokazują 17:00. Blokada godziny 10:00 w te dwa dni zapisuje te same starty, plus 60 minut. Testy porównują literały, a §6.1 planu testów opisuje ten wzorzec.

## Key Decisions Made

| Decision                  | Choice                                       | Why (1 sentence)                                                                 | Source   |
| ------------------------- | -------------------------------------------- | -------------------------------------------------------------------------------- | -------- |
| Złożoność i pytania       | Niska, bez rundy pytań                       | Research zamyka ścieżkę, a polecenie każe brać rekomendację od razu              | Plan     |
| Etykieta pulpitu          | Wspólna `warsawHourMinute` w `slot-label.ts` | Lokalna kopia w `dashboard.astro` zostaje zielona przy błędzie listy             | Research |
| Strony i godziny etykiety | 23.10 i 26.10, 10:00 oraz 17:00              | To cztery literały już obecne w teście listy i nazwane przez S-01 dla 10:00      | Research |
| Jeden zapis               | `blockSelection` 10:00 na 23.10 i 26.10      | Endpoint blokady wstawia ten zakres; `POST` konsultacji offsetu nie liczy        | Research |
| Wyrocznia                 | Literał w teście                             | Plan testów zabrania kopiować oczekiwany wynik z kodu                            | Research |
| Warstwa                   | Vitest                                       | Najtańsza warstwa ryzyka #2; Playwright jest tylko dla ekranu po zalogowaniu     | Research |
| Godzina 02:00 i smoke     | Poza zakresem                                | Siatka ma 10–17, a smoke z żywym zegarem nie utrzyma dat 2026-10-23 i 2026-10-26 | Research |

## Scope

**In scope:**

- Przeniesienie `warsawHourMinute` do `src/lib/slot-label.ts` i podpięcie pulpitu
- Test czterech instantów: tekst godziny i klucz dnia
- Test `blockSelection` godziny 10:00 na 2026-10-23 i 2026-10-26
- Zastąpienie TBD w §6.1 planu testów tym wzorcem

**Out of scope:**

- Playwright, smoke, mock bazy, druga kopia testu `availableSlots`
- Godzina 02:00, zmiana algorytmu konwersji, gałąź `formatHour`
- Status fazy 3 w §3 i liczba plików testów w §4

## Architecture / Approach

Etykieta idzie przez jedną testowaną funkcję w `src/lib/slot-label.ts`, używaną też przez `dashboard.astro`. Zapis idzie przez `blockSelection` w `src/lib/blocks.ts`: wynik tej funkcji jest ISO wstawianym do `availability_blocks`. Oba testy dostają oczekiwane wartości jako literały UTC i tekst `10:00` / `17:00`.

## Phases at a Glance

| Phase                                         | What it delivers                           | Key risk                                                  |
| --------------------------------------------- | ------------------------------------------ | --------------------------------------------------------- |
| 1. Etykieta godziny po obu stronach zmiany    | Wspólny formatter i test 10:00 oraz 17:00  | Końcówka `pl-PL` może różnić się kształtem części godziny |
| 2. Zapis godziny 10:00 po obu stronach zmiany | Dwa zakresy `blockSelection` i wpis w §6.1 | Niedziela 25.10 nie jest dniem zapisu godziny             |

**Prerequisites:** Research `testing-warsaw-clock-change` i zielony `npm test` na obecnym `main`.
**Estimated effort:** Jedna sesja, dwie fazy.

## Open Risks & Assumptions

- Jeśli `Intl` `pl-PL` odda godzinę inaczej niż `10`, wyrocznią zostaje dokładne `10:00` z `warsawHourMinute` i końcówka `· 10:00` w `formatSlotLabel`. Strefy się przy tym nie zmienia.
- Rundy `timestamptz` w Postgresie ten plan nie uruchamia. Zakładamy, że ISO z `toISOString()` niesie instant sprawdzony w `blockSelection`.
- Q2 nie ma transkryptu ekranu. Asercje biorą literały S-01, nie rekonstrukcję incydentu.

## Success Criteria (Summary)

- Cztery instanty z testu listy pokazują 10:00 albo 17:00 i swój dzień warszawski.
- Blokada 10:00 w 2026-10-23 startuje o `08:00Z`, a w 2026-10-26 o `09:00Z`.
- §6.1 opisuje literały i obie strony, a oczekiwanej wartości nie bierze z funkcji pod testem.
