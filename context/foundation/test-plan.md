# Test Plan

> Phased test rollout for this project. Strategy is frozen at the top
> (§1–§5); cookbook patterns at the bottom (§6) fill in as phases ship.
> Read before writing any new test.
>
> Refresh: re-run `/10x-test-plan --refresh` when stale (see §8).
>
> Last updated: 2026-10-23

## 1. Strategy

Tests follow three non-negotiable principles for this project:

1. **Cost × signal.** The cheapest test that gives a real signal for the
   risk wins. Do not promote to e2e because e2e "feels safer." Do not put a
   vision model on top of a deterministic visual diff that already catches
   the regression.
2. **User concerns are first-class evidence.** Risks anchored in "<the
   team is worried about X, and the failure would surface somewhere in
   <area>>" carry the same weight as PRD lines or hot-spot data.
3. **Risks are scenarios, not code locations.** This plan documents _what
   could fail_ and _why we believe it's likely_ — drawn from documents,
   interview, and codebase _signal_ (churn, structure, test base). It does
   NOT claim to know which line owns the failure. That knowledge is
   produced by `/10x-research` during each rollout phase. If the plan and
   research disagree about where the failure lives, research is the
   ground truth.

Hot-spot scope used for likelihood weighting: `src`, `supabase/migrations`, `scripts` (21 commits / 30 days, ending 2026-10-15). Top directories: `src/lib` (25), `src/pages` (24), `src/components` (20), `scripts` (6), `supabase/migrations` (4).

## 2. Risk Map

The top failure scenarios this project must protect against, ordered by
risk = impact × likelihood. Risks are failure scenarios in user / business
terms, not test names. The Source column cites the _evidence that surfaced
this risk_ — never a specific file as "where the failure lives" (that is
research's job, see §1 principle #3).

| #   | Risk (failure scenario)                                                                                                  | Impact | Likelihood | Source (evidence — not anchor)                                                                                                    |
| --- | ------------------------------------------------------------------------------------------------------------------------ | ------ | ---------- | --------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Klient zapisuje konsultację na godzinę, którą behawiorysta właśnie zablokował, i oboje przychodzą na ten sam termin      | High   | High       | wywiad Q1; PRD, zablokowany dzień nie przyjmuje rezerwacji; archiwum S-03; hot-spot `src/lib` (25) i `src/pages/api` (9) / 30 dni |
| 2   | Wybrana godzina warszawska zapisuje się albo wyświetla o godzinę obok przy zmianie czasu, a testy slotów zostają zielone | High   | High       | wywiad Q2 (incydent); archiwum S-01, granica czasu lokalnego                                                                      |
| 3   | Po zalogowaniu klient lokalnie trafia na ankietę, a po wdrożeniu ląduje na złym ekranie                                  | High   | High       | wywiad Q3; PRD FR-001, FR-002; hot-spot `src/pages` (24) i `src/components/auth` (7) / 30 dni                                     |
| 4   | Klient czyta albo zmienia zgłoszenie innego klienta poza jednym przypadkiem ze smoke                                     | High   | Medium     | wywiad Q4; PRD, klient nie widzi cudzych zgłoszeń; abuse: właściciel zasobu, nie samo zalogowanie                                 |
| 5   | Dwóch klientów dostaje ten sam wolny termin i oba zapisy się udają                                                       | High   | Medium     | archiwum S-01, wyścig zapisu; smoke ma jeden przypadek konfliktu                                                                  |
| 6   | Niepełna ankieta i tak tworzy konsultację                                                                                | Medium | Medium     | PRD, termin dopiero po kompletnej ankiecie; smoke ma jeden przypadek odrzucenia niepełnej ankiety                                 |

Poza top 6, bez osobnej fazy: wyciek klucza (brak śladu), maile i podsumowanie AI (poza v1), widoczność decyzji akceptacji (wdrożone, wywiad tego nie wskazuje). Q1 i Q3 przyjęły zdania z przykładów wywiadu — to strach, nie raport incydentu. Q2 jest incydentem.

### Risk Response Guidance

| Risk | What would prove protection                                                                                                                                     | Must challenge                                                           | Context `/10x-research` must ground                                            | Likely cheapest layer                          | Anti-pattern to avoid                                        |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------ | ---------------------------------------------- | ------------------------------------------------------------ |
| #1   | Po blokadzie dnia lub godziny zapis na ten termin się nie udaje i nie zostawia konsultacji, także gdy lista terminów była już otwarta                           | Ukrycie godziny na liście oznacza, że zapis też ją odrzuca               | Jak blokada jest utrwalona i czy zapis sprawdza ją ponownie                    | Integracja HTTP z sesją i bazą                 | Kolejny test czystego filtra listy                           |
| #2   | Godzina wybrana w Europe/Warsaw po obu stronach zmiany czasu 2026-10-25 jest tą samą godziną w zapisie i na ekranie                                             | Zielony test przeliczenia dowodzi, że utrwalony instant jest dobry       | Gdzie godzina lokalna staje się instantem i skąd bierze się godzina na ekranie | Asercja instantu wobec niezależnego UTC        | Wyrocznia przepisana z kodu; tylko jedna strona zmiany czasu |
| #3   | Sesja klienta ląduje na liście `/consultations` („Moje zgłoszenia”), a sesja behawiorysty w kalendarzu (`/dashboard`, „Poprzedni miesiąc”), na runtime podglądu | Test tablicy tras w pamięci opisuje przekierowanie po wdrożeniu          | Rola w sesji i różnica między serwerem deweloperskim a podglądem               | e2e Playwright na podglądzie (build + preview) | Mock sesji, którego deploy nie używa                         |
| #4   | Klient A nie odczytuje ani nie zmienia zgłoszenia klienta B; behawiorysta swoje odczyty ma; anonim dostaje odmowę                                               | Jeden smoke listy pokrywa każdy odczyt i zapis                           | Które odczyty i zapisy istnieją i które wymagają właściciela                   | Dwa konta HTTP, jak obecny smoke               | Samo „zalogowany” jako warunek dostępu                       |
| #5   | Drugi zapis tego samego wolnego terminu się nie udaje i nie tworzy drugiej konsultacji                                                                          | Jeden konflikt na identycznym żądaniu pokrywa każdy stan zajęcia terminu | Które stany konsultacji zajmują termin                                         | Ten sam zapis HTTP co #1                       | Sam kod statusu, bez sprawdzenia braku drugiego wiersza      |
| #6   | Brak wymaganego pola ankiety nie tworzy konsultacji, nawet gdy klient pominie formularz                                                                         | Jedno odrzucenie pustej ankiety oznacza, że serwer sprawdza każde pole   | Które pola są wymagane i gdzie serwer je sprawdza                              | Ten sam zapis HTTP co #1                       | Asercja tylko walidacji w przeglądarce                       |

## 3. Phased Rollout

Each row is a discrete rollout phase that will open its own change folder
via `/10x-new`. Status moves left-to-right through the values below; the
orchestrator updates Status as artifacts appear on disk.

| #   | Phase name                            | Goal (one line)                                                                       | Risks covered | Test types                     | Status        | Change folder                  |
| --- | ------------------------------------- | ------------------------------------------------------------------------------------- | ------------- | ------------------------------ | ------------- | ------------------------------ |
| 1   | Zapis niedostępnego terminu           | Niedozwolony termin i niepełna ankieta nie zostawiają konsultacji                     | #1, #5, #6    | integracja HTTP                | complete      | testing-unavailable-slot-write |
| 2   | Ekran po zalogowaniu na podglądzie    | Rola ląduje na swoim ekranie na runtime podglądu                                      | #3            | e2e Playwright                 | complete      | testing-post-login-screen      |
| 3   | Godzina warszawska przy zmianie czasu | Zapisany i pokazany instant zgadza się z niezależnym UTC po obu stronach zmiany czasu | #2            | asercja instantu + jeden zapis | change opened | testing-warsaw-clock-change    |
| 4   | Izolacja odczytów klienta             | Cudze zgłoszenie jest niedostępne na każdym odczycie i zapisie                        | #4            | HTTP, dwa konta                | not started   | —                              |

Kolejność: faza 1 jest najwyższym strachem i dwoma sąsiednimi zapisami, których zielone testy jednostkowe nie dowodzą. Faza 2 jest jedynym Playwrightem w tym rolloutcie — ekran po zalogowaniu, decyzja 2026-10-19; seed `auth-gate-redirect` tego nie pokrywa. Faza 3 jest osobno, bo incydent Q2 zdarzył się przy zielonych testach slotów. Faza 4 rozszerza istniejący smoke. Osobnej fazy bramek nie ma — CI już odpala `npm test` i smoke.

## 4. Stack

The classic test base for this project. AI-native tools (if any) carry a
`checked:` date so future readers can see which lines need re-verification.
Recommendations in this section must be grounded in local manifests/configs
plus the MCP/tools actually exposed in the current session. If a useful docs
or search MCP such as Context7 or Exa.ai is not available, say that instead
of assuming access.

Profil bazy: **sparse**. Vitest jest skonfigurowany; 6 plików testów, wszystkie w `src/lib`. Strony, endpointy i komponenty nie mają własnych testów.

| Layer            | Tool                       | Version | Notes                                                                                                                                |
| ---------------- | -------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| unit             | Vitest                     | 5.0.3   | `npm test`; include `src/**/*.test.ts`; `TZ=America/New_York`                                                                        |
| HTTP integration | `scripts/smoke.mjs`        | n/a     | Auth i rezerwacja na podglądzie; job `smoke` w CI podnosi lokalny Supabase                                                           |
| API mocking      | none                       | —       | Nie dodawać. Sygnał jest na prawdziwej sesji i bazie                                                                                 |
| e2e browser      | Playwright                 | 1.64.1  | Tylko #3, faza 2. Konfiguracja i seed (`auth-gate-redirect`) są w `context/foundation/test-stack.md`. Reszta ryzyk zostaje przy HTTP |
| accessibility    | none                       | —       | Brak sygnału w wywiadzie i PRD                                                                                                       |
| AI-native        | none — checked: 2026-10-15 | n/a     | Warstwa wizyjna nie dodaje sygnału ponad HTTP                                                                                        |

**Stack grounding tools (current session):**

- Docs: none — Context7 is not available in the current session; checked: 2026-10-15
- Search: WebSearch — official Astro testing guide still splits Vitest (unit) from Playwright (browser e2e), https://docs.astro.build/en/guides/testing/; checked: 2026-10-15
- Runtime/browser: cursor-ide-browser — available for manual checks, not used as a test layer; checked: 2026-10-15
- Provider/platform: none — no Supabase, Cloudflare, or GitHub MCP in this session; checked: 2026-10-15

## 5. Quality Gates

The full set of gates that must pass before a change reaches production.
"Required for §3 Phase <N>" means the gate is enforced once that rollout
phase lands; before that, the gate is `planned`.

| Gate                                    | Where                                       | Required? | Catches                                                                        |
| --------------------------------------- | ------------------------------------------- | --------- | ------------------------------------------------------------------------------ |
| lint + `astro check`                    | local + CI job `ci`                         | required  | Składnia, typy, kontrakt tokenów widoku                                        |
| `npm test`                              | local + CI job `ci`                         | required  | Regresje czystej logiki, w tym instant z fazy 3, gdy wyląduje jako test Vitest |
| `npm run smoke`                         | CI job `smoke` (podgląd + lokalny Supabase) | required  | Auth, rezerwacja, zapis z fazy 1 oraz izolacja z fazy 4, gdy wyląduje w smoke  |
| `npx playwright test --project=preview` | lokalnie i job CI `e2e`                     | required  | Ekran po zalogowaniu wg roli (#3)                                              |
| `npm run build`                         | CI job `ci`                                 | required  | Bundle produkcyjny się nie składa                                              |

Bramka Playwrighta jest required i odpala `npx playwright test --project=preview`. Fazy HTTP dokładają przypadki do bramek, które już są wymagane. Warstwy wizyjnej ani hooka po edycji nie ma.

## 6. Cookbook Patterns

How to add new tests in this project. Each sub-section is filled in once
the relevant rollout phase ships; before that, the sub-section reads
"TBD — see §3 Phase <N>."

### 6.1 Adding a unit test

- **Location**: `src/lib/`, obok logiki, plik `*.test.ts`.
- **Run locally**: `npm test`.
- **Wzorzec instantu**: oczekiwany UTC i tekst godziny są literałami w teście. `2026-10-23T08:00:00.000Z` oraz `2026-10-26T09:00:00.000Z` to 10:00. Zapis godziny 10:00 idzie przez `blockSelection` i te same dwa starty. Oczekiwanej wartości nie bierze się z wywołania funkcji pod testem.

### 6.2 Adding an integration test

- **Wzorzec**: zablokowany, zajęty albo niepełny zapis nie zostawia konsultacji. Wzorzec jest w `scripts/smoke.mjs`.
- **Mocking policy**: nie mockować sesji ani bazy. Prawdziwe cookie i lokalny Supabase, jak obecny smoke.

### 6.3 Adding an e2e test

- **Location**: `tests/e2e/`, obok seeda. Jeden spec na ryzyko.
- **Run locally**: `npx playwright test --project=preview`.
- **Wzorzec**: `tests/e2e/post-login-screen.spec.ts` zakłada dwa świeże konta, loguje każde formularzem i sprawdza ekran. Klient ląduje na liście `/consultations` („Moje zgłoszenia”, „Nie masz jeszcze żadnych zgłoszeń.”). Behawiorysta ląduje w kalendarzu (`/dashboard`, link „Poprzedni miesiąc”). Seed `auth-gate-redirect` w tym samym projekcie sprawdza wizytę bez sesji na `/dashboard`.
- **Mocking policy**: prawdziwa sesja i podgląd (`build` + `preview`). Nie mockować sesji, której deploy nie używa.

### 6.4 Adding a test for a new API endpoint

- **Test type**: HTTP na podglądzie.
- **Zapis**: asercja obejmuje brak wiersza na liście klienta, nie sam kod statusu. Imię psa z odrzuconego zapisu nie występuje na `/consultations` autora.
- **TBD** — see §3 Phase 4 (cudzy odczyt). Asercja obejmuje brak cudzych danych, nie sam kod statusu.
- **When to add e2e instead**: gdy błąd widać tylko po hydracji wyspy, nie po odpowiedzi HTTP.

### 6.5 Adding a test for a new content-build rule

- Nie dotyczy. Produkt nie ma potoku treści.

### 6.6 Per-rollout-phase notes

- **Faza 1**: promocja roli przez `npx supabase db query --local`. Godzina blokady liczona w `Europe/Warsaw`.

## 7. What We Deliberately Don't Test

Q5 wywiadu pominięte. Wykluczenia poniżej są z PRD i z zaakceptowanego briefu.

- **Maile** — poza v1. Wrócić, gdy mail zejdzie z listy parked. (Źródło: PRD, non-goals.)
- **Podsumowanie AI** — poza przepływem pierwszej wersji. Wrócić razem z FR-009. (Źródło: PRD, non-goals.)
- **Wielu behawiorystów i wiele kalendarzy** — v1 to jeden behawiorysta. Wrócić, gdy wejdzie do zakresu. (Źródło: PRD, non-goals.)
- **Własny algorytm grafiku, aplikacja mobilna, tryb offline** — poza v1. (Źródło: PRD, non-goals.)
- **Playwright poza ekranem po zalogowaniu** — #1, #2, #4, #5 i #6 zostają przy HTTP albo asercji instantu. Snapshotów UI nie dodajemy. (Źródło: decyzja 2026-10-19, zakres e2e = tylko #3.)

## 8. Freshness Ledger

- Strategy (§1–§5) last reviewed: 2026-10-19
- Stack versions last verified: 2026-10-15
- AI-native tool references last verified: 2026-10-15

Refresh (`/10x-test-plan --refresh`) when:

- a new top-3 risk surfaces from the roadmap or archive,
- a recommended tool's `checked:` date is older than three months,
- the project's tech stack changes (new framework, new test runner),
- §7 negative-space no longer matches what the team believes.
