---
project: Behawiorysta
version: 1
status: draft
created: 2026-09-25
context_type: greenfield
product_type: web-app
target_scale:
  users: small
timeline_budget:
  mvp_weeks: 3
  hard_deadline: 2026-12-06
  after_hours_only: true
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
