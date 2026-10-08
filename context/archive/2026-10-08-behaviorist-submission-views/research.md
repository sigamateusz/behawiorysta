---
date: 2026-10-08T14:43:10+02:00
researcher: Mateusz
git_commit: fcbc6e6e6d18e3f90888bbc62b43a5acc80b13b5
branch: main
repository: behawiorysta
topic: "Widoki zgłoszeń behawiorysty (S-02): co już jest do logowania, kalendarza, listy i szczegółów ankiety"
tags: [research, codebase, consultations, roles, rls, dashboard]
status: complete
last_updated: 2026-10-08
last_updated_by: Mateusz
---

# Research: Widoki zgłoszeń behawiorysty (S-02)

**Date**: 2026-10-08T14:43:10+02:00
**Researcher**: Mateusz
**Git Commit**: fcbc6e6e6d18e3f90888bbc62b43a5acc80b13b5
**Branch**: main
**Repository**: behawiorysta

## Research Question

Co w kodzie i w zamkniętym S-01 jest już gotowe, żeby behawiorysta zalogował się, zobaczył kalendarz i listę zgłoszeń oraz otworzył szczegóły z kompletną ankietą i wybranym terminem (roadmap S-02, FR-002, FR-005, FR-006)? Czego w tym zakresie jeszcze nie ma?

## Summary

Logowanie behawiorysty (FR-002) działa na tym samym formularzu co klient, o ile w `profiles.role` jest `behaviorist`. Ankieta i wybrany termin są już jednym wierszem `public.consultations`. Kalendarza, listy zgłoszeń behawiorysty i strony szczegółów (FR-005, FR-006) nie ma wśród 13 plików w `src/pages/`.

W migracji `20261001182110_client_survey_and_slot.sql` polityka `select` na `consultations` przepuszcza wiersz tylko gdy `client_id` równa się `auth.uid()`. Przy kluczu publishable opisanym w `context/deployment/deploy-plan.md` klient z ciasteczka sesji podlega RLS, więc behawiorysta nie odczyta cudzej ankiety tym klientem. S-01 zostawiło politykę odczytu dla behawiorysty i całe UI S-02 poza zakresem.

## Detailed Findings

### Logowanie i rola (FR-002)

Gdy `createClient` dostaje `SUPABASE_URL` i `SUPABASE_KEY`, middleware woła `supabase.auth.getUser()` i zapisuje użytkownika w `context.locals.user`. Brak tych sekretów daje `null` i nie ustawia użytkownika (`src/lib/supabase.ts:6-9`, `src/middleware.ts:17-21`). Astro session jest wyłączone (`astro.config.mjs:17`).

Rola nie jest osobną sesją. Kolumna `profiles.role` przyjmuje `client` albo `behaviorist`, domyślnie `client` (`supabase/migrations/20261001182110_client_survey_and_slot.sql:5-8`). Trigger `handle_new_user` wstawia nowemu użytkownikowi `client` (`supabase/migrations/20261001182110_client_survey_and_slot.sql:21-28`). Middleware czyta własny wiersz profilu i ustawia `locals.role` na `client`, `behaviorist` albo `null`, gdy wartość nie jest żadną z tych dwóch (`src/middleware.ts:7-8`, `src/middleware.ts:23-26`, `src/env.d.ts:4`).

Udane `POST /api/auth/signin` przekierowuje na `/` i nie czyta roli (`src/pages/api/auth/signin.ts:13-19`). Grep `behaviorist` w `src/**/*.{ts,tsx,astro,mjs}` trafia w `src/middleware.ts` i `src/env.d.ts`. Jedyne `from("profiles")` w `src/**/*.{ts,tsx,astro}` to `select("role")` w middleware (`src/middleware.ts:24`). W tym zakresie formularze auth nie zapisują roli. Plan S-01 każe nadawać ją ręcznym `update` (`context/archive/2026-10-01-client-survey-and-slot/plan.md:18`).

Ochrona tras w tym middleware:

- `/dashboard` i ścieżki zaczynające się od `/consultations` wymagają `locals.user`; brak sesji idzie na `/auth/signin` (`src/middleware.ts:4-5`, `src/middleware.ts:31-34`).
- Ścieżki `/consultations`: rola `behaviorist` idzie na `/dashboard`, a rola inna niż `client` (w tym `null`) na `/` (`src/middleware.ts:37-43`).
- `/dashboard` w tym bloku nie sprawdza roli. Zalogowany klient nie jest z niego wyrzucany.

Topbar dla `role === "client"` linkuje „Moje konsultacje” → `/consultations`. Każda inna wartość, także `behaviorist` i `null`, dostaje „Dashboard” → `/dashboard` (`src/components/Topbar.astro:12-26`).

### Wiersz zgłoszenia, który widoki mają czytać

Glob `supabase/migrations/*.sql` zwraca jeden plik: `20261001182110_client_survey_and_slot.sql`. Ten plik nie tworzy tabel `dogs`, `surveys` ani `slots`. Ankieta i termin to kolumny `public.consultations` (`supabase/migrations/20261001182110_client_survey_and_slot.sql:45-58`):

- ankieta: `dog_name` (1–60), `breed` (1–80), `age_years` (0–25), `age_months` (0–11), `basic_info` (1–2000), `goals` (20–2000), plus check wieku co najmniej 1 miesiąc (linia 57)
- termin: `slot_start timestamptz`
- obok tego: `id`, `client_id`, `status` (`pending` | `accepted` | `rejected`, domyślnie `pending`), `created_at`

Katalog wolnych slotów nie jest tabelą. W `src/lib/slots.ts:1-7` stałe to `Europe/Warsaw`, dni 1–5, starty godzin 10, 11, 12, 13, 14, 15, 16 i 17, `SLOT_MINUTES = 60`, horyzont 28 dni. Koniec slotu nie jest kolumną; 60 minut jest stałą w tym pliku.

`profiles` w tej migracji ma `id`, `role`, `created_at` (`supabase/migrations/20261001182110_client_survey_and_slot.sql:5-8`). E-mail zalogowanego użytkownika jest na obiekcie auth (Topbar wypisuje `user.email`), nie na wierszu konsultacji.

Na `consultations` w tym pliku są dokładnie dwie polityki: `consultations_select_own` (`client_id = auth.uid()`) i `consultations_insert_own_pending` (własny wiersz, `status = 'pending'`, rola profilu `client`). Grant dla `authenticated` to `select, insert` (`supabase/migrations/20261001182110_client_survey_and_slot.sql:67-83`).

`createClient` buduje klienta ciasteczkowy na `SUPABASE_KEY` (`src/lib/supabase.ts:10-21`). `context/deployment/deploy-plan.md:20` i `context/deployment/deploy-plan.md:96-98` opisują ten klucz jako publishable / anon i każą nie wklejać `service_role`. Przy takim kluczu zapytanie sesji podlega RLS: wiersz konsultacji wraca, gdy `client_id` jest identyfikatorem tej sesji. Użytkownik, który ma już rolę `behaviorist`, nie przechodzi polityki insert (linia 81). Ten sam użytkownik zobaczy wcześniejsze własne wiersze, jeśli powstały, gdy jego `auth.uid()` było `client_id`. Nie ma w tym pliku polityki `select` dla roli `behaviorist`.

Dwie rzeczy sesja behawiorysty już odczyta, bo nie są pełnym zgłoszeniem:

- `taken_slot_starts` jest `security definer` i zwraca same `slot_start` konsultacji `pending` lub `accepted` w podanym zakresie; `execute` ma `authenticated` (`supabase/migrations/20261001182110_client_survey_and_slot.sql:111-127`).
- `availability_blocks_select_authenticated` to `select` dla `authenticated` z `using (true)` (`supabase/migrations/20261001182110_client_survey_and_slot.sql:104-106`). Grant w tym pliku dla `authenticated` na tej tabeli to `select` (linie 101–102); komentarz przy linii 87 zostawia zapis w Studio do czasu S-03.

Lista klienta wybiera `id, dog_name, breed, slot_start, status` i w tym szablonie nie linkuje pozycji listy (`src/pages/consultations/index.astro:28-31`, `src/pages/consultations/index.astro:83-94`). `POST /api/consultations` wstawia `dog_name`, `breed`, `age_years`, `age_months`, `basic_info`, `goals` i `slot_start` (`src/pages/api/consultations/index.ts:43-51`). Ta strona listy tych czterech pól ankiety poza imieniem i rasą nie czyta.

### Strony, których S-02 jeszcze nie ma (FR-005, FR-006)

Glob `src/pages/**/*.{astro,ts}` w tym repo zwraca 13 plików. Żaden nie ma segmentu `[id]`. Nie ma strony kalendarza ani szczegółów zgłoszenia.

`/dashboard` renderuje `DashboardCard` z e-mailem sesji i nie odpytuje `consultations` (`src/pages/dashboard.astro:6-16`, `src/components/dashboard/DashboardCard.tsx:8-16`). Tekst karty jest po angielsku („Welcome”, „Sign out”).

Grep `Calendar|calendar` w `src/**/*.{astro,tsx,ts}` trafia w ikonę Lucide w `SurveyStep.tsx` i w komentarz o dacie kalendarzowej w `src/lib/slots.ts:57`. W tym przeszukaniu nie ma komponentu kalendarza zgłoszeń.

PRD rozdziela dwa widoki najbliższych zdarzeń: kalendarz i lista (`context/foundation/prd.md:77-78`). Szczegóły mają pokazać kompletną ankietę, w tym pytanie otwarte (`context/foundation/prd.md:79-80`). Podsumowanie AI (FR-009) jest poza przepływem 3 tygodni (`context/foundation/prd.md:85-86`, `context/foundation/prd.md:109`). Akceptacja, odrzucenie i blokowanie dni to FR-007 i FR-008, czyli S-03 i S-04, nie ten plasterek (`context/foundation/roadmap.md:101-122`).

### Kontrakt UI, który nowe widoki dziedziczą

`/dashboard` używa tokenów (`bg-background` w `src/pages/dashboard.astro:10`) i `Card` z `src/components/ui/`. Strona `/consultations` w tym pliku używa klas palety (`text-amber-200`, `bg-purple-600`, `bg-cosmic` i podobne, `src/pages/consultations/index.astro:16-19`, `src/pages/consultations/index.astro:42-47`). Archiwum `ui-tokens-onboarding` zostawiło strony konsultacji przy `bg-cosmic` (`context/archive/2026-10-06-ui-tokens-onboarding/plan.md:39`). Nowe widoki S-02 podpadają pod regułę z `AGENTS.md`: tokeny z `src/styles/global.css`, bez klas palety.

Etykiety statusu na liście klienta, w tym pliku: `pending` → „Oczekuje na decyzję”, `accepted` → „Zaakceptowana”, `rejected` → „Odrzucona” (`src/pages/consultations/index.astro:10-14`).

## Code References

- `src/middleware.ts:4-43` — trasy chronione, rola z `profiles`, behawiorysta z `/consultations` na `/dashboard`
- `src/pages/api/auth/signin.ts:19` — po zalogowaniu redirect na `/`
- `src/lib/supabase.ts:6-21` — klient ciasteczkowy; brak sekretów zwraca `null`
- `supabase/migrations/20261001182110_client_survey_and_slot.sql:45-83` — kształt `consultations` i RLS własnego wiersza
- `supabase/migrations/20261001182110_client_survey_and_slot.sql:111-127` — RPC samych godzin startu
- `src/lib/slots.ts:1-7` — siatka slotów, której koniec nie jest kolumną
- `src/pages/dashboard.astro:6-16` — powłoka z e-mailem, bez zgłoszeń
- `src/pages/consultations/index.astro:28-94` — lista klienta, pięć kolumn, bez linku do szczegółów
- `src/components/dashboard/DashboardCard.tsx:8-16` — angielski tekst karty

## Architecture Insights

Widok behawiorysty czyta ten sam wiersz, który klient już zapisuje. Brakuje ścieżki odczytu dla roli `behaviorist` i trzech powierzchni: kalendarza, listy i szczegółów.

`/dashboard` jest dziś stroną po odrzuceniu behawiorysty z tras klienta, nie stroną po `POST` logowania. Logowanie kończy się na `/` (`src/pages/api/auth/signin.ts:19`). Plan S-01 świadomie nie zmienia tego redirectu (`context/archive/2026-10-01-client-survey-and-slot/plan.md:40`).

Izolacja klientów zostaje przy polityce `client_id = auth.uid()`. Odczyt behawiorysty jest osobną polityką do dopisania; `taken_slot_starts` nie zastępuje szczegółów, bo zwraca same timestampy.

## Historical Context (from prior changes)

Każde zdanie osobno, względem kodu przeczytanego w tym badaniu.

- **Wspierane.** Plan S-01: „Behawiorysta nie dostaje w tym plasterku żadnej polityki odczytu konsultacji” oraz UI kalendarza, listy i szczegółów jest poza zakresem (`context/archive/2026-10-01-client-survey-and-slot/plan.md:34`). W jedynej migracji nie ma takiej polityki, a wśród 13 stron nie ma tych widoków.
- **Wspierane.** Ten sam plan: rola domyślna `client`, behawiorysta ręcznym `update`, `CLIENT_ROUTES` wyrzuca behawiorystę na `/dashboard`, rola `null` na `/` (`context/archive/2026-10-01-client-survey-and-slot/plan.md:18`, `context/archive/2026-10-01-client-survey-and-slot/plan.md:90`). Middleware i trigger zgadzają się z tym kontraktem.
- **Wspierane.** Decyzja granularności: starty 10:00–17:00, 60 min, pn–pt (`context/archive/2026-10-01-client-survey-and-slot/plan-brief.md:21`). `SLOT_STARTS` w `src/lib/slots.ts:5` to 10–17, `SLOT_MINUTES` to 60.
- **Częściowo wspierane.** Zdanie „pn–pt 10:00–18:00” w `context/archive/2026-10-01-client-survey-and-slot/plan-brief.md:15` pokrywa się z oknem, którego ostatni slot zaczyna się o 17:00 i trwa 60 min. Tabela decyzji w tym samym briefie (linia 21) mówi o startach 10:00–17:00 i zgadza się ze stałą w kodzie. Linia 15 nie jest osobną siatką slotów.
- **Sprzeczne z późniejszym kodem, jako migawka.** Baseline roadmapy z 2026-09-29: brak modelu dwóch ról i brak tabel domenowych (`context/foundation/roadmap.md:58-66`). Po S-01 role i `consultations` są w migracji. Reszta baseline (adapter Cloudflare, auth cookie) nie jest tym zdaniem unieważniona.
- **Sprzeczne z rozstrzygnięciem S-01.** Unknown S-01 „dzień vs slot godzinowy” nadal wisi w roadmapie (`context/foundation/roadmap.md:84-85`). Plan i `src/lib/slots.ts:5-6` mają slot godzinowy.
- **Częściowo wspierane.** Notatka `ui-tokens-onboarding` nazywa `/dashboard` „the screen after login” (`context/archive/2026-10-06-ui-tokens-onboarding/change.md:12`). `/dashboard` jest chronioną stroną po sesji. Udany `POST` logowania w `src/pages/api/auth/signin.ts:19` idzie na `/`, nie na `/dashboard`.

`context/foundation/lessons.md` nie występuje w `context/foundation/`.

## Related Research

- `context/archive/2026-10-06-ui-tokens-onboarding/research.md` — tokeny i `/dashboard` jako powłoka; nie bada odczytu zgłoszeń.
- Archiwum S-01 nie ma `research.md`. Kontrakt danych jest w `context/archive/2026-10-01-client-survey-and-slot/plan.md`.

## Open Questions

Brak dalszej luki w kodzie dla pytania badawczego. Do planu zostają wybory, których PRD nie rozstrzyga:

1. Kształt kalendarza (miesiąc, tydzień, agenda). PRD wymaga kalendarza i listy jako dwóch widoków najbliższych zdarzeń (`context/foundation/prd.md:78`), bez układu.
2. Czy FR-005 i FR-006 wchodzą na obecne `/dashboard`, czy na nowe trasy. Dziś `/dashboard` wpuszcza każdego zalogowanego (`src/middleware.ts:31-35`).
3. Tekst polityki `select` dla roli `behaviorist`. Brak polityki jest ustalony; treść nowej polityki nie jest zapisana w S-01.
4. E-mail klienta na szczegółach. FR-006 wymienia kompletną ankietę i pytanie otwarte (`context/foundation/prd.md:80`). Tych pól nie brakuje na `consultations`. E-maila klienta nie ma na `profiles` ani na wierszu zgłoszenia.

Akceptacja, odrzucenie i UI blokad zostają przy S-04 i S-03. Kolumna `status` i odczyt `availability_blocks` już są, więc lista może pokazać status bez zmieniania go.
