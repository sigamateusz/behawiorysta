---
project: Behawiorysta
context_type: greenfield
created: 2026-09-25
updated: 2026-09-25
product_type: web-app
target_scale:
  users: small
timeline_budget:
  mvp_weeks: 3
  hard_deadline: 2026-12-06
  after_hours_only: true
checkpoint:
  current_phase: 8
  phases_completed: [1, 2, 3, 4, 5, 6, 7]
  gray_areas_resolved:
    - topic: "pain category"
      decision: "narzut koordynacji między klientem a behawiorystą"
    - topic: "insight"
      decision: "sam termin nie wystarcza — przed wizytą ankieta: rasa, wiek, podstawowe informacje, nad czym klient chce pracować"
    - topic: "primary persona"
      decision: "jeden behawiorysta, jeden kalendarz; klient jest drugą stroną"
    - topic: "access"
      decision: "logowanie na konto; dwie role"
    - topic: "mvp scope"
      decision: "ścięty rdzeń bez maili i bez AI w pierwszym przepływie; 3 tygodnie po pracy"
    - topic: "secondary"
      decision: "podsumowanie zgłoszenia przygotowane przez AI, widoczne dla behawiorysty"
    - topic: "guardrails"
      decision: "klient nie widzi cudzych zgłoszeń; zablokowany dzień nie przyjmuje konsultacji"
    - topic: "product type"
      decision: "aplikacja webowa"
    - topic: "scale"
      decision: "garstka: jeden behawiorysta i jego klienci; przy 100x reguła zostaje przy każdym kalendarzu"
    - topic: "deadline"
      decision: "2026-12-06, praca po godzinach"
    - topic: "non-goals"
      decision: "bez maili, bez wielu behawiorystów w v1, bez AI w 3 tygodniach, bez własnego algorytmu grafiku, bez mobile i offline"
  frs_drafted: 9
  quality_check_status: accepted
---

## Vision & Problem Statement

Jeden behawiorysta traci czas, składając obraz psa przed wizytą, bo umówienie i komplet informacji rozjeżdżają się z klientem. Klient nie umie umówić się z kompletnym opisem psa. Moment: umawianie konsultacji i czas przed wizytą. Koszt dziś: niekompletne umówienie po stronie klienta i czas behawiorysty na złożenie obrazu psa.

Sam termin nie wystarcza. Przed wizytą musi być ankieta: rasa, wiek, podstawowe informacje o psie i nad czym klient chce pracować.

Przy stu razy większej liczbie użytkowników reguła zostaje przy każdym kalendarzu; przybywa behawiorystów, nie jedna wspólna lista.

## User & Persona

### Primary persona

Jeden psi behawiorysta, jeden kalendarz. Sięga po produkt, gdy przed wizytą musi złożyć obraz psa z rozproszonych informacji od klienta.

### Secondary persona

Klient umawiający konsultację. Druga strona: ma podać kompletny opis psa i wybrać termin.

## Success Criteria

### Primary

- Klient loguje się, wypełnia ankietę (rasa, wiek, podstawowe informacje, nad czym chce pracować) i wybiera termin.
- Behawiorysta loguje się, widzi kalendarz i zgłoszenie, blokuje dni, akceptuje albo odrzuca konsultację.
- Pierwszy przepływ mieści się w 3 tygodnie pracy po godzinach. Maile są poza tym przepływem.

### Secondary

- Podsumowanie zgłoszenia przygotowane przez AI, widoczne dla behawiorysty.

### Guardrails

- Klient nie widzi zgłoszeń ani kalendarza innych klientów.
- Zablokowany dzień nie przyjmuje nowej konsultacji.

## User Stories

### US-01: Klient umawia konsultację, behawiorysta ją rozstrzyga

- **Given** klient jest zalogowany
- **When** wypełnia ankietę (rasa, wiek, podstawowe informacje o psie, nad czym chce pracować) i wybiera termin
- **Then** behawiorysta widzi zgłoszenie w kalendarzu i na liście, może otworzyć szczegóły, zablokować dzień oraz zaakceptować albo odrzucić konsultację

## Functional Requirements

### Konto

- FR-001: Klient może się zalogować. Priority: must-have
  > Socrates: Kontrargument: konto przed ankietą zniechęca klienta, który chce tylko umówić jedną konsultację. Rozstrzygnięcie: zostaje must-have.
- FR-002: Behawiorysta może się zalogować. Priority: must-have
  > Socrates: Docelowo może być kilku behawiorystów oraz ich kalendarzy, więc zostaje logowanie behawiorysty.

### Ankieta i termin

- FR-003: Klient może wypełnić ankietę: rasa, wiek, podstawowe informacje o psie, nad czym chce pracować. Priority: must-have
  > Socrates: Brak kontrargumentu; zostaje jak jest.
- FR-004: Klient może wybrać termin konsultacji po kompletnej ankiecie. Priority: must-have
  > Socrates: Kontrargument: wybór terminu przed kompletną ankietą z powrotem robi z tego zwykły kalendarz. Rozstrzygnięcie: zostaje, termin jest po kompletnej ankiecie.

### Kalendarz i decyzja

- FR-005: Behawiorysta może zobaczyć kalendarz i listę zgłoszeń. Priority: must-have
  > Socrates: Kalendarz i lista współistnieją jako różne widoki: najbliższe wydarzenia z kalendarza oraz z listy.
- FR-006: Behawiorysta może otworzyć szczegóły zgłoszenia. Priority: must-have
  > Socrates: Szczegóły pokazują kompletną ankietę wraz z pytaniem otwartym, nad czym klient chce pracować. Docelowo ten widok pokazuje też podsumowanie wygenerowane przez AI.
- FR-007: Behawiorysta może blokować dni. Priority: must-have
  > Socrates: Brak kontrargumentu; zostaje jak jest.
- FR-008: Behawiorysta może zaakceptować albo odrzucić konsultację. Priority: must-have
  > Socrates: Brak kontrargumentu; zostaje jak jest.
- FR-009: Behawiorysta może zobaczyć podsumowanie zgłoszenia przygotowane przez AI. Priority: nice-to-have
  > Socrates: Kontrargument: nawet jako nice-to-have podsumowanie AI wciąga pierwszą wersję poza 3 tygodnie. Rozstrzygnięcie: zostaje nice-to-have, poza przepływem 3 tygodni.

## Non-Functional Requirements

- Klient nie widzi ankiety, zgłoszenia ani kalendarza innego klienta.

## Business Logic

Termin da się wybrać dopiero po kompletnej ankiecie, a zablokowany dzień tego wyboru nie przyjmuje.

Wejścia: rasa, wiek, podstawowe informacje o psie, nad czym klient chce pracować, oraz dni zablokowane przez behawiorystę. Wynik: klient widzi terminy, które da się wybrać. Moment: wybór terminu pojawia się po kompletnej ankiecie i omija zablokowane dni.

## Access Control

Logowanie na konto. Dwie role.

- Behawiorysta: kalendarz i zgłoszenia.
- Klient: ankieta i wybór terminu.

## Non-Goals

- Bez maili w v1: ankieta, podsumowanie i treść maila przy akceptacji albo odrzuceniu. Pierwszy przepływ działa w aplikacji.
- Bez wielu behawiorystów i wielu kalendarzy w v1. Zostaje jeden behawiorysta i jeden kalendarz.
- Bez podsumowania AI w przepływie 3 tygodni. Zostaje nice-to-have poza tym przepływem.
- Bez własnego algorytmu układania grafiku. Jest blokada dnia i wybór wolnego terminu.
- Bez aplikacji mobilnej i bez działania offline.

## Open Questions

1. **Dokładna liczba godzin tygodniowo** — otwarte w pomyśle. Owner: user. By: przed startem prac.
2. **Docelowo kilku behawiorystów i ich kalendarze** — poza v1. Owner: user. By: po pierwszej wersji.

## Quality cross-check

Wszystkie elementy obecne. Braków nie ma.

- Access Control: present
- Business Logic: present
- Project artifacts: present
- Timeline-cost ack: present (mvp_weeks: 3)
- Non-Goals: present
- Preserved behavior: n/a (greenfield)

## Seed idea

Nowy projekt od zera: strona dla jednego psiego behawiorysty i jego klientów. Klient loguje się, wypełnia ankietę (rasa, wiek, podstawowe informacje o psie, nad czym chce pracować) i wybiera termin konsultacji. Behawiorysta loguje się, widzi kalendarz i listę zgłoszeń, otwiera szczegóły oraz podsumowanie przygotowane przez AI. Ankietę i podsumowanie dostaje też mailem. Może blokować dni, akceptować albo odrzucać konsultacje. Przy akceptacji i odrzuceniu AI przygotowuje treść maila do klienta. Cel: termin 2, 6 grudnia 2026, ograniczony czas po pracy. Doświadczenie: 10+ lat Java/JavaScript; agenci dotychczas przy debugowaniu, testach i migracji Spring Boot 3→4. Otwarte: dokładna liczba godzin tygodniowo; jeden behawiorysta i jeden kalendarz.

## Forward: tech-stack

Doświadczenie: 10+ lat Java/JavaScript. Agenci dotychczas przy debugowaniu, testach i migracji Spring Boot 3→4.
