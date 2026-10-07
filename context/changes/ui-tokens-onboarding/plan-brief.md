# Tokeny UI na /dashboard — Plan Brief

> Full plan: `context/changes/ui-tokens-onboarding/plan.md`
> Research: `context/changes/ui-tokens-onboarding/research.md`

## What & Why

`/dashboard` ma przestać być granatowym szkłem z klas palety i zacząć czytać tokeny oraz komponenty, które starter już ma. Dziś edycja `--primary` albo `.dark` nie zmienia tej karty, a dwa przyciski Sign out nie mają wspólnego pierścienia fokusu. Wartości kolorów zostają neutralne — najpierw odczyt, bez nowego motywu.

## Starting Point

Tokeny shadcn w `src/styles/global.css` są opublikowane i używa ich `body` oraz `Button`. Karta dashboardu i `Topbar` używają `white` / `blue` / `purple` oraz `bg-cosmic`. Card w `src/components/ui/` nie istnieje. Logowanie kończy się na `/`, nie na tym ekranie.

## Desired End State

Osoba z sesją, która otworzy `/dashboard`, widzi jasną kartę i dwa Sign out zbudowane ze wspólnego `Button`. Tab pokazuje pierścień `ring`. Welcome i konsultacje zostają na granatowym tle, z jasnym paskiem. Kitchen sink pod `/dev/dashboard-states` pokazuje kartę z `ada@example.com` i cztery powody N/A. Lint odrzuca klasę palety na plikach tego widoku.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Wartości tokenów | Zostają neutralne oklch | Widok czyta role, które już są w pliku, bez globalnego rebrandu `Button` i `body`. | Plan |
| Topbar | W tej zmianie, cztery ekrany | Pasek jest na `/dashboard` i niesie drugi Sign out bez pierścienia. | Plan |
| Panel i Sign out | Wyspa `Card` + `Button` (`client:load`) | W repo nie ma Card ani wrappera Astro dla Button. | Plan |
| Sign out w pasku | Drugi montaż tego samego `Button`, `variant="link"` | Pasek jest osobnym plikiem, a dzisiejszy przycisk wygląda jak link. | Plan |
| Landing po logowaniu | Zostaje `/` | Ta zmiana nie ustawia nowej strony domowej; zarzut 5 odroczony. | Plan |
| Liczba Sign out | Oba zostają | Zarzut dotyczy stylu i fokusu, nie usuwania akcji. | Plan |
| disabled, error, empty, loading | N/A z powodem na kitchen sinku | Karta nie ma tych gałęzi; focus-visible jest żywy, bo oba przyciski są w tabulacji. | Research |
| `bg-cosmic` poza dashboardem | Zostaje w CSS | Sześć innych plików go używa, a zmiana obejmuje jeden widok plus wspólny pasek. | Research |
| Bramka wizualna | Kitchen sink, bez Playwrighta | W repo nie ma testu zrzutów ekranu. | Research |
| Język UI | Angielskie stringi karty i paska zostają | Plan jest po polsku; copy widoku nie jest częścią kontraktu tokenów. | Plan |

## Scope

**In scope:**

- `npx shadcn@latest add card` do `src/components/ui/card.tsx`
- Spis ról w `context/changes/ui-tokens-onboarding/tokens.md`
- Wyspa `DashboardCard` i podpięcie `/dashboard` pod `bg-background`
- Cały `Topbar.astro`, łącznie z gałęzią bez sesji
- `/dev/dashboard-states` z fixture `ada@example.com`
- Sekcja `## UI` w `AGENTS.md` i skan czterech plików widoku wewnątrz `npm run lint`

**Out of scope:**

- Edycja oklch, usunięcie `bg-cosmic`, reszta szklanych kart
- Redirect z `signin.ts`
- Usunięcie Sign out, przełącznik motywu, tłumaczenie UI
- Playwright, `shadcn init`, nowa wtyczka ESLint, `SubmitButton`, `LibBadge`

## Architecture / Approach

Serwer Astro przekazuje `email` do wyspy `DashboardCard`. Wyspa renderuje Card i formularz POST `/api/auth/signout` z `Button`. `Topbar.astro` zostaje w Astro i montuje drugi `Button` (`variant="link"`) w swoim formularzu. Linki paska zostają `<a>` na `text-primary` i `ring-ring`. Skan palety nie obejmuje `src/components/ui/`, bo `button.tsx` ma `ring-[3px]` i `text-white` we wariancie destructive.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Biblioteka | `card.tsx` z CLI shadcn | CLI może nadpisać `global.css` — diff tego pliku ma być pusty |
| 2. Kontrakt tokenów | `tokens.md` ze źródłem i zakazem edycji oklch | Spis rozjedzie się z CSS, jeśli ktoś „poprawi” kolory przy okazji |
| 3. Widok | Jasny `/dashboard` i jasny Topbar na czterech ekranach | Jasny pasek na granatowym tle wygląda obco; to skutek, nie powód do palety |
| 4. Stany | Kitchen sink i zrzuty pulpitu oraz ~390px | Topbar nie wchodzi na sink, bo czyta `Astro.locals` — focus paska jest na żywym `/dashboard` |
| 5. Straż | `## UI` w `AGENTS.md` i skan w `npm run lint` | Skan obejmujący `src/components/ui/` zafałszuje wynik przez klasy w `button.tsx` |

**Prerequisites:** Sieć do CLI shadcn w fazie 1. Lokalna sesja Supabase do ręcznego `/dashboard` i wylogowania. Node 22, jak w CI.
**Estimated effort:** Około dwóch sesji na pięć faz.

## Open Risks & Assumptions

- Założenie: `npx shadcn@latest add card` zapisze TSX w `@/components/ui` zgodnie z `components.json`. Plan nie zgaduje listy eksportów — wyspa składa się z tego, co CLI zapisze.
- Skutek uboczny: Welcome i konsultacje dostają jasny pasek bez osobnego audytu tych stron.
- Kitchen sink jest publiczny i nielinkowany. Niesie fixture `ada@example.com`, nie dane sesji.
- `.dark` dalej nic nie włącza. Jasny wygląd dotyczy `:root`.

## Success Criteria (Summary)

- Na `/dashboard` widać jasną kartę z tokenów i dwa Sign out, które wylogowują, z pierścieniem fokusu na tabulacji.
- `/dev/dashboard-states` bez sesji pokazuje kartę `ada@example.com` oraz N/A dla disabled, error, empty i loading.
- `AGENTS.md` wskazuje tokeny i komponenty, a `npm run lint` pada na klasie palety w plikach tego widoku.
