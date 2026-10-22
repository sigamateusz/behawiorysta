# Report auth outage — Implementation Plan

## Overview

Awaria GoTrue albo odczytu `profiles` ma przestać wyglądać jak brak logowania. Każde takie żądanie zwraca 503 i zostawia w logu pola diagnostyczne, bez e-maila. Zwykły brak sesji nadal otwiera formularz logowania.

## Current State Analysis

`src/middleware.ts:19-26` woła `getUser()` i `profiles`, a potem zostawia tylko `user` i `role`. Błąd z obu wywołań jest odrzucany. Brak użytkownika na `/dashboard` i `/consultations` robi 302 na `/auth/signin` (`src/middleware.ts:32-34`). Brak roli na `/dashboard` idzie na `/` przez `dashboardRedirect` (`src/lib/role-routes.ts:8`). `/api/*` nie jest na liście chronionych tras (`src/middleware.ts:5-6`), więc te endpointy dostają 401 albo 403 z `src/lib/consultation-api.ts:20-24` i `:49-53`.

`@supabase/auth-js` nie rzuca przy awarii sieci ani przy HTTP 5xx. Zwraca `AuthRetryableFetchError` w `{ error }` (`node_modules/@supabase/auth-js/dist/module/lib/fetch.js:115-120` i `:41-43`). Zwykły brak sesji to `AuthSessionMissingError` i ten sam kształt `{ user: null, error }` (`GoTrueClient.js:2706-2723`). Inny błąd auth, na przykład 401 przy złym tokenie, też wraca w `{ error }` i nie jest awarią sieci.

`POST /api/auth/signin` po udanym haśle czyta profil i ignoruje `profileError`: rola zostaje pusta, a handler i tak robi `redirectAfterSignIn` (`src/pages/api/auth/signin.ts:23-35`). Brak wiersza przy `error === null` i błąd zapytania kończą się tak samo, na `/` (`src/lib/role-routes.ts:18`). Formularz to zwykły `POST` (`src/components/auth/SignInForm.tsx:43`), więc przeglądarka oczekuje dokumentu.

W tym commicie nie ma Sentry ani loggera aplikacji. `wrangler.jsonc:12-14` ma `observability.enabled`. Vitest obejmuje `src/**/*.test.ts`. Plan testów zabrania mockowania sesji w smoke i Playwrightu (`context/foundation/test-plan.md:92` i `:142`). Middleware nie ma własnego testu. `src/lib/role-routes.test.ts:13-14` sprawdza tylko, że brak roli to `/`.

## Desired End State

Przy awarii (sieć, HTTP 5xx z auth, albo dowolny `error` z zapytania `profiles`) odpowiedź ma status 503. Treść to jedno stałe zdanie: „Usługa jest chwilowo niedostępna. Spróbuj ponownie.” Gdy `Accept` zawiera `text/html`, ciało jest dokumentem HTML. W pozostałych żądaniach jest JSON `{ error: "<to samo zdanie>" }`. W logu jest jeden `console.error` z polami `name`, `status`, `code`, `pathname` i `userId`. Nie ma w nim e-maila, ciasteczka ani `error.message`.

`AuthSessionMissingError` i inny błąd auth, który nie jest awarią, zostawiają dzisiejsze przekierowania. Brak wiersza profilu przy `error === null` zostaje brakiem roli. Anonim na `/dashboard` nadal widzi formularz logowania. Złe hasło nadal wraca na formularz z komunikatem dostawcy.

### Key Discoveries:

- Awaria auth nie rzuca wyjątku, więc sam `try/catch` wokół `next()` jej nie zobaczy (`GoTrueClient.js:2716-2723`).
- Formularz logowania wysyła dokument (`SignInForm.tsx:43`). `fetch` z ankiety nie prosi o `text/html`. Rodzaj ciała 503 wynika z `Accept`, nie ze ścieżki `/api`.
- `signInWithPassword` zapisuje ciasteczka zanim handler czyta profil. 503 po błędzie profilu nie może czyścić tej sesji.
- Test regresji należy do Vitest przy czystej funkcji w `src/lib/`. Smoke i Playwright zostają przy prawdziwej sesji.

## What We're NOT Doing

- Sentry, DSN i `@sentry/cloudflare`.
- Traktowania braku zmiennych `SUPABASE_URL` / `SUPABASE_KEY` jako awarii. Baner z `src/lib/config-status.ts` zostaje.
- Zmiany ścieżki złego hasła, walidacji formularza i `signInWithPassword`, gdy to wywołanie samo zwróci błąd.
- Zgłaszania `AuthSessionMissingError` i innych błędów auth poza awarią sieci i HTTP 5xx.
- Nowego speca Playwright albo przypadku smoke, który udaje padnięte GoTrue.
- Poprawek z audytu poza tą regułą: banery 200 na kalendarzu, `?decided=error`, `block_error` i obcinanie `cause` w `jsonError`.

## Implementation Approach

Jedna funkcja w `src/lib/session-gate.ts` klasyfikuje wynik auth i profilu. Vitest sprawdza ją bez Astro i bez klienta Supabase. Middleware woła ją na każdym żądaniu i przy awarii zwraca 503 przed `next()`. Logowanie po udanym haśle używa tej samej funkcji dla błędu profilu.

## Critical Implementation Details

- Kolejność w klasyfikatorze: najpierw awaria auth, potem brak `userId` jako anonim, potem błąd profilu, potem rola, na końcu brak roli. Odwrócenie tej kolejności znowu zamieni awarię w anonima.
- Awaria auth to `name === "AuthRetryableFetchError"` albo `status === 0` albo `status >= 500`. Błąd 401 zostaje anonimem i nie trafia do logu.
- Do klasyfikatora nie wchodzi `error.message`. Log woła tylko pola zwrócone przez klasyfikator plus `pathname` i `userId`.
- 503 po udanym haśle zostawia ciasteczka sesji. Następne żądanie znowu przejdzie przez middleware.

## Phase 1: Klasyfikacja sesji

### Overview

Czysta funkcja rozróżnia brak sesji, brak roli, gotową rolę i awarię. Żadne żądanie HTTP jeszcze się nie zmienia.

### Changes Required:

#### 1. Klasyfikator sesji

**File**: `src/lib/session-gate.ts`

**Intent**: Jedno miejsce na regułę „awaria kontra brak sesji”, żeby middleware i logowanie nie rozjechały się w warunkach.

**Contract**: Eksport `classifySession`. Wejście: `authError` z polami `name`, `status`, `code` albo `null`; `userId` albo `null`; `profileError` z polem `code` albo `null`; `role` równe `"client"`, `"behaviorist"` albo `null`. Wynik:

```ts
type SessionClass =
  | { kind: "anonymous" }
  | { kind: "missing-role" }
  | { kind: "ready"; role: "client" | "behaviorist" }
  | { kind: "outage"; name: string; status: number | null; code: string | null };
```

Awaria auth daje `kind: "outage"` z polami tego błędu. Brak `userId` po tym sprawdzeniu daje `anonymous`. Każdy `profileError` daje `outage` z `name: "profile"`, `status: null` i `code` z PostgREST. Rola `client` albo `behaviorist` daje `ready`. Inaczej `missing-role`.

#### 2. Testy klasyfikatora

**File**: `src/lib/session-gate.test.ts`

**Intent**: Regresja ma paść w `npm test`, zanim middleware zacznie zwracać inny status.

**Contract**: Przypadki: `AuthSessionMissingError` i brak `userId` → `anonymous`; `AuthRetryableFetchError` ze statusem 0 i ze statusem 503 → `outage`; inny błąd auth ze statusem 401 i brakiem `userId` → `anonymous`; `userId` ustawione i `profileError` → `outage` z `name: "profile"`; `userId` i `profileError === null` i `role === null` → `missing-role`; rola `client` oraz `behaviorist` → `ready`.

### Success Criteria:

#### Automated Verification:

- `npm test` przechodzi i obejmuje brak sesji, AuthRetryableFetchError, inny błąd auth, błąd profilu, brak roli i gotową rolę
- `npm run lint` przechodzi

**Implementation Note**: Po zielonym `npm test` i `npm run lint` można przejść do fazy 2. Ta faza nie ma kroku ręcznego.

---

## Phase 2: Middleware

### Overview

Każde żądanie z wynikiem `outage` kończy się 503 i jednym wpisem w logu. Anonim i brak roli zostają przy dotychczasowych przekierowaniach.

### Changes Required:

#### 1. Odpowiedź 503

**File**: `src/lib/session-gate.ts`

**Intent**: Formularz logowania i zwykła nawigacja dostają dokument, a `fetch` z API dostaje JSON o tym samym zdaniu.

**Contract**: Eksport stałej treści „Usługa jest chwilowo niedostępna. Spróbuj ponownie.” i funkcji, która z nagłówka `Accept` buduje `Response` 503. Gdy `Accept` zawiera `text/html`, ciało jest dokumentem HTML z tym zdaniem. W przeciwnym razie ciało to JSON `{ error: "<to samo zdanie>" }`. Test w `src/lib/session-gate.test.ts` sprawdza oba warianty i status.

#### 2. Middleware

**File**: `src/middleware.ts`

**Intent**: Awaria przestaje ustawiać pustego użytkownika i puszczać żądanie dalej.

**Contract**: Po `getUser` i ewentualnym odczycie profilu middleware woła `classifySession`. Przy `outage` robi `console.error("auth outage", { name, status, code, pathname, userId })` i zwraca odpowiedź 503 bez `next()`. `userId` pochodzi z użytkownika, gdy jest; przy awarii samego `getUser` jest `null`. `anonymous` i `missing-role` oraz `ready` zachowują dzisiejsze przypisanie `locals` i dzisiejsze przekierowania. `createClient` zwracający `null` nie wchodzi do klasyfikatora.

### Success Criteria:

#### Automated Verification:

- `npm test` przechodzi i obejmuje 503 HTML oraz 503 JSON
- `npm run lint` przechodzi
- `npx playwright test --project=preview` przechodzi

#### Manual Verification:

- Wejście anonima na `/dashboard` nadal otwiera formularz logowania
- Zalogowany behawiorysta nadal otwiera `/dashboard`

**Implementation Note**: Po zielonych testach zatrzymaj się na ręczne sprawdzenie obu wejść, zanim ruszysz logowanie.

---

## Phase 3: Logowanie

### Overview

Udane hasło i błąd odczytu profilu zwracają 503 tą samą regułą. Brak wiersza profilu nadal prowadzi na `/`.

### Changes Required:

#### 1. POST logowania

**File**: `src/pages/api/auth/signin.ts`

**Intent**: Martwa tabela `profiles` po poprawnym haśle nie może wyglądać jak zakończone logowanie na stronie głównej.

**Contract**: Gdy `signInWithPassword` zwróci błąd, zostaje dzisiejsze przekierowanie z `error.message`. Gdy hasło się uda, handler woła `classifySession` z `authError: null`, `userId` z sesji, wynikiem profilu i rolą odczytaną tylko przy braku `profileError`. Wynik `outage` loguje te same pola co middleware (`pathname` to ścieżka tego POST) i zwraca tę samą odpowiedź 503, bez czyszczenia ciasteczek. Wynik `missing-role` albo `ready` nadal woła `redirectAfterSignIn`.

### Success Criteria:

#### Automated Verification:

- `npm test` przechodzi
- `npm run lint` przechodzi
- `npx playwright test --project=preview` przechodzi

#### Manual Verification:

- Złe hasło nadal wraca do formularza logowania z komunikatem dostawcy
- Konto bez wiersza profilu nadal ląduje na `/`

**Implementation Note**: Po zielonych testach sprawdź oba przypadki ręczne. Ścieżki 503 z fazy 2 i 3 są pokryte testem jednostkowym; lokalnie nie trzeba gasić GoTrue.

---

## Testing Strategy

### Unit Tests:

- `src/lib/session-gate.test.ts` pokrywa sześć wyników klasyfikatora i oba ciała 503.
- Brak mocka klienta Supabase i brak odpalania middleware Astro w Vitest.

### Integration Tests:

- Smoke zostaje bez nowego przypadku. Nie udajemy awarii bazy.
- `npx playwright test --project=preview` jest bramką regresji ekranu po zalogowaniu i przekierowania anonima. Nie dochodzi spec awarii.

### Manual Testing Steps:

1. Bez ciasteczka otwórz `/dashboard` i sprawdź, że widać formularz logowania.
2. Zaloguj behawiorystę i sprawdź, że `/dashboard` się otwiera.
3. Podaj złe hasło i sprawdź, że formularz pokazuje komunikat, a adres ma `?error=`.
4. Na koncie bez wiersza w `profiles` zaloguj się i sprawdź, że lądujesz na `/`.

## Performance Considerations

Każde żądanie i tak woła `getUser` i, przy użytkowniku, jedno zapytanie o rolę. Dochodzi tylko gałąź w pamięci i przy awarii budowa jednej odpowiedzi. Osobnego zapytania nie ma.

## Migration Notes

Brak migracji i brak zmiany danych. Sesje zapisane przed tą zmianą działają dalej. 503 po udanym haśle nie unieważnia ciasteczka.

## References

- Audyt: `context/audits/observability/2026-10-23_sign-in-role-routing-client-survey-slot-behaviorist-decision-availability-blocks.md`
- `src/middleware.ts:19-34`
- `src/pages/api/auth/signin.ts:14-35`
- `src/lib/role-routes.ts:1-18`
- `context/foundation/test-plan.md` §4 i §6

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Klasyfikacja sesji

#### Automated

- [x] 1.1 `npm test` przechodzi i obejmuje brak sesji, AuthRetryableFetchError, inny błąd auth, błąd profilu, brak roli i gotową rolę
- [x] 1.2 `npm run lint` przechodzi

### Phase 2: Middleware

#### Automated

- [ ] 2.1 `npm test` przechodzi i obejmuje 503 HTML oraz 503 JSON
- [ ] 2.2 `npm run lint` przechodzi
- [ ] 2.3 `npx playwright test --project=preview` przechodzi

#### Manual

- [ ] 2.4 Wejście anonima na `/dashboard` nadal otwiera formularz logowania
- [ ] 2.5 Zalogowany behawiorysta nadal otwiera `/dashboard`

### Phase 3: Logowanie

#### Automated

- [ ] 3.1 `npm test` przechodzi
- [ ] 3.2 `npm run lint` przechodzi
- [ ] 3.3 `npx playwright test --project=preview` przechodzi

#### Manual

- [ ] 3.4 Złe hasło nadal wraca do formularza logowania z komunikatem dostawcy
- [ ] 3.5 Konto bez wiersza profilu nadal ląduje na `/`
