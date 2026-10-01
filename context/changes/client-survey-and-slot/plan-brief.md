# Klient: ankieta psa i wybór terminu konsultacji — Plan Brief

> Full plan: `context/changes/client-survey-and-slot/plan.md`

## What & Why

Plasterek S-01 z roadmapy: zalogowany klient wypełnia kompletną ankietę psa i dopiero wtedy wybiera wolny slot godzinowy. Teza produktu brzmi „sam termin nie wystarcza” — behawiorysta ma dostać zgłoszenie z pełnym obrazem psa. S-01 wnosi pierwszy schemat danych, model ról i izolację klientów, na których stoją S-02, S-03 i S-04.

## Starting Point

Starter Astro 7 + React + Supabase z samym logowaniem e-mail/hasło. Nie ma migracji, tabel domenowych ani ról. Middleware chroni tylko `/dashboard`. Jedynym testem jest `scripts/smoke.mjs` uruchamiany w CI na lokalnym Supabase.

## Desired End State

Klient rejestruje się (dostaje rolę `client`), na `/consultations/new` wypełnia ankietę z podpowiedziami ras, przechodzi do listy wolnych slotów (pn–pt 10:00–18:00, od jutra do 28 dni) i składa zgłoszenie. Na `/consultations` widzi tylko swoje zgłoszenia ze statusem. Zajęte i zablokowane terminy nie są dostępne, a wyścig o slot rozstrzyga baza.

## Key Decisions Made

| Decision               | Choice                                                                 | Why (1 sentence)                                                                 |
| ---------------------- | ---------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Granularność terminu   | Sloty 60 min, pn–pt, starty 10:00–17:00, stała w kodzie                | Klient wybiera konkretną godzinę bez UI konfiguracji po stronie behawiorysty.    |
| Blokady                | Model blokad (dzień lub zakres godzin) i filtrowanie już w S-01; UI w S-03 | Reguła „zablokowany termin nie przyjmuje konsultacji” działa od pierwszego dnia. |
| Zajęty slot            | Znika z listy; unikalny indeks na aktywnych konsultacjach              | „Wolny termin” znaczy dosłownie wolny; wyścig rozstrzyga baza.                   |
| Ankieta                | Imię, rasa, wiek (lata + miesiące), podstawowe informacje, cele (min. 20 znaków) | Jednoznaczny wiek szczeniąt i realny opis problemu.                         |
| Rasa                   | Statyczna lista polskich nazw ras + dowolny tekst (`<datalist>`)       | Zero zależności, a mieszańca opisuje się własnymi słowami.                       |
| Role                   | `profiles.role` (domyślnie `client`, trigger); behawiorysta nadawany ręcznie | RLS i middleware czytają rolę z jednego miejsca; S-02 tylko dopina widoki.  |
| Liczba zgłoszeń        | Dowolnie wiele; każde zgłoszenie = nowa ankieta                        | Dwa psy i kolejne wizyty bez osobnego profilu psa.                               |
| Okno rezerwacji        | Od jutra do dnia „dziś + 28” włącznie (Europe/Warsaw)                  | Behawiorysta ma czas przeczytać ankietę przed wizytą.                            |
| Zajętość bez wycieku   | Funkcja SQL `security definer` zwracająca same godziny startu          | RLS nie pozwala klientowi czytać cudzych zgłoszeń.                               |
| Wysyłka                | `fetch` + JSON (201/400/409)                                           | Przy konflikcie slotu ankieta nie przepada.                                      |
| Testy                  | Vitest dla slotów i walidacji + rozszerzony smoke (dwóch klientów)     | DST i granice okna łatwo zepsuć; smoke dowodzi izolacji na prawdziwej bazie.     |

## Scope

**In scope:**
- Migracja: `profiles`, `consultations`, `availability_blocks`, `taken_slot_starts`, RLS, trigger z backfillem
- Rola w middleware, ochrona `/consultations`
- `slots.ts`, `availability.ts`, `breeds.ts`, `consultation-schema.ts` + Vitest
- `GET /api/consultations/slots`, `POST /api/consultations`, `/consultations/new`, `/consultations`
- Rozszerzony smoke, README, opis S-03 w roadmapie

**Out of scope:**
- UI behawiorysty (S-02), ekran blokad (S-03), akceptacja/odrzucenie (S-04)
- Konfigurowalne godziny pracy, kalendarz świąt (święta wycinane ręcznymi blokadami), rezerwacje na dziś, profile psów, edycja/anulowanie zgłoszeń
- Maile, AI, przekierowanie po logowaniu zależne od roli, egzekwowanie godzin pracy w bazie

## Architecture / Approach

Baza pilnuje własności wierszy (RLS) i unikalności aktywnego slotu. Reguły dostępności liczy jedna czysta funkcja `availableSlots({ now, blocks, taken })` w strefie Europe/Warsaw, wspólna dla strony, API slotów i endpointu zapisu. Strona `/consultations/new` renderuje sloty na serwerze i przekazuje je do dwukrokowej wyspy React (ankieta → slot). Wyspa wysyła zgłoszenie `fetch`em i przy `409` odświeża sloty, zachowując ankietę.

## Phases at a Glance

| Phase                                   | What it delivers                                              | Key risk                                                  |
| --------------------------------------- | ------------------------------------------------------------- | --------------------------------------------------------- |
| 1. Schemat danych, role i izolacja      | Migracja z RLS, typy bazy, rola w middleware, README          | Błędna polityka RLS przepuszcza cudze dane                |
| 2. Logika terminów i walidacja ankiety  | `slots.ts`, schemat ankiety, lista ras, testy Vitest          | Zmiana czasu 25.10 przesuwa sloty o godzinę               |
| 3. Endpointy i ekrany klienta           | API slotów i zapisu, formularz dwukrokowy, „Moje konsultacje” | Utrata ankiety przy konflikcie slotu                      |
| 4. Smoke przepływu rezerwacji i domknięcie | Smoke z dwoma klientami, konfliktem i izolacją; roadmapa      | Niestabilny smoke lokalnie, gdy sloty się wyczerpią       |

**Prerequisites:** Docker + lokalny Supabase (`npx supabase start`), `.env` i `.dev.vars` z kluczami.
**Estimated effort:** ~4–5 sesji po godzinach (po jednej na fazę, faza 3 może zająć dwie).

## Open Risks & Assumptions

- Godziny pracy (pn–pt 10–18) są założeniem; PRD zostawia liczbę godzin tygodniowo otwartą. Zmiana to edycja jednej stałej.
- Reguły godzin pracy i blokad egzekwuje serwer, nie baza. Ominięcie wymaga ręcznego użycia tokenu z ciasteczka — akceptowalne w v1.
- Przy wielokrotnym lokalnym smoke bez `db reset` sloty stopniowo się zapełniają (160 w oknie).

## Success Criteria (Summary)

- Klient składa kompletne zgłoszenie z ankietą i wolnym terminem i widzi je w „Moich konsultacjach”.
- Inny klient nie widzi tego zgłoszenia ani nie może zająć tego samego slotu.
- Zablokowane w Studio dni i godziny nie pojawiają się jako dostępne terminy.
