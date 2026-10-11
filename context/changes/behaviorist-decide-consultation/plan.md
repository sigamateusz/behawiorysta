# Akceptacja i odrzucenie konsultacji — plan implementacji

## Overview

Behawiorysta na szczegółach zgłoszenia w statusie `pending` akceptuje albo odrzuca konsultację. Zapis przechodzi tylko z `pending`. Odrzucone znika z jego panelu, a klient widzi nową etykietę na istniejącej liście `/consultations`.

## Current State Analysis

Statusy `pending`, `accepted` i `rejected` są w `public.consultations`. Nowe zgłoszenie ląduje jako `pending`. Granty to `select` i `insert`; polityki `UPDATE` nie ma, więc aplikacja nie potrafi zmienić statusu.

Behawiorysta czyta kalendarz i listę na `/dashboard` oraz ankietę na `/dashboard/[id]`. `visibleSubmissions` zostawia każde `pending` (także po końcu slotu) i `accepted` do końca slotu (`slot_start + 60 min`). `rejected` oraz zakończone `accepted` dają 404 na szczegółach i nie wchodzą na listę ani do siatki. Etykiety klienta na `/consultations` już obejmują trzy statusy: „Oczekuje na decyzję”, „Zaakceptowana”, „Odrzucona”.

Częściowy unikalny indeks `consultations_active_slot_uidx` obejmuje `slot_start` tylko przy `pending` i `accepted`. Odrzucenie zwalnia termin bez osobnego kasowania wiersza.

## Desired End State

Na `/dashboard/[id]` zgłoszenie `pending` ma przyciski „Akceptuj” i „Odrzuć”. Zapis ustawia `accepted` albo `rejected` i wraca na `/dashboard` z komunikatem. Przyszłe `accepted` zostaje w panelu bez przycisków. `rejected` oraz `accepted` po końcu slotu znikają z listy, siatki i szczegółów. Klient na `/consultations` widzi „Zaakceptowana” albo „Odrzucona”. Ten sam `slot_start` po odrzuceniu przyjmuje nowe zgłoszenie.

Przykład: Fafik jest `pending`, a jego godzina już minęła. Behawiorysta klika „Akceptuj”. Fafik znika z panelu, bo zakończone `accepted` jest niewidoczne, a klient widzi „Zaakceptowana”.

### Key Discoveries:

- Enum i domyślne `pending`: `supabase/migrations/20261001182110_client_survey_and_slot.sql:55`. Grant bez `update`: ten sam plik, linia 68.
- Indeks aktywnego slotu: `supabase/migrations/20261001182110_client_survey_and_slot.sql:62-63`.
- Odczyt behawiorysty wszystkich wierszy: `supabase/migrations/20261008150000_behaviorist_select_consultations.sql:2-10`. Filtr ekranu: `src/lib/behaviorist-submissions.ts:20-23`.
- Szczegóły bez przycisków, etykiety tylko `pending` i `accepted`: `src/pages/dashboard/[id].astro:7-14` i `77-84`.
- Lista klienta z trzema etykietami: `src/pages/consultations/index.astro:10-14`.
- Wzorzec formularza POST i przekierowania: `src/components/Topbar.astro:27-30`, `src/pages/api/auth/signout.ts:4-9`. JSON zostaje przy tworzeniu zgłoszenia (`src/pages/api/consultations/index.ts`), bo tam jest wyspa React.
- `/api` nie jest w `PROTECTED_ROUTES` (`src/middleware.ts:5`). Handler sam sprawdza sesję, jak `requireClientApi` w `src/lib/consultation-api.ts:14-25`.
- S-02 zostawiło filtr w aplikacji, żeby ten plasterek nie potrzebował nowej polityki `select`, gdy odrzucone miałyby wrócić. Ta decyzja produktowa ich nie przywraca.

## What We're NOT Doing

- Maile przy akceptacji albo odrzuceniu.
- Kolumna albo pole z uzasadnieniem odmowy.
- Przejście z `accepted` albo `rejected` z powrotem na inny status. Po zapisie przycisków nie ma.
- Archiwum odrzuconych i odbytych wizyt. `visibleSubmissions` zostaje bez zmiany.
- Przyciski na liście i w siatce kalendarza.
- Anulowanie albo edycja zgłoszenia przez klienta.
- UI blokad dni (S-03) i kasowanie zgłoszeń, gdy dzień zostanie później zablokowany.
- Podsumowanie AI, wielu behawiorystów, paginacja.
- Wymiana klas palety na liście klienta (`text-amber-200` i sąsiednie).

## Implementation Approach

Jedna nowa migracja daje behawioryście `UPDATE` wyłącznie kolumny `status`, i tylko ze starego `pending` na nowe `accepted` albo `rejected`. Endpoint formularza na szczegółach wykonuje ten zapis i zawsze wraca na `/dashboard` z parametrem `decided`. Strona pulpitu pokazuje polski komunikat. Lista klienta nie dostaje nowego widoku: po odświeżeniu czyta już zapisany status.

Przyciski są formularzem Astro z istniejącym `Button`, tak jak wylogowanie. Osobna wyspa React nie jest potrzebna. Reguła „tylko z pending” siedzi w RLS, nie tylko w warunku na stronie, bo `/api` da się wywołać z pominięciem widoku.

## Critical Implementation Details

- **USING to stary wiersz, WITH CHECK to nowy.** `USING` wymaga `status = 'pending'` i roli `behaviorist`. `WITH CHECK` wymaga `status in ('accepted', 'rejected')` i tej samej roli. Zamiana tych warunków sprawia, że zapis nie znajduje wiersza albo baza go odrzuca.
- **Sukces to zwrócone id, nie sam brak błędu klienta Supabase.** Aktualizacja z filtrem `id` i `status = 'pending'` oraz `.select("id")` kończy się sukcesem tylko wtedy, gdy wraca ten id. Zero wierszy to `/dashboard?decided=unavailable`, także gdy wiersz już nie jest `pending`.
- **Po zapisie zawsze `/dashboard`, nie z powrotem na szczegóły.** `rejected` oraz `accepted` po końcu slotu wypadają z `visibleSubmissions`, więc powrót na `/dashboard/[id]` byłby 404. Komunikat na pulpicie jest śladem decyzji.
- **Komunikat jest nad gałęzią pustej listy.** Odrzucenie ostatniego widocznego zgłoszenia zostawia pusty stan. Baner `decided` renderuje się także wtedy, niezależnie od `?month=`. Linki zmiany miesiąca nie muszą zachowywać `decided`.
- **Odrzucenie zwalnia slot istniejącym indeksem.** Nie kasujemy wiersza i nie ruszamy `availability_blocks`. Zgłoszenie `pending` na dniu zablokowanym później nadal da się rozstrzygnąć.

## Phase 1: Reguła przejścia w bazie

### Overview

Baza przyjmuje od behawiorysty dokładnie jedno przejście: `pending` → `accepted` albo `pending` → `rejected`. Inne role i inne kolumny zostają bez zapisu.

### Changes Required:

#### 1. Migracja polityki decyzji

**File**: `supabase/migrations/<timestamp>_behaviorist_decide_consultation.sql` (timestamp po `20261008150000`)

**Intent**: Dodać grant i politykę `UPDATE`, żeby behawiorysta mógł zmienić wyłącznie status oczekującego zgłoszenia. Reszta ankiety zostaje nie do ruszenia z poziomu roli `authenticated`.

**Contract**: `grant update (status) on public.consultations to authenticated`. Nowa polityka `consultations_update_behaviorist_decision` dla `update` do `authenticated`. `USING`: stary `status = 'pending'` i profil `auth.uid()` ma rolę `behaviorist`. `WITH CHECK`: nowy `status in ('accepted', 'rejected')` i ten sam warunek roli. Bez polityki `delete`. Istniejące polityki `select` i `insert` oraz indeks slotu bez zmian. Typy w `src/db/database.types.ts` zostają: kolumna `status` już tam jest.

```sql
grant update (status) on public.consultations to authenticated;
-- USING (stary wiersz): status = 'pending' oraz rola behaviorist
-- WITH CHECK (nowy wiersz): status in ('accepted', 'rejected') oraz rola behaviorist
```

### Success Criteria:

#### Automated Verification:

- Nowa migracja nakłada się przy `npx supabase db reset` (kod 0)
- `npm run lint` przechodzi

#### Manual Verification:

- Behawiorysta aktualizuje wiersz `pending` na `accepted` oraz inny wiersz `pending` na `rejected`
- Ponowny zapis, zapis klienta i zmiana kolumny ankiety są odrzucone

**Implementation Note**: Po zielonym sprawdzeniu automatycznym zatrzymaj się na ręczne potwierdzenie polityki, zanim ruszysz endpoint. W tej fazie bloków nie ma checkboxów; odhaczanie jest w `## Progress`.

---

## Phase 2: Zapis decyzji

### Overview

Formularzowy POST behawiorysty wykonuje przejście z fazy 1 i przekierowuje na pulpit. Zła rola, brak sesji i drugi zapis nie zmieniają wiersza.

### Changes Required:

#### 1. Parser wartości decyzji

**File**: `src/lib/consultation-decision.ts`

**Intent**: Zostawić w jednym miejscu dozwolone wartości przycisków, żeby handler i test mówiły to samo.

**Contract**: `parseDecision(raw: string): "accepted" | "rejected" | null`. Dokładnie te dwa stringi. Pusty string i każda inna wartość dają `null`.

**File**: `src/lib/consultation-decision.test.ts`

**Intent**: Pokryć cztery wejścia parsera testem Vitest, tak jak czyste funkcje w `src/lib/behaviorist-submissions.test.ts`.

**Contract**: Przypadki `accepted`, `rejected`, `""` i obca wartość (na przykład `pending`).

#### 2. Wejście roli dla formularza

**File**: `src/lib/consultation-api.ts`

**Intent**: Osobna bramka dla POST-a, który odpowiada przekierowaniem, a nie JSON-em jak tworzenie zgłoszenia.

**Contract**: Funkcja zwraca klienta Supabase albo `Response` z przekierowaniem. Brak konfiguracji Supabase → `/dashboard?decided=error`. Brak `context.locals.user` → `/auth/signin`. Rola inna niż `behaviorist` → wynik `dashboardRedirect` z `src/lib/role-routes.ts` (`/consultations` dla klienta, `/` dla `null`).

#### 3. Endpoint decyzji

**File**: `src/pages/api/consultations/[id]/decision.ts`

**Intent**: Przyjąć formularz ze szczegółów, zapisać jeden dozwolony status i odesłać behawiorystę na pulpit z parametrem, który faza 3 zamieni na komunikat.

**Contract**: Eksport `POST`. `id` z parametru trasy. Pole formularza `decision` przez `readFormString`. `parseDecision` daje `null` → `/dashboard?decided=unavailable`. Inaczej `update` samego `{ status }` z filtrem `id` oraz `status = 'pending'` i `.select("id")`. Wrócone id → `/dashboard?decided=accepted` albo `/dashboard?decided=rejected` zgodnie z zapisem. Zero wierszy i brak błędu → `/dashboard?decided=unavailable`. Błąd klienta Supabase → `/dashboard?decided=error`. Treści banerów dodaje faza 3; tu liczy się `Location`.

### Success Criteria:

#### Automated Verification:

- `npm run test` przechodzi, w tym `parseDecision` dla `accepted`, `rejected`, pustego stringa i obcej wartości
- `npm run lint` przechodzi

#### Manual Verification:

- POST bez sesji przekierowuje na `/auth/signin` i nie zmienia statusu
- POST klienta przekierowuje na `/consultations` i nie zmienia statusu
- POST behawiorysty `accepted` na `pending` przekierowuje na `/dashboard?decided=accepted`, a lista klienta pokazuje „Zaakceptowana”
- Drugi POST na to samo id przekierowuje na `/dashboard?decided=unavailable` i status zostaje `accepted`
- POST `rejected` na innym `pending` przekierowuje na `/dashboard?decided=rejected`, klient widzi „Odrzucona”, a ten sam `slot_start` przyjmuje nowe zgłoszenie

**Implementation Note**: Po zielonym sprawdzeniu automatycznym zatrzymaj się na ręczne potwierdzenie przekierowań i etykiety klienta, zanim dodasz przyciski.

---

## Phase 3: Panel decyzji

### Overview

Oczekujące szczegóły dostają dwa przyciski. Pulpit pokazuje polski wynik zapisu. Filtr widoczności i lista klienta zostają przy obecnych regułach.

### Changes Required:

#### 1. Przyciski na szczegółach

**File**: `src/pages/dashboard/[id].astro`

**Intent**: Decyzja zapada po przeczytaniu ankiety, tylko gdy wiersz nadal jest `pending`, także gdy slot już trwa albo minął.

**Contract**: Gdy `submission.status === "pending"`, jeden formularz `method="POST"` `action={/api/consultations/${id}/decision}`. Dwa `Button` z `type="submit"`, `name="decision"`, `client:load`: „Akceptuj” (`value="accepted"`, wariant `default`) i „Odrzuć” (`value="rejected"`, wariant `destructive`). Przy `accepted` przycisków nie ma; zostaje etykieta „Zaakceptowana” i link powrotu. Klasy spoza tokenów (`border-border`, `bg-card`, `text-primary`, `text-muted-foreground` i warianty `Button`) — bez nowych klas palety i bez wartości w nawiasach kwadratowych. `visibleSubmissions` i zestaw kolumn bez zmian.

#### 2. Komunikat na pulpicie

**File**: `src/pages/dashboard.astro`

**Intent**: Po przekierowaniu behawiorysta widzi, co się stało, także gdy zgłoszenie właśnie zniknęło z listy.

**Contract**: Odczyt `decided` z query. Baner pod nagłówkiem „Zgłoszenia”, przed gałęzią błędu i pustej listy, tymi samymi klasami karty co „Nie ma zgłoszeń do pokazania”. Mapa: `accepted` → „Konsultacja została zaakceptowana.” (`role="status"`); `rejected` → „Konsultacja została odrzucona.” (`role="status"`); `unavailable` → „To zgłoszenie zostało już rozstrzygnięte albo jest niedostępne.” (`role="alert"`); `error` → „Nie udało się zapisać decyzji.” (`role="alert"`). Inna wartość `decided` nie renderuje banera. Lista, siatka i `STATUS_LABELS` bez nowej etykiety `rejected`.

### Success Criteria:

#### Automated Verification:

- `npm run lint` przechodzi
- `npm run test` przechodzi

#### Manual Verification:

- Szczegóły `pending` mają „Akceptuj” i „Odrzuć”; szczegóły przyszłego `accepted` nie mają tych przycisków
- Po odrzuceniu widać „Konsultacja została odrzucona.”, a wiersza nie ma na liście, w siatce ani pod starym adresem (404)
- Zaległe `pending` ma oba przyciski; po akceptacji karta znika z panelu, komunikat to „Konsultacja została zaakceptowana.”, a klient widzi „Zaakceptowana”
- Komunikat decyzji widać także wtedy, gdy lista po zapisie jest pusta

**Implementation Note**: Po zielonym sprawdzeniu automatycznym zatrzymaj się na przejście ręczne w przeglądarce: oczekujące, przyszłe zaakceptowane, zaległe oczekujące i pusta lista po ostatniej odmowie.

---

## Testing Strategy

### Unit Tests:

- `parseDecision` dla `accepted`, `rejected`, `""` i obcej wartości.
- Istniejące testy `visibleSubmissions` zostają zielone i bez nowej gałęzi dla `rejected`. Odrzucone ma nadal wypadać ze zbioru.

### Integration Tests:

- Brak nowego kroku w `scripts/smoke.mjs`. Smoke zostaje przy auth. Przejście statusu sprawdza ręczne POST z sesją oraz `npx supabase db reset` dla migracji.

### Manual Testing Steps:

1. Zaloguj behawiorystę, otwórz szczegóły przyszłego `pending`, kliknij „Akceptuj”. Pulpit pokazuje „Konsultacja została zaakceptowana.”, wiersz zostaje w panelu bez przycisków, klient widzi „Zaakceptowana”.
2. Otwórz inne `pending`, kliknij „Odrzuć”. Baner „Konsultacja została odrzucona.”, stary URL szczegółów to 404 bez pól ankiety, klient widzi „Odrzucona”, a nowy klient rezerwuje ten sam slot.
3. Weź `pending` z godziną, która już minęła (takie wiersze zostają na kalendarzu). „Akceptuj” zdejmuje kartę z panelu i ustawia u klienta „Zaakceptowana”.
4. Odśwież pulpit z `?decided=accepted` gdy nie ma żadnego widocznego zgłoszenia. Baner i pusty stan „Nie ma zgłoszeń do pokazania.” są razem.
5. Powtórz POST decyzji na id, które jest już `accepted`. Baner niedostępności, status bez zmian.

## Performance Considerations

Jeden `UPDATE` po kluczu głównym. Bez nowego indeksu i bez listy archiwum. Zbiór na pulpicie czyta się tak samo jak dziś.

## Migration Notes

Istniejące wiersze `pending` stają się rozstrzygalne od razu po migracji. `accepted` i `rejected` nie wymagają uzupełniania. `npx supabase db reset` nakłada migrację od zera i czyści lokalne dane. Na już działającym stosie wystarczy nałożenie oczekujących migracji, bez resetu, jeśli lokalne zgłoszenia mają zostać.

Równoległy S-03 (`behaviorist-block-days`) może edytować `src/pages/dashboard.astro`. Ta zmiana dokłada tam tylko baner `decided` i nie zmienia siatki ani `availability_blocks`.

## References

- Roadmapa S-04: `context/foundation/roadmap.md`
- FR-008 i brak maili: `context/foundation/prd.md`
- Model statusu i indeks slotu: `context/archive/2026-10-01-client-survey-and-slot/plan.md`
- Filtr widoczności i odłożone przyciski: `context/archive/2026-10-08-behaviorist-submission-views/plan.md`
- Podobny zapis formularzem: `src/pages/api/auth/signout.ts`, `src/components/Topbar.astro`
- Podobna bramka API: `src/lib/consultation-api.ts`, `src/pages/api/consultations/index.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Reguła przejścia w bazie

#### Automated

- [x] 1.1 Nowa migracja nakłada się przy `npx supabase db reset` (kod 0) — e9f0276
- [x] 1.2 `npm run lint` przechodzi — e9f0276

#### Manual

- [x] 1.3 Behawiorysta aktualizuje wiersz `pending` na `accepted` oraz inny wiersz `pending` na `rejected` — e9f0276
- [x] 1.4 Ponowny zapis, zapis klienta i zmiana kolumny ankiety są odrzucone — e9f0276

### Phase 2: Zapis decyzji

#### Automated

- [x] 2.1 `npm run test` przechodzi, w tym `parseDecision` dla `accepted`, `rejected`, pustego stringa i obcej wartości — bb91ac1
- [x] 2.2 `npm run lint` przechodzi — bb91ac1

#### Manual

- [x] 2.3 POST bez sesji przekierowuje na `/auth/signin` i nie zmienia statusu — bb91ac1
- [x] 2.4 POST klienta przekierowuje na `/consultations` i nie zmienia statusu — bb91ac1
- [x] 2.5 POST behawiorysty `accepted` na `pending` przekierowuje na `/dashboard?decided=accepted`, a lista klienta pokazuje „Zaakceptowana” — bb91ac1
- [x] 2.6 Drugi POST na to samo id przekierowuje na `/dashboard?decided=unavailable` i status zostaje `accepted` — bb91ac1
- [x] 2.7 POST `rejected` na innym `pending` przekierowuje na `/dashboard?decided=rejected`, klient widzi „Odrzucona”, a ten sam `slot_start` przyjmuje nowe zgłoszenie — bb91ac1

### Phase 3: Panel decyzji

#### Automated

- [x] 3.1 `npm run lint` przechodzi
- [x] 3.2 `npm run test` przechodzi

#### Manual

- [x] 3.3 Szczegóły `pending` mają „Akceptuj” i „Odrzuć”; szczegóły przyszłego `accepted` nie mają tych przycisków
- [x] 3.4 Po odrzuceniu widać „Konsultacja została odrzucona.”, a wiersza nie ma na liście, w siatce ani pod starym adresem (404)
- [x] 3.5 Zaległe `pending` ma oba przyciski; po akceptacji karta znika z panelu, komunikat to „Konsultacja została zaakceptowana.”, a klient widzi „Zaakceptowana”
- [x] 3.6 Komunikat decyzji widać także wtedy, gdy lista po zapisie jest pusta
