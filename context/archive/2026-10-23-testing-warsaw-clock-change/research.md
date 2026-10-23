---
date: 2026-10-23T01:47:27+02:00
researcher: Mateusz
git_commit: 84bc2a6b922fd29d28192b6aabc4112b2b7de4c5
branch: main
repository: behawiorysta
topic: "Gdzie warszawska godzina staje się instantem i skąd bierze się godzina na ekranie przy zmianie czasu 2026-10-25"
tags: [research, codebase, slots, slot-label, dst]
status: complete
last_updated: 2026-10-23
last_updated_by: Mateusz
---

# Research: Godzina warszawska przy zmianie czasu 2026-10-25

**Date**: 2026-10-23T01:47:27+02:00
**Researcher**: Mateusz
**Git Commit**: 84bc2a6b922fd29d28192b6aabc4112b2b7de4c5
**Branch**: main
**Repository**: behawiorysta

## Research Question

Faza 3 z `context/foundation/test-plan.md`: gdzie wybrana godzina Europe/Warsaw staje się zapisanym instantem, skąd bierze się godzina na ekranie, i czy zielony test przeliczenia slotów dowodzi zapisu oraz etykiety po obu stronach zmiany czasu 2026-10-25.

## Summary

Na przejrzanej ścieżce listy i blokad godzina ścienna staje się instantem w `warsawWallTimeToInstant` (`src/lib/slots.ts:63-67`). Strefa to IANA `Europe/Warsaw` w `Intl.DateTimeFormat` (`src/lib/slots.ts:1`, `src/lib/slots.ts:23-32`). Siatka godzin to dokładnie osiem liczb 10–17 (`src/lib/slots.ts:5`).

Zapis konsultacji w `POST /api/consultations` nie liczy offsetu drugi raz. Formularz wysyła ISO z listy (`src/components/consultations/ConsultationForm.tsx:108`). Handler wstawia ten sam string, gdy `getTime()` zgadza się z wynikiem `getAvailableSlots` (`src/pages/api/consultations/index.ts:36-50`). `getAvailableSlots` zwraca `availableSlots` (`src/lib/availability.ts:23`).

Etykieta konsultacji idzie przez `formatSlotLabel` (`src/lib/slot-label.ts:7-23`). Siatka kalendarza behawiorysty składa godzinę zgłoszenia w `warsawHourMinute` (`src/pages/dashboard.astro:90-99`, wywołanie przy `src/pages/dashboard.astro:249`).

Test listy przy `now = 2026-10-22T10:00:00Z` wymaga literalnych `2026-10-23T08:00:00.000Z`, `2026-10-23T15:00:00.000Z`, `2026-10-26T09:00:00.000Z` i `2026-10-26T16:00:00.000Z` oraz braku `2026-10-26T08:00:00.000Z` (`src/lib/slots.test.ts:30-36`). Plan S-01 nazywa dwa z nich godziną 10:00: pt 23.10 = `08:00Z`, pn 26.10 = `09:00Z` (`context/archive/2026-10-01-client-survey-and-slot/plan.md:49`). Przy offsetach z tego planu (+2 w piątek, +1 w poniedziałek) `15:00Z` i `16:00Z` wypadają o 17:00, czyli na ostatniej godzinie `SLOT_STARTS` (`src/lib/slots.ts:5`). Ten test nie wywołuje `formatSlotLabel` ani `warsawHourMinute`. Wyszukanie `formatSlotLabel` w `*.ts`, `*.tsx`, `*.mjs` i `*.astro` nie trafiło w plik `*.test.ts`.

Zielony przebieg `src/lib/slots.test.ts:30-36` dowodzi instantu listy dla tych czterech wartości przy podanym `now`. Tego samego przebiegu nie dowodzi etykieta na ekranie. Zapis HTTP, który porównuje tylko kod statusu, też zostaje zielony, gdy insert kopiuje ISO z tej listy.

## Detailed Findings

### Konwersja ściany na instant

`warsawWallTimeToInstant` bierze północ UTC dnia kalendarzowego plus godzinę i minutę, odejmuje offset z `warsawOffsetMs`, a potem czyta offset jeszcze raz przy tym przybliżeniu (`src/lib/slots.ts:63-67`). Komentarz w tej funkcji mówi, że offset przy ścianie czytanej jak UTC może różnić się od właściwego przy zmianie czasu. `warsawOffsetMs` składa części z formattera warszawskiego i odejmuje je od instantu (`src/lib/slots.ts:51-55`). W ciele tej funkcji nie ma stałej +1 ani +2.

`availableSlots` woła tę konwersję w pętli `offset` od 1 do `BOOKING_HORIZON_DAYS`, dla godzin z `SLOT_STARTS`, po pominięciu dnia, którego `getUTCDay` nie należy do `WORKING_DAYS` (`src/lib/slots.ts:125-131`). `warsawWallTime` i `warsawDayBounds` wołają tę samą funkcję (`src/lib/slots.ts:95-105`). Komentarz przy granicach dnia mówi, że dzień cofnięcia zegara w październiku trwa 25 godzin (`src/lib/slots.ts:99`).

Blokada całego dnia bierze `warsawDayBounds` (`src/lib/blocks.ts:31-33`). Blokada godzin bierze `warsawWallTime` dla godzin obecnych w `SLOT_STARTS` (`src/lib/blocks.ts:38-45`). Handler wstawia `toISOString()` tych `Date` do `starts_at` i `ends_at` (`src/pages/api/availability-blocks/index.ts:38-41`).

`blockSelection` zwraca `code: "hour"`, gdy któraś godzina nie należy do `SLOT_STARTS` (`src/lib/blocks.ts:38-39`). Godzina 2 nie jest w tej tablicy (`src/lib/slots.ts:5`). Niedziela 2026-10-25 jest w teście opisana jako dzień odrzucony przez wybór blokady; granice tego dnia są asercją na `warsawDayBounds`: od `2026-10-24T22:00:00.000Z` do `2026-10-25T23:00:00.000Z` (`src/lib/blocks.test.ts:24-28`). Warunek odrzucenia daty to sobota, niedziela albo dzień nie późniejszy niż warszawskie „dziś” (`src/lib/blocks.ts:27-28`). Powtórzona lokalnie godzina 02:00–03:00 nie jest więc wejściem siatki 10–17. Zachowanie `warsawWallTime` dla godziny 2 na ten dzień nie ma tu testu i nie jest potrzebne do godzin z `SLOT_STARTS`.

### Zapis konsultacji

`slot_start` w schemacie to ISO z offsetem (`src/lib/consultation-schema.ts:45`). Po udanym parsowaniu handler liczy `new Date(parsed.data.slot_start)` i szuka równego `getTime()` w liście z bazy (`src/pages/api/consultations/index.ts:27-38`). Przy trafieniu insert dostaje `parsed.data.slot_start` (`src/pages/api/consultations/index.ts:50`). W tym handlerze nie ma wywołania `warsawWallTime`.

Skutek dla ryzyka #2: błąd o godzinę w `availableSlots` zmienia i listę, i wartość, którą ten `POST` może przyjąć. Błąd tylko w `formatSlotLabel` albo w `warsawHourMinute` zostawia ten `POST` i test `src/lib/slots.test.ts:30-36` bez zmiany.

### Godzina na ekranie

`formatSlotLabel` czyta godzinę i minutę z `Intl` `pl-PL`, `timeZone: "Europe/Warsaw"`, `hourCycle: "h23"` (`src/lib/slot-label.ts:7-23`). Wywołania znalezione w `*.ts`, `*.tsx`, `*.mjs` i `*.astro`:

- przycisk slotu klienta (`src/components/consultations/SlotPicker.tsx:83`)
- lista „Moje zgłoszenia” (`src/pages/consultations/index.astro:92`)
- szczegół zgłoszenia (`src/pages/dashboard/[id].astro:77`)
- lista zgłoszeń na pulpicie (`src/pages/dashboard.astro:454`)

`warsawHourMinute` w `src/pages/dashboard.astro:90-99` jest drugim formatterem, też z `Europe/Warsaw`. Siatka dnia wpisuje jego wynik jako czas zgłoszenia (`src/pages/dashboard.astro:249`).

Etykieta wiersza blokady ma dwie gałęzie (`src/pages/dashboard.astro:125-135`). Gdy początek wiersza równa się `warsawWallTime(day, hour, 0)` dla jakiejś godziny z `SLOT_STARTS` i długość to jeden slot, tekst pochodzi z `formatHour` — liczba godziny złożona w `HH:00` (`src/pages/dashboard.astro:102-104`). W pozostałym przypadku tekst pochodzi z `warsawHourMinute` obu końców. Gałąź `formatHour` pokazuje numer z siatki, gdy instant równa się konwersji tej godziny. Nie czyta godziny z instantu przez `Intl`.

W ciele `formatSlotLabel` (`src/lib/slot-label.ts:7-23`) i `warsawHourMinute` (`src/pages/dashboard.astro:90-99`) godzina pochodzi z `Intl` oraz `timeZone: "Europe/Warsaw"`. W tych dwóch ciałach nie ma `getUTCHours`. Vitest ustawia `TZ` na `America/New_York` (`vitest.config.ts:11-13`), a test runtime wymaga tej strefy (`src/lib/slots.test.ts:23-26`).

### Co obecne testy przypinają

Przy `now = 2026-10-22T10:00:00Z` lista musi zawierać cztery literały ISO wymienione w podsumowaniu i nie zawierać `2026-10-26T08:00:00.000Z` (`src/lib/slots.test.ts:30-36`). Plan S-01 nazywa dwa z nich: pt 23.10 10:00 = `08:00Z`, pn 26.10 10:00 = `09:00Z` (`context/archive/2026-10-01-client-survey-and-slot/plan.md:49`). Oczekiwane wartości w teście są literałami, nie wynikiem `warsawWallTimeToInstant` w tej samej asercji.

Osobny test formatuje wynik `availableSlots` własnym `Intl` (`en-GB`, `Europe/Warsaw`) i wymaga zbioru godzin dokładnie `10:00`–`17:00` (`src/lib/slots.test.ts:4-10`, `src/lib/slots.test.ts:53-57`). Wejście `now` to poniedziałek 2026-10-05 21:30Z, więc okno obejmuje dni po 2026-10-25. Ten formatter nie jest `formatSlotLabel`.

`bookingWindow` dla `2026-10-24T10:00:00Z` wymaga początku `2026-10-24T22:00:00.000Z` (`src/lib/slots.test.ts:121-124`). To północ warszawska dnia cofnięcia, nie godzina 10:00 ani 17:00.

`scripts/smoke.mjs:70-83` zamienia ISO slotu na `day` i `hour` własnym `Intl` ze strefą `Europe/Warsaw`. W tym pliku nie ma literału `2026-10-23`, `2026-10-25`, `2026-10-26` ani `formatSlotLabel`.

Glob `src/**/*.test.ts` w tym badaniu zwrócił 7 plików, wszystkie w `src/lib`. Zdanie planu o 6 plikach testów (`context/foundation/test-plan.md:86`) jest więc nieaktualne co do liczby. Klauzula „wszystkie w `src/lib`” zgadza się z tym globem 7 ścieżek.

### Werdykt wskazówki z planu

| Zdanie z planu                                                           | Werdykt na tym kodzie                                                                                                                                                                                                                                                                                      |
| ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Godzina lokalna staje się instantem w miejscu, które research ma wskazać | Wspierane: `warsawWallTimeToInstant` (`src/lib/slots.ts:63-67`), wołane z listy i z blokad                                                                                                                                                                                                                 |
| Godzina na ekranie bierze się z osobnego miejsca                         | Wspierane: `formatSlotLabel` i `warsawHourMinute`, bez testu tych funkcji                                                                                                                                                                                                                                  |
| Zielony test przeliczenia dowodzi utrwalonego instantu                   | Częściowo. Dla czterech literalów przy `now = 2026-10-22T10:00:00Z` dowodzi instantu listy (`src/lib/slots.test.ts:30-36`). `POST` konsultacji utrwala ten sam ISO (`src/pages/api/consultations/index.ts:50`). Nie dowodzi odczytu `timestamptz` z bazy ani tekstu na ekranie                             |
| Wyrocznia przepisana z kodu                                              | Test listy używa literalów zgodnych z planem S-01. Etykieta nie ma jeszcze wyroczni. Oczekiwany tekst etykiety nie może być wynikiem wywołania `formatSlotLabel` w tej samej asercji                                                                                                                       |
| Tylko jedna strona zmiany czasu                                          | Test listy ma piątek 23.10 i poniedziałek 26.10. Etykieta nie ma żadnej z tych stron                                                                                                                                                                                                                       |
| Najtańsza warstwa: asercja instantu wobec niezależnego UTC               | Dla listy ta asercja już jest. Brakująca asercja to tekst `formatSlotLabel` i `warsawHourMinute` dla `2026-10-23T08:00:00.000Z` i `2026-10-26T09:00:00.000Z` (10:00 z planu S-01). Ten sam test listy zawiera też `2026-10-23T15:00:00.000Z` i `2026-10-26T16:00:00.000Z`; przy offsetach S-01 są to 17:00 |
| Jeden zapis                                                              | W tym handlerze `POST` nie ma drugiej konwersji. Zapis, który sprawdza tylko status, nie łapie etykiety. Zapis, który czyta `slot_start` z powrotem i porównuje z literałem UTC, sprawdza kolumnę `timestamptz`, czego test listy nie widzi. Ta runda bazy nie była uruchamiana w tym badaniu              |

Kolumna Source ryzyka #2 w planie wskazuje wywiad Q2 i archiwum S-01, nie katalog hot-spotu (`context/foundation/test-plan.md:43`). Ścieżka konwersji leży w `src/lib`, etykieta w `src/lib/slot-label.ts` i `src/pages/dashboard.astro`. Nie ma tu korekty, która przenosiłaby ryzyko do innego katalogu niż te dwa.

## Code References

- `src/lib/slots.ts:1` — `TIME_ZONE = "Europe/Warsaw"`
- `src/lib/slots.ts:5` — `SLOT_STARTS` = 10–17
- `src/lib/slots.ts:63-67` — konwersja ściany na instant, drugi odczyt offsetu
- `src/lib/slots.ts:95-105` — `warsawWallTime`, `warsawDayBounds`
- `src/lib/slots.ts:130-131` — lista slotów woła konwersję
- `src/lib/blocks.ts:31-45` — blokada dnia i godzin
- `src/pages/api/availability-blocks/index.ts:38-41` — insert ISO blokady
- `src/pages/api/consultations/index.ts:36-50` — insert `slot_start` bez drugiej konwersji
- `src/lib/slot-label.ts:7-23` — etykieta na ekranie
- `src/pages/dashboard.astro:90-99` — `warsawHourMinute`
- `src/pages/dashboard.astro:125-135` — etykieta blokady z numeru siatki albo z instantu
- `src/lib/slots.test.ts:30-36` — literały UTC po obu stronach 2026-10-25
- `src/lib/blocks.test.ts:24-28` — 25-godzinny dzień 2026-10-25
- `vitest.config.ts:13` — `TZ=America/New_York`

## Architecture Insights

`warsawWallTimeToInstant` w `src/lib/slots.ts` liczy instant listy i instant blokady. Etykieta konsultacji jest osobną funkcją w `src/lib/slot-label.ts`, a siatka pulpitowa ma jeszcze lokalny formatter w `src/pages/dashboard.astro`. Test listy, który nie wywołuje tych dwóch formatterów, zostaje zielony przy ich regresji.

Test listy przypina piątek 23.10 (plan S-01: 10:00 = 08:00Z) i poniedziałek 26.10 (10:00 = 09:00Z). Sam 25.10.2026 jest w teście blokad niedzielą odrzuconą przez `blockSelection`.

Faza 3 może oprzeć wyrocznię etykiety na literałach UTC z `src/lib/slots.test.ts:32-35` i z planu S-01. Dla `2026-10-23T08:00:00.000Z` i `2026-10-26T09:00:00.000Z` plan podaje godzinę 10:00. Oczekiwany tekst etykiety ma być literałem w teście, nie wynikiem `formatSlotLabel` w tej samej asercji.

## Historical Context (from prior changes)

- `context/archive/2026-10-01-client-survey-and-slot/plan.md:49` — wspierane jako kontrakt: strefa Europe/Warsaw, `timestamptz`, offset daty przez `Intl`, pt 23.10 10:00 = 08:00Z, pn 26.10 10:00 = 09:00Z. Te dwa literały są w `src/lib/slots.test.ts:32` i `:34`.
- `context/foundation/test-plan.md:49` — plan nazywa Q2 incydentem. Osobnego transkryptu wywiadu nie ma wśród plików `context/` otwartych w tym badaniu. Zdanie o incydencie zostaje twierdzeniem planu, bez drugiego źródła tutaj.
- `context/foundation/test-plan.md:75` — plan mówi, że faza 3 jest osobno, bo incydent zdarzył się przy zielonych testach slotów. Częściowo: przy obecnym `src/lib/slots.test.ts:30-36` błąd listy o godzinę na 23.10 albo 26.10 dla tych literalów ten test czerwieni. Zielony zostaje błąd etykiety.
- `context/foundation/test-plan.md:86` — „6 plików testów” jest nieaktualne (glob dał 7). „Wszystkie w `src/lib`” zgadza się z tymi 7 ścieżkami.
- `context/foundation/test-plan.md:90` — `TZ=America/New_York` zgadza się z `vitest.config.ts:13`.
- `context/foundation/test-plan.md:130` — wzorzec wyroczni fazy 3 jest nadal TBD. Istniejący test listy już używa literalów, nie wywołania funkcji jako oczekiwanej wartości.
- `context/archive/2026-10-15-testing-unavailable-slot-write/research.md` — dotyczy odmowy zapisu, nie pary etykieta/UTC przy zmianie czasu.

## Related Research

- `context/archive/2026-10-01-client-survey-and-slot/plan.md` — kontrakt DST S-01
- `context/archive/2026-10-15-testing-unavailable-slot-write/research.md` — zapis konsultacji i blokady, bez asercji godziny warszawskiej wobec UTC po 2026-10-25
- `context/foundation/test-plan.md` — ryzyko #2 i faza 3

## Open Questions

- Plan nie podaje, który ekran i która godzina wystąpiły w Q2. Do asercji wystarczą literały już zapisane dla 10:00 i pary 17:00.
- Odczyt `slot_start` z lokalnego Postgresa po insercie nie był uruchamiany. Czy `timestamptz` wraca jako ten sam instant, zostaje pytaniem na fazę zapisu, nie na konwersję w `slots.ts`.
- Zachowanie `warsawWallTime` dla lokalnej 02:00 w dniu cofnięcia nie jest ustalone testem. Siatka 10–17 tego wejścia nie wysyła.
