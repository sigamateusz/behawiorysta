# Blokady dni i godzin — Plan Brief

> Full plan: `context/changes/behaviorist-block-days/plan.md`

## What & Why

Behawiorysta zamyka w kalendarzu dzień albo konkretne godziny, żeby klient nie umówił konsultacji na czas, w którym behawiorysta nie pracuje. Sam termin bez tej blokady wraca do grafiku, którego nie da się obronić. Wizyta już złożona zostaje — ta zmiana tnie tylko nowe zapisy.

## Starting Point

`availability_blocks` i filtr slotów klienta są od S-01. Zapis blokady jest tylko przez Studio: rola `authenticated` ma samo `select`. Kalendarz na `/dashboard` pokazuje zgłoszenia i znika, gdy lista jest pusta. Godziny pracy to pn–pt 10:00–17:00, slot 60 minut, Europe/Warsaw, okno od jutra przez 28 dni.

## Desired End State

Na `/dashboard` miesiąc widać zawsze. Behawiorysta na przyszłym dniu roboczym blokuje cały dzień (00:00–24:00 Warszawy) albo wybrane godziny 10:00–17:00 i może usunąć taki zapis. Klient tych terminów nie wybierze. Burek oczekujący na 14:00 zostaje na kalendarzu. Sobota, niedziela, dziś i dni wstecz nie mają akcji. Dzień poza oknem 28 dni da się zapisać od razu; wytnie sloty, gdy w to okno wjedzie.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) |
| --- | --- | --- |
| Co da się zablokować | Cały dzień albo godziny 10–17 | Roadmap S-03 mówi o dniach i godzinach, a tabela już trzyma zakres, który filtr klienta omija. |
| Istniejąca wizyta | Zostaje, nowe terminy odpadają | PRD mówi o nowej konsultacji; akceptacja i odrzucenie są w S-04. |
| Zdjęcie | Usunięcie całego wiersza | Poprawka godzin to usunięcie i nowy zapis, bez polityki update. |
| Powtarzanie | Konkretna data | `starts_at` / `ends_at` bez reguły „każdy piątek”. |
| Które daty | Pn–pt od jutra, także poza 28 dniami | Blokada 9.11.2026 złożona 11.10.2026 czeka, aż dzień wjedzie w okno. |
| Miejsce | Siatka zawsze, akcja na dniu | Pusty miesiąc też musi dać się zablokować. |
| Kilka godzin | Osobny wiersz na godzinę | 10:00 i 14:00 nie zamykają 11:00–13:00. |
| UI zapisu | Formularz Astro i POST | Dashboard jest stroną serwerową; osiem checkboxów nie potrzebuje wyspy. |

## Scope

**In scope:**

- Funkcje zakresu (w tym 25.10.2026, dzień 25-godzinny) i testy
- Migracja insert/delete dla roli `behaviorist`
- Endpoint utworzenia i usunięcia
- Siatka `/dashboard`, oznaczenie blokad, formularz dnia

**Out of scope:**

- S-04, reguła tygodnia, edycja zakresu, notatka, maile
- Zmiana filtra `availableSlots` i kształtu tabeli
- Blokada weekendu, dzisiaj i przeszłości

## Architecture / Approach

`blockSelection` zamienia dzień i wybór na zakresy tą samą konwersją czasu co sloty. Endpoint behawiorysty wstawia te wiersze albo kasuje jeden po `id`. Dashboard czyta blokady miesiąca i rysuje formularz. Klient nic nowego nie woła: `getAvailableSlots` już wyrzuca slot nachodzący na zakres.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Reguły zakresu | Daty, zakresy, pokrycie, testy DST | Zła północ 25.10.2026 |
| 2. Zapis behawiorysty | RLS insert/delete i POST | Klient mógłby przejść politykę |
| 3. Kalendarz | Siatka zawsze i formularz dnia | Pusty miesiąc albo dzień 9.11 |

**Prerequisites:** S-02 jest done. Lokalny Supabase i konto z `profiles.role = behaviorist`.
**Estimated effort:** około 2 sesje po godzinach, 3 fazy.

## Open Risks & Assumptions

- Wiersz ze Studio o dowolnym zakresie widać na siatce i da się go usunąć w całości; UI nie tworzy takich zakresów.
- Usunięcie całego dnia zostawia wcześniejsze wiersze godzin na ten dzień. Trzeba je zdjąć osobno.
- W v1 nie ma kolumny właściciela: każdy behawiorysta (jest jeden) kasuje każdy wiersz.
- Testy RLS są ręczne; w repo nie ma harnessu HTTP.

## Success Criteria (Summary)

- Behawiorysta blokuje przyszły dzień roboczy albo godziny 10:00 i 14:00 i potrafi to cofnąć.
- Klient nie widzi zablokowanych terminów, a 11:00 przy blokadzie 10:00 i 14:00 zostaje.
- Wizyta pending na zablokowanym dniu zostaje na kalendarzu i w bazie.
