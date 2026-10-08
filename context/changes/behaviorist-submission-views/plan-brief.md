# Widoki zgłoszeń behawiorysty — Plan Brief

> Full plan: `context/changes/behaviorist-submission-views/plan.md`
> Research: `context/changes/behaviorist-submission-views/research.md`

## What & Why

Behawiorysta ma zobaczyć zgłoszenie, które klient już składa: ankietę psa i wybrany termin, bez składania obrazu z wiadomości. S-02 dowozi kalendarz, listę i szczegóły. Akceptacja i blokady dni czekają w S-04 i S-03.

## Starting Point

Logowanie z rolą `behaviorist` działa, ale po haśle wszyscy lądują na `/`. `/dashboard` jest angielską kartą i wpuszcza też klienta. Odczyt `consultations` ma tylko właściciel wiersza. E-maila klienta nie ma na `profiles` ani na zgłoszeniu. Długość slotu to 60 minut w kodzie, nie w kolumnie.

## Desired End State

Behawiorysta po sign-in jest na `/dashboard`: miesiąc Warszawy i lista tego samego zbioru. Widać każde oczekujące zgłoszenie oraz zaakceptowane, dopóki 60-minutowy slot się nie skończy. Szczegóły pod `/dashboard/[id]` pokazują ankietę i termin, bez e-maila. Klient z tych adresów wraca na `/consultations`.

Przy 8.10.2026 15:00 Warszawa lista to Fafik, Burek, Azor. Azor (2.11 17:00) jest na liście od razu, a w siatce dopiero w listopadzie. Reks i Luna nie otwierają się (404).

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Zbiór | Oczekujące zawsze; zaakceptowane do końca 60 min; bez odrzuconych i odbytych | Zaległa decyzja nie ginie, a odbyta wizyta nie udaje najbliższego wydarzenia. | Plan |
| Granica slotu | Widoczne, gdy `slot_start + 60 min > now`; o 15:00 wizyta 14:00 znika | „Odbyta” liczy się po pełnej godzinie, nie w chwili startu. | Plan |
| Kolejność | `slot_start`, potem `created_at`, potem `id` | Fafik (termin minął) stoi przed jutrzejszym Burkiem. | Plan |
| Kalendarz | Miesiąc Warszawa, poniedziałek pierwszy; lista to cały zbiór | Dwa różne widoki; Azor nie czeka, aż ktoś przewinie październik. | Plan |
| Szczegóły | Ankieta, wiek, termin, status; bez e-maila | FR-006 wymienia ankietę, a adresu nie ma na wierszu. | Plan |
| Trasy | `/dashboard` i `/dashboard/[id]`; po sign-in behawiorysta tam, klient na `/` | Behawiorysta i tak jest wyrzucany z `/consultations` na `/dashboard`. | Plan |
| Odczyt | Polityka `select` dla `behaviorist` na każdy wiersz; filtr w aplikacji | S-04 pokaże odrzucone bez kolejnej polityki, a ekran i tak je chowa. | Plan |
| Klucz | Klient ciasteczkowy, bez service role | Tak każe plan wdrożenia. | Research |

## Scope

**In scope:**

- `visibleSubmissions` + test fixture pięciu psów
- Migracja `consultations_select_behaviorist`
- Middleware, redirect po sign-in, poprawka smoke klienta
- `/dashboard` (miesiąc + lista) i `/dashboard/[id]` na tokenach

**Out of scope:**

- E-mail klienta, akceptacja/odrzucenie, blokady, AI
- Archiwum Reksa i Luny w UI
- Tłumaczenie Welcome i paska; usuwanie `DashboardCard`
- Lista klienta i jej linki

## Architecture / Approach

Polityka RLS puszcza behawioryście każdy wiersz `consultations`. Strony Astro filtrują go przez `visibleSubmissions(rows, now)` — ta sama funkcja karmi listę, linki dnia w miesiącu i decyzję 404. Sign-in i middleware wołają `src/lib/role-routes.ts`.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Zbiór i odczyt | Testowany predykat i polityka `select` | Zły instant Azora (2.11 to CET, `16:00Z`) |
| 2. Wejście | Tylko behawiorysta na `/dashboard`; smoke klienta na `/consultations` | Krok smoke z linii 92 dziś oczekuje 200 |
| 3. Widoki | Miesiąc, lista całego zbioru, ankieta, 404 poza zbiorem | Siatka października chowa Azora, lista nie |

**Prerequisites:** S-01 w bazie, lokalny Supabase, jedno konto z ręcznie ustawioną rolą `behaviorist`.
**Estimated effort:** około 2 sesje po godzinach, 3 fazy.

## Open Risks & Assumptions

- Behawiorysta, który odpyta PostgREST z własnego ciasteczka, zobaczy też Reksa i Lunę. Ekran ich nie renderuje.
- Remis `slot_start` dwóch aktywnych wierszy wycina indeks z S-01; test remisu jest tylko na funkcji.
- `DashboardCard` na `/dev/dashboard-states` zostaje po angielsku.

## Success Criteria (Summary)

- Behawiorysta po logowaniu widzi Fafika, Burka i Azora na liście, Azora w siatce listopada, a Burka z pełną ankietą i bez e-maila.
- Luna i Reks dają 404 bez treści ankiety.
- Klient nie wchodzi na `/dashboard`; jego sign-in nadal kończy się na `/`.
