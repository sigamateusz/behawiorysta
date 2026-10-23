---
date: 2026-10-23T15:51:54+02:00
researcher: Mateusz
git_commit: 161a245cdc368ec3017247e48cc483c77910d7de
branch: main
repository: behawiorysta
topic: "Które odczyty i zapisy zgłoszenia istnieją i które wymagają właściciela"
tags: [research, codebase, consultations, rls, smoke]
status: complete
last_updated: 2026-10-23
last_updated_by: Mateusz
---

# Research: Które odczyty i zapisy zgłoszenia wymagają właściciela

**Date**: 2026-10-23T15:51:54+02:00
**Researcher**: Mateusz
**Git Commit**: 161a245cdc368ec3017247e48cc483c77910d7de
**Branch**: main
**Repository**: behawiorysta

## Research Question

Faza 4 z `context/foundation/test-plan.md`: które odczyty i zapisy zgłoszenia istnieją i które wymagają właściciela zasobu, a nie samego zalogowania. Dowód z wiersza ryzyka #4: klient A nie odczytuje ani nie zmienia zgłoszenia klienta B, behawiorysta zachowuje swoje odczyty, anonim dostaje odmowę. Wyzwanie tego wiersza: jeden smoke listy nie pokrywa każdego takiego odczytu i zapisu.

## Summary

Na przejrzanym `src` zgłoszenie jest wierszem `public.consultations`. Grep `.from("consultations")` w `src` zwraca pięć wywołań: lista klienta, lista behawiorysty, szczegół behawiorysty, insert klienta i aktualizacja statusu przez behawiorystę.

Spośród tych pięciu wywołań sesja klienta dochodzi do odczytu w `GET /consultations`. Dwa pozostałe odczyty są na `/dashboard`, skąd middleware odsyła rolę `client`. Zapytanie nie ma predykatu `client_id` (`src/pages/consultations/index.astro:28-31`). Właściciela wymaga polityka `consultations_select_own`: `client_id = (select auth.uid())` (`supabase/migrations/20261001182110_client_survey_and_slot.sql:70-72`). Middleware puszcza na `/consultations` sesję z rolą `client` (`src/middleware.ts:69-75`) i nie porównuje `client_id`.

Insert `POST /api/consultations` nie przyjmuje `client_id` (`src/pages/api/consultations/index.ts:41-51`). Schemat formularza też go nie ma (`src/lib/consultation-schema.ts:43-47`). Polityka `consultations_insert_own_pending` wymaga `client_id = (select auth.uid())`, `status = 'pending'` i roli `client` w `profiles` (`supabase/migrations/20261001182110_client_survey_and_slot.sql:74-83`).

Jedyna aktualizacja wiersza w tym grep to `POST /api/consultations/:id/decision`. Handler sprawdza rolę behawiorysty (`src/lib/consultation-api.ts:29-41`), potem `.eq("id", id)` i `.eq("status", "pending")` (`src/pages/api/consultations/[id]/decision.ts:22-27`). Polityka `consultations_update_behaviorist_decision` wymaga roli `behaviorist` (`supabase/migrations/20261011130000_behaviorist_decide_consultation.sql:5-20`). Grant w tej migracji to `update (status)` (linia 3). To nie jest porównanie właściciela.

`scripts/smoke.mjs` sprawdza cudze zgłoszenie w jednym odczycie listy: HTML `GET /consultations` sesji B nie zawiera `dogName` konta A (`scripts/smoke.mjs:301-303`). W tym pliku nie ma `GET /dashboard/${bookedId}` ani `POST` decyzji z `jarA` albo `jarB`.

## Detailed Findings

### Odczyty wiersza

`GET /consultations` wybiera `id, dog_name, breed, slot_start, status` i sortuje po `slot_start` (`src/pages/consultations/index.astro:28-31`). Brak `.eq("client_id", ...)`. Wejście: sesja i rola `client` (`src/middleware.ts:56-59`, `src/middleware.ts:69-75`). Izolacja dwóch klientów na tej stronie stoi na `consultations_select_own`.

`GET /dashboard` wybiera `id, dog_name, breed, slot_start, status, created_at` bez filtra właściciela (`src/pages/dashboard.astro:178-179`). Wynik przechodzi przez `visibleSubmissions` (`src/pages/dashboard.astro:192`). Ta funkcja zostawia wiersz `pending` oraz wiersz `accepted`, którego `slot_start + SLOT_MINUTES` jest później niż `now`; pozostałe statusy, w tym `rejected`, odrzuca (`src/lib/behaviorist-submissions.ts:20-23`). Wejście na `/dashboard` zostawia sesję, dla której `dashboardRedirect` zwraca `null`, czyli rolę `behaviorist` (`src/lib/role-routes.ts:1-8`, `src/middleware.ts:62-66`).

`GET /dashboard/[id]` czyta ten sam zestaw kolumn plus ankietę, z `.eq("id", id)` (`src/pages/dashboard/[id].astro:37-41`). Pusty wynik `visibleSubmissions` daje 404 (`src/pages/dashboard/[id].astro:50-51`). Polityka `consultations_select_behaviorist` nie ma warunku `client_id` ani `status`: puszcza wiersz, gdy `profiles.role` zalogowanego użytkownika to `behaviorist` (`supabase/migrations/20261008150000_behaviorist_select_consultations.sql:3-10`).

`GET /api/consultations/slots` i `GET /consultations/new` wołają `getAvailableSlots`. Ta funkcja nie czyta tabeli `consultations`. Czyta `availability_blocks` i RPC `taken_slot_starts` (`src/lib/availability.ts:8-13`). Funkcja SQL jest `security definer` i zwraca `slot_start` wierszy o statusie `pending` albo `accepted` w podanym zakresie (`supabase/migrations/20261001182110_client_survey_and_slot.sql:111-123`). Komentarz nad funkcją mówi, że wystawia same czasy startu, bo RLS chowa wiersze innych klientów (linia 110). `execute` po `revoke` od `public` i `anon` jest nadany `authenticated` (linie 126–127). To odczyt cudzego czasu startu, nie kolumn ankiety.

### Zapisy wiersza

`POST /api/consultations` przechodzi `requireClientApi`: brak sesji daje 401, rola inna niż `client` daje 403 (`src/lib/consultation-api.ts:20-25`). Insert wstawia pola ankiety i `slot_start` (`src/pages/api/consultations/index.ts:41-51`). Kolumna `client_id` ma w tabeli default `auth.uid()` (`supabase/migrations/20261001182110_client_survey_and_slot.sql:47`). Drugi aktywny zapis tego samego `slot_start` wpada w indeks `consultations_active_slot_uidx` (linie 62–63); handler zamienia kod `23505` na 409 (`src/pages/api/consultations/index.ts:55-57`). Ten 409 nie jest aktualizacją wiersza A.

`POST /api/consultations/[id]/decision` jest poza `PROTECTED_ROUTES` (`src/middleware.ts:6-7`), więc bramka jest w handlerze. `requireBehavioristForm` bez sesji przekierowuje na `/auth/signin` (`src/lib/consultation-api.ts:34-35`). Dla roli `client` `dashboardRedirect` zwraca `/consultations` (`src/lib/role-routes.ts:5-6`), i handler robi ten redirect zanim wywoła `update` (`src/lib/consultation-api.ts:37-39`). Udana aktualizacja ustawia `status` na `accepted` albo `rejected` i przekierowuje na `/dashboard?decided=…` (`src/pages/api/consultations/[id]/decision.ts:22-38`).

W czterech plikach `supabase/migrations` po `revoke all on public.consultations` są granty `select, insert` oraz późniejszy `update (status)`. W tych plikach nie ma `grant delete` na `public.consultations`.

### Czego w przejrzanym `src/pages` nie ma

Glob `src/pages/**/*.{ts,astro}` zwrócił 17 plików. Nie ma wśród nich `src/pages/consultations/[id].astro`. Grep `export const (GET|POST|PUT|PATCH|DELETE)` w `src` zwrócił osiem handlerów. Dla konsultacji są trzy: `POST` tworzenia, `GET` slotów, `POST` decyzji. W tym grep nie ma `PUT`, `PATCH` ani `DELETE` konsultacji.

### Co smoke już woła

W `scripts/smoke.mjs` cudze dane zgłoszenia sprawdzają trzy kroki sesji B wobec zapisu A:

- `GET /api/consultations/slots` — odpowiedź nie zawiera `bookedSlot` (`scripts/smoke.mjs:286-288`).
- `POST /api/consultations` na ten sam slot — status 409 (`scripts/smoke.mjs:291-298`).
- `GET /consultations` — body nie zawiera `dogName` A (`scripts/smoke.mjs:301-303`).

Krok „B consultations list hides the pending dog” wyklucza z listy B imię `ClientB-${stamp}` (`scripts/smoke.mjs:306-308`). To imię pochodzi z odrzuconego zapisu B, nie z wiersza A.

Odmowa anonima w tym pliku: `GET /consultations` daje 302 na `/auth/signin` (`scripts/smoke.mjs:155-157`), `GET /dashboard` przed założeniem konta daje 302 na `/auth/signin` (`scripts/smoke.mjs:135`), `POST /api/consultations` daje 401 (`scripts/smoke.mjs:336-338`). Sesja klienta na `GET /dashboard` daje 302 na `/consultations` (`scripts/smoke.mjs:151`). Ścieżka tego żądania to `/dashboard`, nie `/dashboard/${bookedId}`.

Jedno wywołanie decyzji w tym pliku idzie z `jarBehaviorist` (`scripts/smoke.mjs:311-318`). Po zapisie B (`scripts/smoke.mjs:321-328`) lista sprawdzana jako następna jest listą B (`scripts/smoke.mjs:331-333`), nie listą A.

Spec `tests/e2e/post-login-screen.spec.ts` sprawdza ekran po zalogowaniu. Test klienta oczekuje pustej listy świeżego konta (`tests/e2e/post-login-screen.spec.ts:32-34`). W tym pliku nie ma asercji o wierszu drugiego klienta.

## Code References

- `src/pages/consultations/index.astro:28-31` — odczyt listy klienta bez `client_id`
- `src/middleware.ts:6-7` — `PROTECTED_ROUTES`: `/dashboard`, `/consultations`
- `src/middleware.ts:69-75` — `/consultations` tylko dla roli `client`
- `src/lib/consultation-api.ts:15-26` — 401 bez sesji, 403 gdy rola ≠ `client`
- `src/lib/consultation-api.ts:29-41` — decyzja: redirect anonima i roli innej niż behawiorysta
- `src/pages/api/consultations/index.ts:41-51` — insert bez `client_id`
- `src/pages/api/consultations/[id]/decision.ts:22-27` — update statusu po `id`, bez `client_id`
- `src/pages/dashboard.astro:178-179` — odczyt listy behawiorysty bez `client_id`
- `src/pages/dashboard/[id].astro:37-41` — odczyt szczegółu po `id`
- `src/lib/behaviorist-submissions.ts:13-24` — filtr widoku, nie bramka właściciela
- `src/lib/availability.ts:8-13` — RPC `taken_slot_starts`, nie `select` wiersza
- `supabase/migrations/20261001182110_client_survey_and_slot.sql:70-83` — select i insert właściciela
- `supabase/migrations/20261008150000_behaviorist_select_consultations.sql:3-10` — select behawiorysty
- `supabase/migrations/20261011130000_behaviorist_decide_consultation.sql:3-20` — update statusu dla behawiorysty
- `scripts/smoke.mjs:301-303` — jedyny krok, w którym lista B nie zawiera psa A

## Architecture Insights

Na ścieżce listy klienta aplikacja nie porównuje właściciela. Porównanie jest w polityce RLS, a klient Supabase w `createClient` dostaje `SUPABASE_KEY` i ciasteczka żądania (`src/lib/supabase.ts:7-10`). Test dwóch kont na tym HTTP widzi skutek polityki, bo zapytanie strony nie ma własnego filtra `client_id`. Test funkcji filtrującej listę w pamięci nie przechodzi przez tę ścieżkę: takiego filtra w `index.astro` nie ma.

Odczyty i zapis decyzji behawiorysty są bramkowane rolą. Żądanie klienta pod `/dashboard/[id]` albo na decyzję kończy się przekierowaniem roli, zanim poleci zapytanie o cudzy `id`. Taki redirect jest taki sam dla własnego `id` klienta. Nie rozróżnia właściciela wiersza.

## Historical Context (from prior changes)

- `context/archive/2026-10-01-client-survey-and-slot/plan.md:237` — kontrakt listy: odczyt przez RLS, bez filtra `client_id` w kodzie. **Supported** dla obecnego `src/pages/consultations/index.astro:28-31`.
- `context/archive/2026-10-01-client-survey-and-slot/plan.md:72` — „Brak `update/delete`” przy politykach select i insert właściciela. **Partial.** Select i insert właściciela są w migracji S-01. Późniejsza migracja nadaje `authenticated` grant `update (status)` i politykę update dla behawiorysty (`supabase/migrations/20261011130000_behaviorist_decide_consultation.sql:3-20`). W czterech plikach migracji nie ma `grant delete` na `public.consultations`.
- `context/archive/2026-10-01-client-survey-and-slot/plan.md:74` — `taken_slot_starts` zwraca czasy startu aktywnych konsultacji, `execute` dla `authenticated`. **Supported** dla ciała funkcji w `supabase/migrations/20261001182110_client_survey_and_slot.sql:111-127`.
- `context/archive/2026-10-08-behaviorist-submission-views/plan.md:62` — polityka behawiorysty puszcza wiersz, a 404 robi strona po `visibleSubmissions`. **Supported** dla `consultations_select_behaviorist` (brak warunku statusu) i `src/pages/dashboard/[id].astro:45-51`.
- `context/foundation/prd.md:48` i `context/foundation/prd.md:90` — klient nie widzi zgłoszenia, ankiety ani kalendarza innego klienta. **Supported jako wymaganie widoczności.** Te dwa zdania nie mówią o zmianie cudzego wiersza. Zakaz update/delete klienta jest w planie S-01 i w grantach migracji, z wyjątkiem opisanym wyżej.
- `context/foundation/prd.md:48` wobec `taken_slot_starts` — **Partial.** Strażnik mówi o kalendarzu innego klienta. Funkcja zwraca `slot_start`, nie kolumny ankiety, i plan S-01 opisuje to jako zamierzone.

W `context/archive/2026-10-01-client-survey-and-slot/` nie ma `research.md`. `context/changes/testing-client-read-isolation/change.md` nie niesie decyzji: Notes są komentarzem szablonu.

## Related Research

- `context/archive/2026-10-08-behaviorist-submission-views/research.md` — polityka select behawiorysty i filtr widoku.
- `context/archive/2026-10-19-testing-post-login-screen/research.md` — przekierowanie roli po zalogowaniu, nie odczyt wiersza klienta B.
- `context/archive/2026-10-11-behaviorist-decide-consultation/plan.md` — update statusu; w tym katalogu nie szukano osobnego research.md poza grepem decyzji.

## Open Questions

Nie odpytano działającej bazy. Werdykt dotyczy tekstu czterech migracji i handlerów w tym commicie. Rozjazd lokalnej bazy z tymi plikami zostałby niewidoczny w tym dokumencie.
