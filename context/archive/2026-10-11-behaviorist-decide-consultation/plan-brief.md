# Akceptacja i odrzucenie konsultacji — Plan Brief

> Full plan: `context/changes/behaviorist-decide-consultation/plan.md`

## What & Why

Behawiorysta rozstrzyga konsultację w aplikacji: akceptuje albo odrzuca zgłoszenie, które klient złożył z ankietą i terminem. Maile są poza v1, więc wynik ma być widoczny jako status na liście klienta i jako komunikat na pulpicie behawiorysty.

## Starting Point

Tabela `consultations` ma statusy `pending`, `accepted` i `rejected`, ale granty kończą się na `select` i `insert`. Panel pokazuje każde oczekujące oraz zaakceptowane do końca slotu; odrzucone i zakończone zaakceptowane są schowane. Lista klienta ma już trzy polskie etykiety. Unikalny indeks trzyma slot tylko dla `pending` i `accepted`.

## Desired End State

Na szczegółach oczekującego zgłoszenia są „Akceptuj” i „Odrzuć”. Zapis wraca na `/dashboard` z komunikatem. Przyszła zaakceptowana wizyta zostaje w kalendarzu bez przycisków. Odrzucona znika z panelu (stary adres to 404), a klient widzi „Odrzucona”. Ten sam termin da się wtedy zarezerwować ponownie. Oczekujące zgłoszenie, którego godzina już minęła, nadal da się rozstrzygnąć: po akceptacji karta znika z panelu, a klient widzi „Zaakceptowana”.

## Key Decisions Made

| Decyzja | Wybór | Why (1 sentence) |
| --- | --- | --- |
| Odwracalność | Tylko `pending` → `accepted` albo `rejected` | Kolejka decyzji to „Oczekuje na decyzję”; po zapisie przycisków nie ma. |
| Odrzucone w panelu | Znikają z listy, siatki i szczegółów | Filtr S-02 zostaje; ślad dla klienta to etykieta „Odrzucona”. |
| Miniony slot | Oba przyciski dla każdego `pending`, także po końcu slotu | Zaległą kartę da się zdjąć; po akceptacji panel ją chowa, a klient widzi „Zaakceptowana”. |
| Kanał wyniku | Aplikacja, bez maila | PRD zostawia treść maila przy decyzji poza v1. |
| Slot po odmowie | Wolny dzięki indeksowi `pending` + `accepted` | Odrzucenie nie kasuje wiersza; termin wypada z indeksu razem ze statusem. |
| Miejsce przycisków | Formularz POST na `/dashboard/[id]` | Ankieta jest na szczegółach; wzorzec to formularz wylogowania, nie wyspa React. |
| Uzasadnienie odmowy | Brak nowego pola | FR-008 wymaga samego rozstrzygnięcia. |

## Scope

**In scope:**

- Migracja: `UPDATE` tylko kolumny `status`, tylko dla behawiorysty, tylko ze starego `pending`.
- `POST /api/consultations/[id]/decision` z przekierowaniem na `/dashboard?decided=`.
- Przyciski na szczegółach `pending` i baner na pulpicie, także przy pustej liście.

**Out of scope:**

- Maile, uzasadnienie odmowy, cofanie decyzji, archiwum odrzuconych.
- Przyciski na liście i w siatce, anulowanie przez klienta, UI blokad (S-03), AI.

## Architecture / Approach

RLS jest źródłem prawdy dla przejścia statusu. Strona pokazuje przyciski tylko przy `pending`, a endpoint i tak aktualizuje wiersz wyłącznie wtedy, gdy nadal jest `pending`. Sukces i odmowa są przekierowaniami. `visibleSubmissions` i lista klienta nie dostają nowej reguły: pierwsza dalej chowa `rejected`, druga dalej tłumaczy trzy statusy.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Reguła przejścia w bazie | Grant i polityka `pending` → `accepted` \| `rejected` | Zamiana `USING` i `WITH CHECK` blokuje zapis albo puszcza zły stan |
| 2. Zapis decyzji | POST i przekierowania `decided` | Zero wierszy z Supabase wygląda jak sukces, jeśli nie sprawdzimy zwróconego id |
| 3. Panel decyzji | Przyciski i baner | Baner schowany w gałęzi niepustej listy ginie po ostatniej odmowie |

**Prerequisites:** S-02 jest w kodzie (pulpit, szczegóły, etykiety klienta). Lokalny Supabase oraz konta klienta i behawiorysty do ręcznego przejścia.
**Estimated effort:** około 1–2 sesje na 3 fazy.

## Open Risks & Assumptions

- `npx supabase db reset` czyści lokalne dane. Na żywym stosie nową migrację nakłada się bez resetu, jeśli zgłoszenia mają zostać.
- S-03 może równolegle edytować `src/pages/dashboard.astro`. Ten plan dokłada tam tylko baner.
- Polityki RLS nie ma w Vitest. Faza 1 opiera się na resecie i na ręcznym zapisie z dwóch ról.
- Przyjmujemy, że w v1 jest jeden behawiorysta. Polityka i tak puszcza każdego użytkownika z rolą `behaviorist`.

## Success Criteria (Summary)

- Behawiorysta akceptuje albo odrzuca oczekujące zgłoszenie, także takie, którego godzina już minęła.
- Odrzucone znika z jego panelu, klient widzi „Odrzucona”, a termin przyjmuje nową rezerwację.
- Drugi zapis i zapis klienta nie zmieniają statusu. Po pierwszej decyzji przycisków już nie ma.
