---
project: Behawiorysta
version: 1
status: draft
created: 2026-09-29
updated: 2026-10-01
prd_version: 1
main_goal: speed
top_blocker: time
milestone_id: first-booking-flow
milestone_seq: 1
milestone_status: open
---

# Roadmap: Behawiorysta

> Derived from `context/foundation/prd.md` (v1) + auto-researched codebase baseline.
> Edit-in-place; archive when superseded.
> Slices below are listed in dependency order. The "At a glance" table is the index.

## Milestone

**M-01: Pierwszy przepływ umawiania** — Status: open

- **Intent:** Klient po kompletnej ankiecie umawia konsultację, a behawiorysta widzi zgłoszenie, blokuje dni i rozstrzyga je w aplikacji — bez maili i bez AI w tym kamieniu milowym.
- **Source materials:** `context/foundation/prd.md` (v1)
- **Done when:** every S-NN below is `done`.
- **Scope anchors:** FR-001–FR-008, US-01

## Vision recap

Jeden behawiorysta traci czas, składając obraz psa przed wizytą, bo umówienie i komplet informacji rozjeżdżają się z klientem. Sam termin nie wystarcza — przed wizytą musi być ankieta: rasa, wiek, podstawowe informacje o psie i nad czym klient chce pracować. Produkt łączy obie strony w jednym przepływie webowym dla jednego behawiorysty i jego klientów.

## North star

**S-02: Behawiorysta widzi zgłoszenie z ankiety i terminem** — Najmniejszy przepływ od końca do końca, który udowadnia tezę „sam termin nie wystarcza”: klient dostarcza komplet informacji i termin, behawiorysta widzi gotowe zgłoszenie bez składania obrazu psa z rozproszonych wiadomości.

> Gwiazda przewodnia to najmniejszy plasterek od końca do końca, którego udane dowiezienie udowadnia, że produkt działa — stawiany jak najwcześniej, jak pozwalają zależności, bo reszta ma sens dopiero wtedy, gdy ten przepływ się spina.

## At a glance

| ID   | Change ID                    | Outcome (user can …)                                              | Prerequisites | PRD refs              | Status   |
| ---- | ---------------------------- | ----------------------------------------------------------------- | ------------- | --------------------- | -------- |
| S-01 | client-survey-and-slot       | klient loguje się, wypełnia ankietę i wybiera termin              | —             | FR-001, FR-003, FR-004, US-01 | done |
| S-02 | behaviorist-submission-views | behawiorysta loguje się, widzi kalendarz i listę zgłoszeń, otwiera szczegóły ankiety | S-01          | FR-002, FR-005, FR-006, US-01 | proposed |
| S-03 | behaviorist-block-days       | behawiorysta blokuje dni lub konkretne godziny, a zablokowane terminy nie przyjmują nowych konsultacji | S-02          | FR-007, US-01         | proposed |
| S-04 | behaviorist-decide-consultation | behawiorysta akceptuje albo odrzuca konsultację w aplikacji   | S-02          | FR-008, US-01         | proposed |

## Streams

Navigation aid — groups items that share a Prerequisites chain. Canonical ordering still lives in the dependency graph below; this table is the proposed reading order across parallel tracks.

| Stream | Theme              | Chain                          | Note                                                                 |
| ------ | ------------------ | ------------------------------ | -------------------------------------------------------------------- |
| A      | Ścieżka klienta    | `S-01`                         | Najkrótsza droga do pierwszego zgłoszenia; odblokowuje gwiazdę S-02. |
| B      | Panel behawiorysty | `S-02` → `S-03`, `S-04`        | Dołącza po S-01; S-03 i S-04 mogą iść równolegle po S-02.            |

## Baseline

What's already in place in the codebase as of `2026-09-29` (auto-researched + user-confirmed).
Foundations below assume these are present and do NOT re-scaffold them.

- **Frontend:** present — Astro + React + TypeScript (`package.json`, `astro.config.mjs`); brak UI ankiety, kalendarza i rezerwacji — tylko powłoka startowa i formularze auth.
- **Backend / API:** partial — serwer Astro (`output: "server"`); trasy API tylko auth (`signin`, `signup`, `signout`); brak handlerów domenowych.
- **Data:** partial — klient Supabase w `src/lib/supabase.ts`; brak migracji i tabel domenowych (pies, konsultacja, zablokowany dzień).
- **Auth:** partial — Supabase Auth, sesja cookie, middleware na `/dashboard`; brak modelu dwóch ról (behawiorysta / klient).
- **Deploy / infra:** partial — adapter Cloudflare i `wrangler.jsonc`; CI robi lint/check/build/smoke bez deployu po merge.
- **Observability:** absent — brak logowania, śledzenia błędów i metryk.

## Foundations

Brak osobnych fundamentów — przy celu `speed` warstwy techniczne (role, schemat danych, izolacja klientów) wchodzą progresywnie w pierwsze plastereki, które ich potrzebują.

## Slices

### S-01: Klient — ankieta i termin

- **Outcome:** klient loguje się, wypełnia kompletną ankietę (rasa, wiek, podstawowe informacje o psie, nad czym chce pracować) i wybiera termin konsultacji.
- **Change ID:** client-survey-and-slot
- **PRD refs:** FR-001, FR-003, FR-004, US-01
- **Prerequisites:** —
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:**
  - Jaka granularność terminu (dzień vs slot godzinowy) — Owner: user. Block: no.
- **Risk:** Wprowadza schemat danych i logowanie klienta; bez tego plasterek nic downstream nie ma sensu — dlatego idzie pierwszy.
- **Status:** done

### S-02: Behawiorysta — widok zgłoszeń

- **Outcome:** behawiorysta loguje się, widzi kalendarz i listę zgłoszeń oraz otwiera szczegóły z kompletną ankietą i wybranym terminem.
- **Change ID:** behaviorist-submission-views
- **PRD refs:** FR-002, FR-005, FR-006, US-01
- **Prerequisites:** S-01
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:** —
- **Risk:** To gwiazda przewodnia — dowodzi, że ankieta i termin trafiają do behawiorysty; wymaga rozróżnienia ról i izolacji danych klientów.
- **Status:** proposed

### S-03: Behawiorysta — blokada dni

- **Outcome:** behawiorysta blokuje dni lub konkretne godziny, a zablokowane terminy nie przyjmują nowych konsultacji.
- **Change ID:** behaviorist-block-days
- **PRD refs:** FR-007, US-01
- **Prerequisites:** S-02
- **Parallel with:** S-04
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Model blokad i filtrowanie istnieją od S-01, a S-03 dokłada UI i politykę zapisu. Reguła biznesowa z PRD musi działać w obu kierunkach — blokada po stronie behawiorysty i filtrowanie terminów po stronie klienta.
- **Status:** proposed

### S-04: Behawiorysta — akceptacja i odrzucenie

- **Outcome:** behawiorysta akceptuje albo odrzuca konsultację w aplikacji.
- **Change ID:** behaviorist-decide-consultation
- **PRD refs:** FR-008, US-01
- **Prerequisites:** S-02
- **Parallel with:** S-03
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Zamyka pętlę US-01; maile są poza zakresem — decyzja musi być widoczna w aplikacji, nie w skrzynce.
- **Status:** proposed

## Backlog Handoff

| Roadmap ID | Change ID                    | Suggested issue title                              | Ready for `/10x-plan` | Notes |
| ---------- | ---------------------------- | -------------------------------------------------- | --------------------- | ----- |
| S-01       | client-survey-and-slot       | Klient: ankieta psa i wybór terminu konsultacji  | yes                   | Gwiazda przewodnia zaczyna się tutaj — bez zgłoszenia klienta S-02 nie ma czego pokazać. |
| S-02       | behaviorist-submission-views | Behawiorysta: kalendarz, lista i szczegóły zgłoszeń | no                 | Wymaga S-01. |
| S-03       | behaviorist-block-days       | Behawiorysta: blokada dni i godzin w kalendarzu    | no                    | Wymaga S-02. |
| S-04       | behaviorist-decide-consultation | Behawiorysta: akceptacja i odrzucenie konsultacji | no                 | Wymaga S-02; równoległy z S-03. |

## Open Roadmap Questions

1. **Dokładna liczba godzin tygodniowo** — Owner: user. Block: roadmap-wide.
2. **Docelowo kilku behawiorystów i ich kalendarze** — Owner: user. Block: po pierwszej wersji (poza tym kamieniem milowym).

## Parked

- **Maile (ankieta, podsumowanie, treść przy akceptacji/odrzuceniu)** — Why parked: PRD §Non-Goals — pierwszy przepływ działa w aplikacji.
- **Wielu behawiorystów i wielu kalendarzy** — Why parked: PRD §Non-Goals — v1 to jeden behawiorysta, jeden kalendarz.
- **Podsumowanie zgłoszenia przez AI (FR-009)** — Why parked: PRD §Non-Goals — nice-to-have poza przepływem 3 tygodni.
- **Własny algorytm układania grafiku** — Why parked: PRD §Non-Goals — jest blokada dnia i wybór wolnego terminu.
- **Aplikacja mobilna i tryb offline** — Why parked: PRD §Non-Goals.
- **Observability (logi, error tracking, metryki)** — Why parked: cel `speed`; baseline absent, brak NFR wymuszających na start.
- **Auto-deploy po merge (CI → Cloudflare Pages)** — Why parked: cel `speed`; deploy partial w baseline, nie blokuje pierwszego przepływu lokalnie.

## Milestone History

## Done

- **S-01: klient loguje się, wypełnia kompletną ankietę (rasa, wiek, podstawowe informacje o psie, nad czym chce pracować) i wybiera termin konsultacji.** — Archived 2026-10-01 → `context/archive/2026-10-01-client-survey-and-slot/`. Lesson: —.
