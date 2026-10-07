# Tokeny UI na /dashboard — plan implementacji

## Overview

`/dashboard` ma czytać istniejące tokeny shadcn i komponenty z `src/components/ui/`, zamiast klas palety i szklanej karty. Wartości kolorów zostają neutralnym starterem. Pasek `Topbar` przechodzi na te same role, bo renderuje się na tym ekranie i niesie drugi przycisk Sign out.

## Current State Analysis

Na `main` karta w `src/pages/dashboard.astro` nie używa ról opublikowanych z `src/styles/global.css`. `body` i `Button` już je czytają, więc plik tokenów nie jest martwy w całym repo — martwy jest ten widok. Skan palety na `dashboard.astro` trafia w 6 linii i 11 klas (`white`, `blue`, `purple`). `bg-cosmic` na linii 9 skan pomija, bo hex siedzi w utility w CSS.

`Topbar.astro` dokłada drugi Sign out (`text-purple-300`, bez `focus-visible`) i jest importowany przez cztery ekrany. W `src/components/ui/` są `button.tsx` i `LibBadge.astro`. Nie ma `card`. Astro montuje React tylko przez `client:load` na formularzach, które potrzebują stanu. `Button` ma `asChild` i warianty, w tym `link` i `default`, oraz pierścień `focus-visible:ring-ring/50`.

Udane logowanie w `src/pages/api/auth/signin.ts` kończy się na `/`. `/dashboard` wymaga sesji. Brak sesji przekierowuje na `/auth/signin`. Behawiorysta, który otworzy `/consultations`, ląduje na `/dashboard`. Klient zostaje przy konsultacjach.

### Key Discoveries:

- Wartości w `:root` / `.dark` to neutralny starter shadcn (`oklch` bez barwy, poza `--destructive` i wykresami). `@theme inline` publikuje `--color-card`, `--color-primary`, `--color-ring`, `--color-border`, `--color-muted-foreground`, `--color-background` (`src/styles/global.css:75-111`). Nie ma `--radius-2xl`.
- `bg-cosmic` to `linear-gradient(to bottom, #0a0e1a, #0f1529, #0a0e1a)` (`src/styles/global.css:113-115`). Używają go też sign-in, sign-up, confirm-email, Welcome i obie strony konsultacji.
- `Button` nie ma wrappera Astro. Wzorzec montowania: `src/pages/auth/signin.astro:14` (`client:load`). Baza przycisku zawiera `ring-[3px]` i wariant `destructive` zawiera `text-white` (`src/components/ui/button.tsx:8-14`). Skan widoku nie może obejmować `src/components/ui/`.
- CI już uruchamia `npm run lint`, `npx astro check`, `npm test` i `npm run build` (`.github/workflows/ci.yml:20-26`). Nie ma Playwrighta, Storybooka ani kitchen sinka.
- `AGENTS.md` nie leży w bloku przepisywanym przez 10x-cli. `.cursor/rules/10x-course.mdc` leży w całości w tym bloku.

## Desired End State

Zalogowana osoba, która wejdzie na `/dashboard` linkiem albo jako behawiorysta z `/consultations`, widzi jasną kartę na `bg-background`: biała powierzchnia, prawie czarny przycisk primary, tekst z `card-foreground` i `muted-foreground`. Na karcie i w pasku są dwa przyciski Sign out. Oba są wspólnym `Button` i oba wysyłają POST na `/api/auth/signout`. Tabulator pokazuje pierścień `ring` na obu oraz na linkach paska.

Welcome (`/`) i strony konsultacji zostają na granatowym tle. Ich pasek jest jasny, bo `Topbar.astro` jest jeden. `bg-cosmic` zostaje w CSS dla tamtych stron.

Kitchen sink pod `/dev/dashboard-states` pokazuje kartę z fixture `ada@example.com` oraz cztery powody N/A. `npm run lint` odrzuca klasę palety w plikach tego widoku. `AGENTS.md` mówi, gdzie są tokeny i komponenty.

### Key Discoveries:

- Podpięcie pod istniejące role zmienia wygląd `/dashboard` z granatowego szkła na jasny starter. To jest zaakceptowany wynik, nie błąd fazy widoku.
- Jasny pasek na granatowych stronach jest zaakceptowanym skutkiem jednego `Topbar.astro`.

## What We're NOT Doing

- Zmiana wartości oklch w `:root` / `.dark` i wpisywanie granatu w `--background` albo `--primary`.
- Usuwanie utility `bg-cosmic` oraz przebudowa szklanych kart na sign-in, sign-up, confirm-email, Welcome i konsultacjach.
- Przekierowanie po logowaniu. Sukces zostaje na `/`. Zarzut 5 (landing) jest odroczony: niezalogowany i tak widzi sign-in, a ta zmiana nie ustawia nowej strony domowej.
- Usunięcie któregokolwiek Sign out. Zostają oba.
- Przełącznik `.dark`. Blok CSS zostaje, nic go nie włącza.
- Tłumaczenie napisów karty i paska. Angielskie stringi zostają. „Moje konsultacje” zostaje.
- Playwright, Storybook i nowa zależność lintowa. `shadcn init`. Drugi plik reguł obok `AGENTS.md`. Edycja `.cursor/rules/10x-course.mdc`.
- `SubmitButton` i jego `bg-purple-600`. `LibBadge.astro`. Publikacja `--radius-2xl`.
- Ochrona trasy kitchen sinka i link do niej w nawigacji.

## Implementation Approach

Kolejność: biblioteka, zamrożone tokeny, widok, stany, straż. Każdy zarzut z `research.md` ma fazę albo powód odroczenia.

| Zarzut | Rozstrzygnięcie |
| --- | --- |
| 1. Klasy palety na karcie | Faza 3. Karta czyta role semantyczne. |
| 2. `bg-cosmic` na `/dashboard` | Faza 3 usuwa użycie z tego widoku. Utility zostaje (faza 2). Pozostałe sześć plików jest poza zakresem. |
| 3. Dwa Sign out bez pierścienia | Faza 3. Oba montują `Button`. Linki paska dostają klasy tokenów. |
| 4. Brak Card | Faza 1. `npx shadcn@latest add card`. |
| 5. Logowanie nie ląduje na `/dashboard` | Odroczony. Redirect bez zmian. |

Panel jest jedną wyspą `client:load`: `Card` + `Button`. Pasek montuje ten sam `Button` drugi raz (`variant="link"`), bo `Topbar.astro` jest osobnym komponentem. To dwa montaże jednego komponentu, nie drugi przycisk w repo.

Skan, którego używają fazy 3–5 (wzorzec z audytu; nie uruchamiać go na `global.css` ani na `src/components/ui/`):

```bash
grep -nE '#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(|oklch\(|-\[[0-9.]+(px|rem)\]|\b(bg|text|border|ring|outline|from|via|to|fill|stroke|shadow|divide)-(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|white|black)\b' <pliki widoku>
```

`bg-cosmic` ten wzorzec pomija. Pliki widoku dodatkowo nie zawierają stringu `bg-cosmic`.

## Phase 1: Biblioteka

### Overview

W repozytorium pojawia się Card ze ścieżki shadcn, w stylu `new-york`, obok istniejącego `Button`. Paleta i wartości tokenów zostają nietknięte.

### Changes Required:

#### 1. Card

**File**: `src/components/ui/card.tsx` (nowy, zapisany przez CLI)

**Intent**: Domknąć zarzut 4 komponentem, który następny widok może zaimportować, zamiast kolejnego szkieletu z `div`.

**Contract**: Uruchomić `npx shadcn@latest add card` przy obecnym `components.json` (`style: new-york`, alias `ui` → `@/components/ui`, `cssVariables: true`). Nie uruchamiać `shadcn init`. Plik ląduje w `src/components/ui/card.tsx`. Jeśli CLI zmieni `src/styles/global.css` (`:root`, `.dark`, `@theme inline` albo `bg-cosmic`), cofnąć te zmiany. Po fazie `git diff -- src/styles/global.css` jest pusty. Nie dodawać ręcznego odpowiednika Card obok pliku z CLI.

### Success Criteria:

#### Automated Verification:

- `src/components/ui/card.tsx` istnieje i pochodzi z `npx shadcn@latest add card`
- `git diff -- src/styles/global.css` jest pusty
- `npm run lint` kończy się kodem 0
- `npx astro check` kończy się kodem 0

#### Manual Verification:

- W `src/components/ui/` nie ma drugiej, ręcznie napisanej karty obok pliku z CLI

**Implementation Note**: Po zielonych sprawdzeniach automatycznych zatrzymaj się na ręczne potwierdzenie, zanim zaczniesz fazę 2.

---

## Phase 2: Kontrakt tokenów

### Overview

Aktualne wartości ról trafiają do folderu zmiany, żeby następna sesja nie wymyślała palety. W tej zmianie nikt tych wartości nie edytuje.

### Changes Required:

#### 1. Spis wartości

**File**: `context/changes/ui-tokens-onboarding/tokens.md` (nowy)

**Intent**: Złożyć w repo źródło prawdy o rolach, których wolno użyć na tym widoku, skopiowane z pliku CSS, który już jest w projekcie.

**Contract**: Plik nazywa źródło `src/styles/global.css` (`:root` / `.dark`, publikacja przez `@theme inline`, `components.json` `baseColor: neutral`). Przepisuje aktualne wartości ról, których widok używa: `background`, `foreground`, `card`, `card-foreground`, `primary`, `primary-foreground`, `muted-foreground`, `border`, `ring`. Zawiera zakaz edycji tych oklch w tej zmianie. Zapisuje, że `bg-cosmic` (`src/styles/global.css:113-115`) zostaje w CSS i po fazie 3 nie występuje w plikach widoku. Dozwolone utility widoku: `bg-background`, `text-foreground`, `bg-card`, `text-card-foreground`, `text-muted-foreground`, `border-border`, `bg-primary`, `text-primary-foreground`, `text-primary`, `ring-ring`, oraz `rounded-xl` tam, gdzie promień nie bierze się z komponentu Card. Nie edytować `src/styles/global.css`.

### Success Criteria:

#### Automated Verification:

- `context/changes/ui-tokens-onboarding/tokens.md` istnieje i wskazuje `src/styles/global.css` jako źródło wartości
- `git diff -- src/styles/global.css` jest pusty

#### Manual Verification:

- Ze spisu da się odczytać dozwolone role i zakaz zmiany oklch bez wracania do czatu

**Implementation Note**: Po zielonych sprawdzeniach automatycznych zatrzymaj się na ręczne potwierdzenie, zanim zaczniesz fazę 3.

---

## Phase 3: Widok

### Overview

`/dashboard` i cały `Topbar` schodzą z klas palety. Karta staje się wyspą Card + Button. Pasek używa tego samego Buttona do wylogowania i tokenów na linkach. Napisy zostają.

### Changes Required:

#### 1. Wyspa karty

**File**: `src/components/dashboard/DashboardCard.tsx` (nowy)

**Intent**: Złożyć panel z komponentów repo, z e-mailem przekazanym z serwera, bo wyspa nie czyta `Astro.locals`.

**Contract**: Props: `email: string | null`. Brak dyrektywy `"use client"`. Brak importu `astro:env/server`. Panel złożony z eksportów `src/components/ui/card.tsx` (tych, które zapisało CLI), bez własnego szkieletu `div` obok. Widoczne stringi, dokładnie: `Dashboard`, `Welcome, `, wartość `email`, `This page is only for authenticated users.`, `Sign out`. Linia powitania renderuje się także, gdy `email` jest `null`. Przycisk to `Button` w wariancie `default`, `type="submit"`, wewnątrz `<form method="POST" action="/api/auth/signout">`. Klasy koloru tylko z ról fazy 2. Bez `rounded-2xl`, `backdrop-blur`, gradientu tytułu i `bg-cosmic`. Promień powierzchni bierze się z Card.

#### 2. Strona dashboardu

**File**: `src/pages/dashboard.astro`

**Intent**: Zdjąć z widoku drugą paletę i wstawić wyspę tam, gdzie dziś jest szklana karta.

**Contract**: Zostają `Layout` (`title="Dashboard"`) i `Topbar`. Wrapper strony używa `bg-background`, nie `bg-cosmic`. Utility układu (`min-h-screen`, `p-4`, `mx-auto`, `max-w-3xl`, `flex`) mogą zostać. W miejscu karty: `<DashboardCard email={user?.email ?? null} client:load />`. Dyrektywa jak w `src/pages/auth/signin.astro:14`. Strona nie fetchuje danych i nie dostaje gałęzi empty, error, loading ani disabled.

#### 3. Topbar

**File**: `src/components/Topbar.astro`

**Intent**: Zamknąć zarzut 3 na ekranie, który pasek faktycznie renderuje, jednym komponentem dla wszystkich czterech importerów.

**Contract**: Cały plik, łącznie z gałęzią bez sesji (`Not signed in`, `Sign in`, `Sign up`). Sign out zostaje w istniejącym formularzu POST na `/api/auth/signout` i jest `Button` z `variant="link"`, `type="submit"`, `client:load`, etykieta `Sign out`. Linki (`Moje konsultacje`, `Dashboard`, `Sign in`, `Sign up`) zostają `<a>`. Ich kolor i hover schodzą z `text-purple-300` / `hover:text-purple-100` na `text-primary` i `hover:underline`. Focus linków używa `focus-visible:outline-none` i `focus-visible:ring-ring` bez wartości w nawiasach kwadratowych (`ring-[3px]` zostaje wyłącznie w `button.tsx`). Powierzchnia paska: `border-border`, `bg-card`, `text-card-foreground`. E-mail i „Not signed in”: `text-muted-foreground`. `rounded-xl` może zostać. Stringi bez zmian. Nie dodawać propa „wariant tylko dla dashboardu”.

### Success Criteria:

#### Automated Verification:

- Skan palety (wzorzec z Implementation Approach) na `src/pages/dashboard.astro`, `src/components/Topbar.astro` i `src/components/dashboard/DashboardCard.tsx` zwraca zero trafień, a żaden z tych plików nie zawiera `bg-cosmic`
- `npm run lint` kończy się kodem 0
- `npx astro check` kończy się kodem 0

#### Manual Verification:

- Zalogowana osoba na `/dashboard` widzi jasną kartę (białe tło strony, karta `bg-card`, przycisk primary) oraz dwa napisy Sign out
- Tabulator pokazuje pierścień na Sign out w karcie, na Sign out w pasku i na linkach paska
- Welcome (`/`, z sesją i bez) oraz klient na `/consultations` i `/consultations/new` mają jasny pasek na granatowym tle strony
- Sign out z karty i Sign out z paska kończą sesję przez POST

**Implementation Note**: Po zielonych sprawdzeniach automatycznych zatrzymaj się na ręczne potwierdzenie, zanim zaczniesz fazę 4. Jasny pasek na granatowym tle nie jest usterką do „naprawienia” klasą palety.

---

## Phase 4: Stany

### Overview

Jedna nielinkowana strona pokazuje kartę we wszystkich siedmiu komórkach macierzy: trzy żywe, cztery oznaczone N/A z powodem. Zrzuty są ręczne. Playwrighta nie instalujemy.

### Changes Required:

#### 1. Kitchen sink

**File**: `src/pages/dev/dashboard-states.astro` (nowy)

**Intent**: Mieć jeden adres, na którym widać stany karty bez sesji i bez danych użytkownika.

**Contract**: Trasa `/dev/dashboard-states`. Nie dodawać jej do `PROTECTED_ROUTES` w `src/middleware.ts` i nie linkować jej z `Topbar.astro`. Strona renderuje `DashboardCard` z `email="ada@example.com"` i `client:load`. Siedem komórek jest widocznych naraz:

- default — ta karta
- hover — ten sam przycisk Sign out; opis, że hover ma pokazać `hover:bg-primary/90` z wariantu `default`
- focus-visible — ten sam przycisk; opis, że Tab ma pokazać pierścień `ring`
- disabled — N/A: na tym widoku żaden przycisk nie przechodzi w stan disabled; wylogowanie jest dostępne, gdy strona się wyrenderuje
- error — N/A: karta nie ma gałęzi błędu; baner braku konfiguracji Supabase w `Layout.astro` nie jest stanem tej karty
- empty — N/A: karta nie listuje danych; brak e-maila i tak zostawia linię `Welcome,`
- loading — N/A: strona nie pobiera danych i nie ma stanu oczekiwania

Topbar na sinku się nie renderuje. Jego focus sprawdza ręczne kryterium fazy 3, bo pasek czyta `Astro.locals`. Klasy sinka podlegają temu samemu skanowi. Tło sinka: `bg-background`.

### Success Criteria:

#### Automated Verification:

- `src/pages/dev/dashboard-states.astro` istnieje
- `/dev/dashboard-states` nie występuje w `PROTECTED_ROUTES` i `Topbar.astro` nie linkuje tej trasy
- Skan palety na `src/pages/dev/dashboard-states.astro` zwraca zero trafień i plik nie zawiera `bg-cosmic`
- `npx astro check` kończy się kodem 0

#### Manual Verification:

- Wejście na `/dev/dashboard-states` bez sesji pokazuje kartę z `ada@example.com` oraz cztery powody N/A z kontraktu tej fazy
- Hover na Sign out w sinku zmienia tło przycisku, a Tab pokazuje pierścień `ring`
- Jest zrzut pulpitu i zrzut jednej szerokości mobilnej (około 390px) tej samej strony

**Implementation Note**: Po zielonych sprawdzeniach automatycznych zatrzymaj się na ręczne potwierdzenie zrzutów, zanim zaczniesz fazę 5.

---

## Phase 5: Straż

### Overview

Następna sesja dostaje w `AGENTS.md` miejsce tokenów i komponentów, a istniejący `npm run lint` wywala klasę palety na oczyszczonych plikach. CI już woła ten skrypt, więc nowy job nie powstaje.

### Changes Required:

#### 1. Reguła dla agentów

**File**: `AGENTS.md`

**Intent**: Zostawić kontrakt w tym pliku reguł, który audyt znalazł, poza blokiem 10x-cli.

**Contract**: Nowa krótka sekcja `## UI` w `AGENTS.md`. Nie ruszać `.cursor/rules/10x-course.mdc`. Sekcja mówi: tokeny są w `src/styles/global.css` (`:root` / `.dark`, publikacja przez `@theme inline`); komponenty są w `src/components/ui/`; przed nowym komponentem sprawdzić ten katalog i brakujący dodać przez `npx shadcn@latest add <name>`; widoki nie używają kolorów literalnych, klas palety ani wartości w nawiasach kwadratowych; kitchen sink jest w `src/pages/dev/dashboard-states.astro`. Istniejące zdanie o shadcn w Hard rules zostaje.

#### 2. Skan w lint

**File**: `package.json`, `scripts/check-view-tokens.mjs` (nowy), ewentualnie wpis lint-staged

**Intent**: Zamienić jednorazowy grep w regułę, która pada w CI i przy commitach plików widoku, bez nowej zależności.

**Contract**: Skrypt Node bez zależności uruchamia wzorzec z Implementation Approach oraz sprawdzenie braku `bg-cosmic` na dokładnie tych plikach:

- `src/pages/dashboard.astro`
- `src/components/Topbar.astro`
- `src/components/dashboard/DashboardCard.tsx`
- `src/pages/dev/dashboard-states.astro`

Trafienie kończy proces kodem 1. `npm run lint` woła ten skrypt po ESLint, więc krok CI (`.github/workflows/ci.yml:20`) zostaje. Nie skanować `src/styles/global.css` ani `src/components/ui/**`. lint-staged dla `*.{ts,tsx,astro}` też uruchamia ten skrypt, obok obecnego `eslint --fix`. Nowa wtyczka ESLint nie wchodzi.

### Success Criteria:

#### Automated Verification:

- `npm run lint` uruchamia skan czterech plików widoku i na czystym drzewie kończy się kodem 0
- `npm test` kończy się kodem 0
- `npx astro check` kończy się kodem 0

#### Manual Verification:

- Tymczasowe `text-purple-300` w `src/pages/dashboard.astro` sprawia, że `npm run lint` kończy się kodem innym niż 0, po czym ta klasa jest cofnięta
- Sekcja `## UI` w `AGENTS.md` wskazuje tokeny, katalog komponentów, polecenie `npx shadcn@latest add` i ścieżkę kitchen sinka

**Implementation Note**: Po zielonych sprawdzeniach automatycznych zatrzymaj się na ręczne potwierdzenie, że tymczasowa klasa została cofnięta i lint znowu jest zielony.

---

## Testing Strategy

### Unit Tests:

- Istniejące testy Vitest (`npm test`) zostają zielone. Nowy test jednostkowy klas nie powstaje — bramką klas jest skan w `npm run lint`.

### Integration Tests:

- `scripts/smoke.mjs` bez zmian. Nie sprawdza kolorów ani zrzutów.
- `npx astro check` łapie wyspę i nową stronę tak, jak krok CI.

### Manual Testing Steps:

1. Zalogować się, wejść na `/dashboard` linkiem Dashboard i potwierdzić jasną kartę oraz dwa Sign out.
2. Tabem przejść oba Sign out i link paska. Pierścień ma być widoczny.
3. Wylogować się z karty, zalogować ponownie, wylogować się z paska.
4. Otworzyć `/` z sesją i bez sesji oraz, jako klient, `/consultations` i `/consultations/new`. Pasek jasny, tło stron granatowe.
5. Otworzyć `/dev/dashboard-states` bez sesji. Karta z `ada@example.com`, cztery N/A, hover i focus na przycisku.
6. Zrzut pulpitu i szerokości około 390px strony sinka.
7. Behawiorysta po wejściu na `/consultations` nadal ląduje na `/dashboard`. Sukces logowania nadal ląduje na `/`.

## Performance Considerations

Dwa małe montaże `client:load`: karta oraz przycisk w pasku. Karta nie pobiera danych. Astro i tak renderuje wyspę na serwerze, więc formularz POST jest w HTML zanim dojedzie JS. Osobny budżet wydajności nie obowiązuje.

## Migration Notes

Brak migracji danych. Po wdrożeniu `/dashboard` od razu jest jasny, a pasek na czterech ekranach od razu jest jasny. Cofnięcie to revert commitów tej zmiany. `bg-cosmic` w CSS nie znika, więc pozostałe strony nie tracą tła, gdy z widoku schodzi tylko klasa.

## References

- Research: `context/changes/ui-tokens-onboarding/research.md`
- Tożsamość zmiany: `context/changes/ui-tokens-onboarding/change.md`
- Tokeny: `src/styles/global.css:75-124`
- Button i pierścień: `src/components/ui/button.tsx:7-50`
- Wzorzec wyspy: `src/pages/auth/signin.astro:14`
- Bramka sesji: `src/middleware.ts:31-39`
- Redirect logowania (bez zmian): `src/pages/api/auth/signin.ts:19`
- CI: `.github/workflows/ci.yml:20-26`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Biblioteka

#### Automated

- [x] 1.1 `src/components/ui/card.tsx` istnieje i pochodzi z `npx shadcn@latest add card` — f78f723
- [x] 1.2 `git diff -- src/styles/global.css` jest pusty — f78f723
- [x] 1.3 `npm run lint` kończy się kodem 0 — f78f723
- [x] 1.4 `npx astro check` kończy się kodem 0 — f78f723

#### Manual

- [x] 1.5 W `src/components/ui/` nie ma drugiej, ręcznie napisanej karty obok pliku z CLI — f78f723

### Phase 2: Kontrakt tokenów

#### Automated

- [x] 2.1 `context/changes/ui-tokens-onboarding/tokens.md` istnieje i wskazuje `src/styles/global.css` jako źródło wartości — 32fc0a6
- [x] 2.2 `git diff -- src/styles/global.css` jest pusty — 32fc0a6

#### Manual

- [x] 2.3 Ze spisu da się odczytać dozwolone role i zakaz zmiany oklch bez wracania do czatu — 32fc0a6

### Phase 3: Widok

#### Automated

- [x] 3.1 Skan palety (wzorzec z Implementation Approach) na `src/pages/dashboard.astro`, `src/components/Topbar.astro` i `src/components/dashboard/DashboardCard.tsx` zwraca zero trafień, a żaden z tych plików nie zawiera `bg-cosmic` — f086bad
- [x] 3.2 `npm run lint` kończy się kodem 0 — f086bad
- [x] 3.3 `npx astro check` kończy się kodem 0 — f086bad

#### Manual

- [x] 3.4 Zalogowana osoba na `/dashboard` widzi jasną kartę (białe tło strony, karta `bg-card`, przycisk primary) oraz dwa napisy Sign out — f086bad
- [x] 3.5 Tabulator pokazuje pierścień na Sign out w karcie, na Sign out w pasku i na linkach paska — f086bad
- [x] 3.6 Welcome (`/`, z sesją i bez) oraz klient na `/consultations` i `/consultations/new` mają jasny pasek na granatowym tle strony — f086bad
- [x] 3.7 Sign out z karty i Sign out z paska kończą sesję przez POST — f086bad

### Phase 4: Stany

#### Automated

- [x] 4.1 `src/pages/dev/dashboard-states.astro` istnieje — 1bcaa40
- [x] 4.2 `/dev/dashboard-states` nie występuje w `PROTECTED_ROUTES` i `Topbar.astro` nie linkuje tej trasy — 1bcaa40
- [x] 4.3 Skan palety na `src/pages/dev/dashboard-states.astro` zwraca zero trafień i plik nie zawiera `bg-cosmic` — 1bcaa40
- [x] 4.4 `npx astro check` kończy się kodem 0 — 1bcaa40

#### Manual

- [x] 4.5 Wejście na `/dev/dashboard-states` bez sesji pokazuje kartę z `ada@example.com` oraz cztery powody N/A z kontraktu tej fazy — 1bcaa40
- [x] 4.6 Hover na Sign out w sinku zmienia tło przycisku, a Tab pokazuje pierścień `ring` — 1bcaa40
- [x] 4.7 Jest zrzut pulpitu i zrzut jednej szerokości mobilnej (około 390px) tej samej strony — 1bcaa40

### Phase 5: Straż

#### Automated

- [x] 5.1 `npm run lint` uruchamia skan czterech plików widoku i na czystym drzewie kończy się kodem 0
- [x] 5.2 `npm test` kończy się kodem 0
- [x] 5.3 `npx astro check` kończy się kodem 0

#### Manual

- [x] 5.4 Tymczasowe `text-purple-300` w `src/pages/dashboard.astro` sprawia, że `npm run lint` kończy się kodem innym niż 0, po czym ta klasa jest cofnięta
- [x] 5.5 Sekcja `## UI` w `AGENTS.md` wskazuje tokeny, katalog komponentów, polecenie `npx shadcn@latest add` i ścieżkę kitchen sinka
