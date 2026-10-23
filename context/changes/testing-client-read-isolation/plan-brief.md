# Client Read Isolation — Plan Brief

> Full plan: `context/changes/testing-client-read-isolation/plan.md`
> Research: `context/changes/testing-client-read-isolation/research.md`

## What & Why

Smoke sprawdza cudze zgłoszenie jednym krokiem: lista klienta B nie zawiera psa A. Ryzyko #4 mówi, że ten krok nie pokrywa każdego odczytu i zapisu. Plan dokłada odczyt behawiorysty, odmowę decyzji przez klienta B i anonima oraz listę A po zapisie B.

## Starting Point

Lista klienta nie filtruje `client_id`; izolację robi polityka RLS. Jedyny zapis istniejącego wiersza to decyzja behawiorysty. Smoke ma już dwa konta, promocję behawiorysty i odrzucenie wiersza A, ale nie czyta wtedy `/dashboard` ani nie wysyła decyzji z sesji klienta albo anonima.

## Desired End State

Na zielonym smoke behawiorysta widzi psa A na liście i w szczegółach, dopóki wiersz jest `pending`. Decyzja klienta B i anonima nie przeszkadza późniejszemu odrzuceniu tego wiersza. Po zapisie B lista A zawiera psa A i nie zawiera psa B. Cookbook opisuje ten wzorzec.

## Key Decisions Made

| Decision                | Choice                                                                                   | Why (1 sentence)                                                                            | Source   |
| ----------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | -------- |
| Warstwa                 | HTTP w `scripts/smoke.mjs`, dwa konta                                                    | Plan testów zostawia #4 przy smoke i wyklucza Playwrighta                                   | Research |
| Adres szczegółu klienta | Pominięty                                                                                | 302 na `/consultations` leci przed zapytaniem i jest takie samo dla własnego id klienta     | Plan     |
| Dowód zapisu            | Przekierowanie odmowy i późniejsze `decided=rejected`                                    | Samo 302 nie pokazuje, że wiersz został `pending`                                           | Plan     |
| Odczyt behawiorysty     | `GET /dashboard` i `GET /dashboard/{id}` zawierają `dogName`, póki wiersz jest `pending` | Sekcja „Wszystkie zgłoszenia” wypisuje każde widoczne zgłoszenie, nie tylko siatkę miesiąca | Research |
| Kod produktu            | Bez zmian                                                                                | Bramki już są w RLS i w roli na decyzji                                                     | Research |

## Scope

**In scope:**

- Kroki smoke: odczyt behawiorysty, decyzja klienta B, decyzja anonima, lista A po zapisie B
- §6.4 i §6.6 w `context/foundation/test-plan.md`

**Out of scope:**

- `GET /dashboard/{id}` sesją klienta
- Playwright, nowe trasy, zmiany RLS i porównanie `client_id` w aplikacji
- §1, §2 i słownik statusów w §3

## Architecture / Approach

Nowe kroki wchodzą w istniejący ciąg smoke. Odczyt behawiorysty i obie decyzje padają, gdy wiersz A jest jeszcze `pending`, przed krokiem odrzucenia. Lista A jest sprawdzana po tym, jak B dostaje 201 na zwolnionym terminie. Asercja listy to status 200 oraz obecność psa A i brak psa B, nie sam kod przekierowania.

## Phases at a Glance

| Phase                     | What it delivers                                            | Key risk                                             |
| ------------------------- | ----------------------------------------------------------- | ---------------------------------------------------- |
| 1. Kroki izolacji w smoke | Odczyt behawiorysty, dwie odmowy decyzji, lista A bez psa B | Krok wstawiony po odrzuceniu nie widzi już `pending` |
| 2. Wzorzec w cookbooku    | §6.4 i §6.6 bez ruszania strategii                          | Przypadkowe przepisanie słownika statusów w §3       |

**Prerequisites:** lokalny Supabase i podgląd, tak jak przy obecnym `npm run smoke`
**Estimated effort:** jedna sesja, dwie fazy

## Open Risks & Assumptions

- Research nie odpytał działającej bazy. Zielone smoke na lokalnym Supabase jest sprawdzeniem, że polityki z migracji naprawdę obowiązują.
- Jeśli `visibleSubmissions` przestanie zostawiać wiersz `pending`, odczyt behawiorysty obleje nawet wtedy, gdy RLS nadal zwraca wiersz. To jest zamierzone: dowód dotyczy stron, które behawiorysta czyta.

## Success Criteria (Summary)

- Behawiorysta widzi psa A na `/dashboard` i w szczegółach, zanim wiersz zostanie odrzucony.
- Decyzja klienta B i anonima nie zdejmuje `pending`: odrzucenie behawiorysty dalej kończy się na `decided=rejected`.
- Lista A po zapisie B nie zawiera psa B, a cookbook to opisuje.
