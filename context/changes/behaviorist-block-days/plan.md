# Blokady dni i godzin — plan implementacji

## Overview

Behawiorysta na `/dashboard` blokuje przyszły dzień roboczy albo wybrane godziny 10:00–17:00 i może taką blokadę usunąć. Zablokowany termin znika z wyboru klienta. Wizyta, która już jest w tym czasie, zostaje.

## Current State Analysis

Tabela `availability_blocks` (`starts_at`, `ends_at`, opcjonalne `note`) jest w migracji S-01. Komentarz przy tabeli: cały dzień to zakres 00:00–24:00 Europe/Warsaw, a zapis idzie przez Studio, dopóki nie ma S-03. `authenticated` ma samo `select`. Klient i tak czyta blokady w `getAvailableSlots` i `availableSlots` wyrzuca slot, który nachodzi na zakres (`block.start < slotEnd && block.end > slotStart`).

Siatka slotów jest stała: Europe/Warsaw, pn–pt, starty 10–17, 60 minut, od jutra przez 28 dni. Koniec slotu nie jest kolumną. Unikalny indeks trzyma jeden `pending` albo `accepted` na `slot_start`. `rejected` slotu nie zajmuje.

Kalendarz behawiorysty jest stroną Astro tylko do odczytu. Dzień z zgłoszeniem linkuje do szczegółów. Przy pustej liście siatka w ogóle się nie renderuje — zostaje „Nie ma zgłoszeń do pokazania.” Dashboard nie czyta `availability_blocks`.

`requireClientApi` puszcza na endpoint konsultacji tylko rolę `client`. Middleware ustawia `locals.user` i `locals.role` także dla `/api`, ale `/api` nie jest w `PROTECTED_ROUTES`.

## Desired End State

Behawiorysta otwiera `/dashboard` i widzi miesiąc także wtedy, gdy nie ma żadnego zgłoszenia. Na przyszłym dniu roboczym (pn–pt od jutra, bez limitu 28 dni) zapisuje albo cały dzień warszawski 00:00–24:00, albo jedną lub więcej godzin 10:00–17:00. Każda godzina to osobny wiersz. Usunięcie kasuje jeden wiersz. Sobota, niedziela, dziś i daty wstecz nie mają akcji.

Klient po tym zapisie nie widzi nachodzących slotów. Burek umówiony na 14:00 zostaje na kalendarzu i w `consultations` ze swoim statusem.

Sprawdzenie: testy zakresów (w tym 25.10.2026), potem ręcznie blokada, wybór terminu u klienta i usunięcie.

### Key Discoveries:

- `src/lib/slots.ts:1-7` — strefa, dni robocze, starty 10–17, `SLOT_MINUTES = 60`, horyzont 28 dni. `src/lib/slots.ts:96` — nachodzenie zakresów. Konwersja ściany warszawskiej jest prywatna w tym pliku.
- `supabase/migrations/20261001182110_client_survey_and_slot.sql:87-106` — tabela i select dla `authenticated`. Tego pliku nie edytujemy.
- `src/lib/availability.ts:5-23` — filtr klienta już dociąga blokady. S-03 go nie przerabia.
- `src/pages/dashboard.astro:148-152` — pusta lista zastępuje siatkę.
- `src/lib/consultation-api.ts:14-26` — wzorzec bramki roli. `src/middleware.ts:5` — `/api` poza trasami chronionymi przekierowaniem.

## What We're NOT Doing

- Akceptacja i odrzucenie konsultacji (S-04).
- Reguła „każdy piątek” oraz seria blokad na 28 dni do przodu.
- Edycja `starts_at` / `ends_at` w miejscu. Poprawka to usunięcie wiersza i nowy zapis.
- Zapis z UI dowolnego zakresu spoza godzin 10–17. Wiersze ze Studio o innym kształcie zostają, widać je i da się je usunąć.
- Blokada soboty, niedzieli, dzisiaj i dat wstecz.
- Pole `note`. Zapis z aplikacji zostawia je puste.
- Maile, zmiana statusu istniejących konsultacji, nowa kolumna właściciela, wielu behawiorystów.
- Zmiana `availableSlots`, horyzontu rezerwacji i kształtu tabeli.
- Wyspa React na dashboardzie.

## Implementation Approach

Czysta funkcja zamienia datę i wybór na listę zakresów, tą samą konwersją czasu co sloty. Nowa migracja dokłada `insert` i `delete` dla roli `behaviorist`. Endpoint przyjmuje formularz i wraca przekierowaniem na ten sam dzień. Strona `/dashboard` zawsze rysuje miesiąc, czyta blokady i pokazuje formularz dnia. Filtr klienta zostaje, bo zakresy, które funkcja zapisuje, już dziś wycinają sloty.

Godziny 10:00 i 14:00 to dwa wiersze. Jeden zakres 10:00–15:00 zamknąłby też 11, 12 i 13, więc go nie tworzymy. Cały dzień to jeden wiersz od 00:00 tego dnia do 00:00 następnego, czas warszawski. Zaznaczenie całego dnia ignoruje checkboxy godzin.

Zapis jest całościowy: jeśli którakolwiek wybrana godzina jest już w całości pokryta istniejącym zakresem, nie wstawiamy żadnego nowego wiersza. Cały dzień wolno dopisać, gdy leżą już pojedyncze godziny. Usunięcie dnia nie kasuje tych godzin.

## Critical Implementation Details

**Północ warszawska i 25.10.2026.** Tego dnia zegary cofają się o godzinę, więc „cały dzień” trwa 25 godzin: `2026-10-24T22:00:00.000Z` → `2026-10-25T23:00:00.000Z`. Stałe `+02:00` psuje koniec dnia. Eksport z `slots.ts` ma iść przez istniejącą konwersję ściany, a `blocks.ts` nie liczy offsetu drugi raz.

**Dwa wiersze, nie rozpiętość.** Wybór 10 i 14 tworzy `[10:00, 11:00)` i `[14:00, 15:00)`. Formularz HTML nie wysyła `DELETE`, więc usunięcie jest osobnym `POST`.

**`now` to kalendarz Warszawy.** „Jutro” liczymy od daty warszawskiej, nie od UTC i nie od strefy procesu. Niedziela 11.10.2026 12:00 Warszawa to instant `2026-10-11T10:00:00.000Z`.

## Phase 1: Reguły zakresu

### Overview

Funkcje bez I/O: które daty wolno blokować, jakie zakresy powstają z wyboru oraz które godziny siatki są już pokryte. Testy spinają północ, zmianę czasu i przykładowe daty z decyzji.

### Changes Required:

#### 1. Granice dnia w `slots.ts`

**File**: `src/lib/slots.ts`

**Intent**: Jedno miejsce liczy instant ze ściany warszawskiej, żeby blokada dnia i slot 10:00 używały tej samej ścieżki co `availableSlots`.

**Contract**: Eksport funkcji, która z `YYYY-MM-DD` oraz godziny i minuty zwraca `Date`. Dzień `YYYY-MM-DD` ma początek o 00:00 i koniec o 00:00 następnej daty w Europe/Warsaw. Istniejące testy `slots.test.ts` zostają zielone.

#### 2. Wybór blokady

**File**: `src/lib/blocks.ts`

**Intent**: Z daty i wyboru behawiorysty powstaje lista zakresów albo kod odmowy, zanim ktokolwiek dotknie bazy.

**Contract**:

```ts
export function blockSelection(
  input: { day: string; wholeDay: boolean; hours: readonly number[] },
  now: Date,
):
  | { ok: true; ranges: { starts_at: Date; ends_at: Date }[] }
  | { ok: false; code: "date" | "empty" | "hour" };
```

`day` spoza `YYYY-MM-DD`, sobota, niedziela, data warszawska równa dziś albo wcześniejsza → `date`. Brak całego dnia i brak godzin → `empty`. Godzina spoza `SLOT_STARTS` → `hour`. `wholeDay: true` daje jeden zakres 00:00–24:00 i ignoruje `hours`. Inaczej jeden zakres 60 minut na każdą godzinę, w kolejności `SLOT_STARTS`, bez scalania sąsiadów.

Osobno: predykat „zakres kandydata jest w całości wewnątrz istniejącego” (`starts_at` kandydata ≥ początek i `ends_at` ≤ koniec). Predykat „wiersz pokrywa cały dzień warszawski”. Lista godzin `SLOT_STARTS`, których 60 minut nachodzi na którykolwiek zakres, tą samą nierównością co `availableSlots`.

#### 3. Testy

**File**: `src/lib/blocks.test.ts`

**Intent**: Przypadki z decyzji i z DST są w `npm test`, nie w ręcznym liczeniu.

**Contract**: Przypadki z kryteriów sukcesu tej fazy. `now` dla dat to `2026-10-11T10:00:00.000Z` (niedziela 11.10.2026, 12:00 Warszawa).

### Success Criteria:

#### Automated Verification:

- `npm test` obejmuje cały dzień 12.10.2026 jako `2026-10-11T22:00:00.000Z`–`2026-10-12T22:00:00.000Z` oraz dzień zmiany czasu 25.10.2026 jako `2026-10-24T22:00:00.000Z`–`2026-10-25T23:00:00.000Z`
- `npm test` obejmuje godziny 10 i 14 w dniu 12.10.2026 jako dwa zakresy `2026-10-12T08:00:00.000Z`–`09:00:00.000Z` i `2026-10-12T12:00:00.000Z`–`13:00:00.000Z`, a wybór całego dnia ignoruje zaznaczone godziny
- `npm test` obejmuje niedzielę 11.10.2026 12:00 Warszawa: 12.10 i 9.11 da się zablokować, a 9.10, 11.10 i 17.10 nie; pusty wybór i godzina 18 są odrzucone
- `npm test` obejmuje pokrycie: godzina 10:00 wewnątrz całego dnia jest pokryta, sam wiersz 10:00–11:00 nie pokrywa całego dnia, a zakres 12:30–13:30 nachodzi na sloty 12 i 13
- `npm run lint` przechodzi

**Implementation Note**: Po zielonych testach i lint zatrzymaj się na potwierdzenie, że fazy 2 nie startujemy na czerwonym `npm test`.

---

## Phase 2: Zapis behawiorysty

### Overview

Behawiorysta może wstawić i usunąć wiersz. Klient nie może. Endpoint używa funkcji z fazy 1 i nie rusza `consultations`.

### Changes Required:

#### 1. Migracja polityk

**File**: `supabase/migrations/20261011140000_behaviorist_write_availability_blocks.sql`

**Intent**: Zapis i usunięcie blokady działają z sesji behawiorysty, także gdy ktoś pominie endpoint.

**Contract**: Nowy plik. `20261001182110_client_survey_and_slot.sql` bez zmian. `grant insert, delete on public.availability_blocks to authenticated`. Polityka insert `with check` i polityka delete `using`: istnieje `profiles` o `id = auth.uid()` i `role = 'behaviorist'`. Brak `grant update` i brak polityki update. Select dla `authenticated` zostaje jak w S-01.

#### 2. Bramka roli

**File**: `src/lib/consultation-api.ts`

**Intent**: Endpoint blokad odrzuca anonima i klienta tak samo wyraźnie jak endpoint konsultacji odrzuca behawiorystę.

**Contract**: `requireBehavioristApi` jak `requireClientApi`: brak klienta Supabase → 500, brak użytkownika → 401, rola inna niż `behaviorist` → 403. Treści błędów te same co w `requireClientApi` (`Supabase is not configured`, `Unauthorized`, `Forbidden`).

#### 3. Utworzenie

**File**: `src/pages/api/availability-blocks/index.ts`

**Intent**: Formularz dnia zapisuje zakresy z fazy 1 albo wraca na ten dzień z kodem błędu.

**Contract**: Eksport `POST`. Po bramce odczyt pól formularza: `day` (string), `whole_day` obecne i równe `1` oznacza cały dzień, `hour` powtarzane jako liczby. `blockSelection`. Przy `ok: false` odpowiedź `303` na `/dashboard?month=YYYY-MM&day=YYYY-MM-DD&block_error=<code>`, gdzie `month` to `day` obcięte do `YYYY-MM`, a `code` to `date`, `empty` albo `hour`.

Przy `ok: true` odczyt istniejących wierszy nachodzących na ten dzień (`starts_at` < koniec dnia i `ends_at` > początek). Jeśli którykolwiek kandydat jest w całości wewnątrz istniejącego wiersza, `303` z `block_error=duplicate` i zero insertów. Inaczej insert wszystkich zakresów, `note` puste. Błąd odczytu lub insertu: `303` z `block_error=save`, bez `error.message` w URL. Sukces: `303` na ten sam dzień bez `block_error`.

`consultations` bez update i bez delete.

#### 4. Usunięcie

**File**: `src/pages/api/availability-blocks/delete.ts`

**Intent**: Przycisk formularza kasuje jeden wiersz, bo przeglądarka nie wysyła `DELETE`.

**Contract**: Eksport `POST`. Bramka jak wyżej. Pole `id` musi być UUID. Pole `day` musi być `YYYY-MM-DD`. Delete tego `id`. Sukces i brak wiersza (zero skasowanych) → `303` na `/dashboard?month=&day=` bez błędu, gdy `day` jest poprawną datą. Zły `id` albo błąd bazy → `303` z `block_error=delete`. Zero skasowanych przy poprawnym UUID jest sukcesem, żeby powtórne kliknięcie nie krzyczało.

### Success Criteria:

#### Automated Verification:

- `npm test` przechodzi
- `npm run lint` przechodzi

#### Manual Verification:

- Nowa migracja nakłada się na lokalny Supabase, a `supabase/migrations/20261001182110_client_survey_and_slot.sql` pozostaje bez zmian
- Sesja behawiorysty wstawia i usuwa wiersz `availability_blocks`; sesja klienta dostaje odmowę insertu i delete

**Implementation Note**: Po lint i teście nałóż migrację i sprawdź obie role, zanim powstanie formularz na siatce.

---

## Phase 3: Kalendarz

### Overview

`/dashboard` zawsze pokazuje miesiąc. Przyszły dzień roboczy otwiera formularz zapisu i listę blokad do usunięcia. Pusta lista zgłoszeń zostaje pod siatką.

### Changes Required:

#### 1. Siatka i formularz dnia

**File**: `src/pages/dashboard.astro`

**Intent**: Behawiorysta blokuje dzień z kalendarza także wtedy, gdy nikt jeszcze nic nie umówił, i widzi, co już jest zamknięte.

**Contract**: Przy udanym odczycie siatka miesiąca i nawigacja są zawsze. Lista pod siatką nadal używa `visibleSubmissions`. Pusta lista: „Nie ma zgłoszeń do pokazania.” Błąd odczytu konsultacji albo blokad: jeden alert „Nie udało się wczytać kalendarza.”, bez siatki i bez formularza.

Odczyt blokad nachodzących na widoczny miesiąc warszawski: `starts_at` < 00:00 pierwszego dnia następnego miesiąca i `ends_at` > 00:00 pierwszego dnia tego miesiąca. Granice z funkcji z fazy 1.

Komórka przyszłego dnia roboczego linkuje do `/dashboard?month=YYYY-MM&day=YYYY-MM-DD`. Sobota, niedziela, dziś i daty wstecz nie mają tego linku. Linki zgłoszeń `/dashboard/{id}` zostają. Dzień pokryty wierszem 00:00–24:00 pokazuje „Dzień zablokowany”. Inaczej lista godzin `HH:mm` ze slotów nachodzących na blokady.

Parametr `day` otwiera panel tylko wtedy, gdy data leży w wyświetlanym miesiącu i `blockSelection` dla niej nie zwraca `date` przy `wholeDay: true` i `now = new Date()`. Inaczej parametr jest ignorowany.

Panel: formularz `POST` na `/api/availability-blocks` z ukrytym `day`. Checkbox `whole_day` o wartości `1` i etykiecie „Cały dzień”. Checkboxy `hour` dla 10–17, które nie są w całości pokryte. Gdy wiersz pokrywa już cały dzień, formularz zapisu się nie renderuje. Osobny formularz `POST` na `/api/availability-blocks/delete` dla każdego wiersza nachodzącego na ten dzień: ukryte `id` i `day`, przycisk „Usuń”. Etykieta wiersza: „Cały dzień”, albo `HH:mm` gdy start jest slotem i długość to 60 minut, albo `HH:mm–HH:mm` początku i końca w Warszawie.

`block_error` mapuje się na: `date` → „Tej daty nie da się zablokować.”, `empty` → „Wybierz cały dzień albo godzinę.”, `hour` → „Tej godziny nie ma w grafiku.”, `duplicate` → „Ta blokada już jest zapisana.”, `save` → „Nie udało się zapisać blokady.”, `delete` → „Nie udało się usunąć blokady.” Nieznany kod używa zdania `save`. Klasy z tokenów już użytych na tej stronie (`bg-background`, `text-foreground`, `border-border`, `bg-card`, `text-primary` i reszta obecnego zestawu).

### Success Criteria:

#### Automated Verification:

- `npm test` przechodzi
- `npm run lint` przechodzi

#### Manual Verification:

- Przy zerze zgłoszeń widać siatkę miesiąca, a pod nią „Nie ma zgłoszeń do pokazania.”
- Blokada całego przyszłego dnia roboczego usuwa jego 8 slotów z wyboru klienta; wizyta pending na tym dniu zostaje na kalendarzu i w bazie ze swoim statusem
- Blokada 10:00 i 14:00 usuwa tylko te dwie godziny; 11:00 zostaje w wyborze klienta
- Sobota, dziś i dzień wstecz nie mają akcji blokady; poniedziałek 9.11.2026 zapisany przy `now` w niedzielę 11.10.2026 nie zmienia listy slotów klienta, dopóki ten dzień nie wejdzie w okno 28 dni
- Usunięcie blokady przywraca termin w wyborze klienta

**Implementation Note**: Po lint i teście przejdź ścieżkę ręczną na koncie behawiorysty i klienta, zanim zmiana pójdzie dalej.

---

## Testing Strategy

### Unit Tests:

- Zakresy z fazy 1, w tym 25.10.2026 i rozłączne 10:00 oraz 14:00.
- Daty 12.10 i 9.11 blokowalne, 9.10, 11.10 i 17.10 odrzucone przy `now = 2026-10-11T10:00:00.000Z`.
- Pokrycie całego dnia, godziny wewnątrz niego oraz nachodzenie 12:30–13:30 na sloty 12 i 13.
- Istniejące `src/lib/slots.test.ts` bez zmiany oczekiwanego filtra.

### Integration Tests:

- Brak harnessu HTTP w repo. Insert i delete przy RLS sprawdzamy ręcznie na lokalnym Supabase.

### Manual Testing Steps:

1. Nałóż nową migrację. Potwierdź, że stary plik S-01 nie ma diffa.
2. Jako behawiorysta zablokuj cały przyszły dzień roboczy i osobno 10:00 oraz 14:00 innego dnia. Jako klient otwórz wybór terminu.
3. Zostaw na zablokowanym dniu wizytę pending i sprawdź, że wiersz konsultacji ma ten sam status.
4. W niedzielę 11.10.2026 (albo z ustawionym czasem) spróbuj soboty, dzisiaj i 9.11.2026. Slotów 9.11 jeszcze nie ma na liście klienta.
5. Usuń blokadę i odśwież wybór klienta.
6. Jako klient wyślij insert do `availability_blocks` i oczekuj odmowy.

## Performance Considerations

Dashboard dokłada jeden odczyt zakresów nachodzących na widoczny miesiąc. Przy jednym behawioryście i horyzoncie licznym w tygodniach to jeden mały select obok dotychczasowego odczytu konsultacji.

## Migration Notes

Danych nie przepisujemy. Wiersze wpisane wcześniej w Studio zostają i zaczynają być widoczne na siatce. Migracji `20261001182110_client_survey_and_slot.sql` nie edytujemy. Brak polityki update znaczy, że poprawka zakresu to delete i insert. Cofnięcie tej zmiany to usunięcie nowego pliku migracji z historii lokalnej, zanim wejdzie na współdzielone środowisko; po nałożeniu polityka insert/delete zostaje, dopóki nie powstanie migracja odwrotna.

## References

- PRD: `context/foundation/prd.md` (FR-007, logika biznesowa, US-01)
- Roadmap: `context/foundation/roadmap.md` (S-03)
- Model z S-01: `context/archive/2026-10-01-client-survey-and-slot/plan.md`
- Siatka i filtr: `src/lib/slots.ts`, `src/lib/availability.ts`
- Tabela: `supabase/migrations/20261001182110_client_survey_and_slot.sql:87-106`
- Kalendarz: `src/pages/dashboard.astro`
- Bramka roli: `src/lib/consultation-api.ts:14-26`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Reguły zakresu

#### Automated

- [x] 1.1 `npm test` obejmuje cały dzień 12.10.2026 jako `2026-10-11T22:00:00.000Z`–`2026-10-12T22:00:00.000Z` oraz dzień zmiany czasu 25.10.2026 jako `2026-10-24T22:00:00.000Z`–`2026-10-25T23:00:00.000Z` — 45dd3be
- [x] 1.2 `npm test` obejmuje godziny 10 i 14 w dniu 12.10.2026 jako dwa zakresy `2026-10-12T08:00:00.000Z`–`09:00:00.000Z` i `2026-10-12T12:00:00.000Z`–`13:00:00.000Z`, a wybór całego dnia ignoruje zaznaczone godziny — 45dd3be
- [x] 1.3 `npm test` obejmuje niedzielę 11.10.2026 12:00 Warszawa: 12.10 i 9.11 da się zablokować, a 9.10, 11.10 i 17.10 nie; pusty wybór i godzina 18 są odrzucone — 45dd3be
- [x] 1.4 `npm test` obejmuje pokrycie: godzina 10:00 wewnątrz całego dnia jest pokryta, sam wiersz 10:00–11:00 nie pokrywa całego dnia, a zakres 12:30–13:30 nachodzi na sloty 12 i 13 — 45dd3be
- [x] 1.5 `npm run lint` przechodzi — 45dd3be

### Phase 2: Zapis behawiorysty

#### Automated

- [x] 2.1 `npm test` przechodzi — 9d744ff
- [x] 2.2 `npm run lint` przechodzi — 9d744ff

#### Manual

- [x] 2.3 Nowa migracja nakłada się na lokalny Supabase, a `supabase/migrations/20261001182110_client_survey_and_slot.sql` pozostaje bez zmian — 9d744ff
- [x] 2.4 Sesja behawiorysty wstawia i usuwa wiersz `availability_blocks`; sesja klienta dostaje odmowę insertu i delete — 9d744ff

### Phase 3: Kalendarz

#### Automated

- [x] 3.1 `npm test` przechodzi — 5faef5c
- [x] 3.2 `npm run lint` przechodzi — 5faef5c

#### Manual

- [x] 3.3 Przy zerze zgłoszeń widać siatkę miesiąca, a pod nią „Nie ma zgłoszeń do pokazania.” — 5faef5c
- [x] 3.4 Blokada całego przyszłego dnia roboczego usuwa jego 8 slotów z wyboru klienta; wizyta pending na tym dniu zostaje na kalendarzu i w bazie ze swoim statusem — 5faef5c
- [x] 3.5 Blokada 10:00 i 14:00 usuwa tylko te dwie godziny; 11:00 zostaje w wyborze klienta — 5faef5c
- [x] 3.6 Sobota, dziś i dzień wstecz nie mają akcji blokady; poniedziałek 9.11.2026 zapisany przy `now` w niedzielę 11.10.2026 nie zmienia listy slotów klienta, dopóki ten dzień nie wejdzie w okno 28 dni — 5faef5c
- [x] 3.7 Usunięcie blokady przywraca termin w wyborze klienta — 5faef5c
