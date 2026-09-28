---
project: behawiorysta
researched_at: 2026-09-28
recommended_platform: Cloudflare Workers
runner_up: Netlify
context_type: mvp
tech_stack:
  language: TypeScript
  framework: Astro 7 + React 19
  runtime: Cloudflare Workers (workerd) via @astrojs/cloudflare 14
---

## Recommendation

**Deploy on Cloudflare Workers.**

Behawiorysta to mała aplikacja rezerwacji (jeden behawiorysta, klienci w jednym kraju, request/response, Supabase i OpenRouter na zewnątrz) z budżetem „jak najtaniej” i trzema tygodniami pracy po godzinach. Workers Free mieści 10–100 tys. requestów miesięcznie w limicie 100 tys. requestów dziennie, bez opłaty bazowej. Repo ma już adapter `@astrojs/cloudflare` `^14.3.1`, Wrangler `4.131.1` i `output: "server"`. Zamiana na Netlify albo Render oznacza nowy adapter i inną pętlę wdrożenia w tym samym terminie. Wynik surowy: 5/5 kryteriów agenta. Ryzyka z kontroli (10 ms CPU na Free, nieaktualna wskazówka Pages, Wrangler za stary na `wrangler preview`, publiczne podglądy) zostają w rejestrze, a nie zmieniają platformy.

Źródła sprawdzone 2026-09-28: [cennik Workers](https://developers.cloudflare.com/workers/platform/pricing/), [adapter Astro](https://docs.astro.build/en/guides/integrations-guide/cloudflare/), [changelog limitu 64 MiB](https://developers.cloudflare.com/changelog/post/2026-09-04-increased-worker-size-limit/), [Worker Previews](https://developers.cloudflare.com/workers/previews/get-started/), [sekrety](https://developers.cloudflare.com/workers/configuration/secrets/), [rollback](https://developers.cloudflare.com/workers/versions-and-deployments/rollbacks/).

## Platform Comparison

Wagi z rozmowy: koszt obniża plany z opłatą bazową; jeden region nie premiuje edge; zewnętrzny Supabase i OpenRouter nie premiują bazy u tego samego vendora. Brak trwałych połączeń, więc platformy serverless zostają. Żadna platforma nie odpada przez runtime: wszystkie obsługują TypeScript.

Punktacja: Pass = 2, Partial = 1, Fail = 0. Maksimum 10. Krótka lista jest po wagach, nie po samym wyniku surowym.

| Platforma | CLI | Managed / serverless | Dokumentacja dla agenta | Stabilne API deployu | MCP | Razem |
|---|---|---|---|---|---|---|
| Cloudflare Workers | Pass | Pass | Pass | Pass | Pass | 10 |
| Vercel | Pass | Pass | Pass | Pass | Partial | 9 |
| Netlify | Pass | Pass | Partial | Pass | Pass | 9 |
| Railway | Partial | Pass | Pass | Pass | Pass | 9 |
| Fly.io | Pass | Pass | Pass | Pass | Fail | 8 |
| Render | Partial | Pass | Partial | Partial | Fail | 4 |

**Cloudflare Workers.** `npx wrangler deploy`, `npx wrangler rollback` i `npx wrangler tail` zamykają pętlę z terminala. Runtime jest zarządzany (`workerd`), dokumentacja ma `llms.txt`, a MCP Workers Builds jest opisany w docs (aktualizacja strony 2026-04-23). Plan Free: 100 tys. requestów dziennie, 10 ms CPU na wywołanie, brak opłaty za egress. Paid od 5 USD miesięcznie podnosi CPU. Od `@astrojs/cloudflare` v13 (projekt ma v14, Astro 7) wdrożenie na Pages nie jest wspierane. WebSockety są dostępne, ale ta aplikacja ich nie wymaga.

**Vercel.** CLI (`vercel`, `vercel --prod`), Functions i dokumentacja MDX spełniają cztery kryteria. MCP jest OAuth i w becie według kryteriów oceny; osobnej strony statusu nie udało się potwierdzić 2026-09-28. Hobby za 0 USD jest wyłącznie do użytku niekomercyjnego. Aplikacja umawia konsultacje behawiorysty, więc zgodny z regulaminem plan to Pro za 20 USD za seat. Do tego trzeba wymienić `@astrojs/cloudflare` na `@astrojs/vercel`. Przy priorytecie kosztu odpada z krótkiej listy mimo wysokiego wyniku.

**Netlify.** CLI i oficjalne MCP są na miejscu. Dokumentacja jest słabsza jako źródło markdown/`llms.txt` (Partial). Od kwietnia 2026 rozliczenie jest w kredytach: Free to 300 kredytów miesięcznie i twardy limit, po którym projekty stają do końca miesiąca. Deploy produkcyjny kosztuje 15 kredytów, transfer 20 kredytów za GB, compute 10 kredytów za GB-godzinę, requesty 2 kredyty za 10 tys. Osobisty plan to 9 USD za 1000 kredytów. Brak zimnego startu. SSR Astro wymaga `@astrojs/netlify`.

**Railway.** `railway up` i `railway logs` oraz `llms.txt` i MCP (lokalne i zdalne, OAuth) są mocne. Rollback jest opisany jako akcja w panelu, stąd Partial przy CLI. Po trialu (5 USD jednorazowo, 30 dni) plan Free daje 1 USD kredytu miesięcznie i zero własnych domen. Hobby za 5 USD obejmuje 5 USD zużycia i dwie domeny. Aplikacja musiałaby przejść na `@astrojs/node` i proces cały czas włączony. Trial bez weryfikacji GitHub ogranicza ruch wychodzący, a Supabase i OpenRouter tego ruchu potrzebują.

**Fly.io.** `flyctl`, dokumentacja MDX i `fly deploy` są kompletne. Maszyny są zarządzane, ale to kontenery z Dockerfile, nie serverless. Własnego MCP nie potwierdzono. Dla nowych kont nie ma darmowego limitu (stary przydział został tylko dla planów sprzed 7 października 2024). Najmniejsza maszyna `shared-cpu-1x` / 256 MB to około 2 USD miesięcznie, gdy działa całą dobę. Dedykowane IPv4 to dodatkowe 2 USD. Astro SSR idzie przez `@astrojs/node` i Dockerfile generowany przez `fly launch`. Przy request/response i priorytecie kosztu to za dużo operacji jak na MVP.

**Render.** Darmowy web service zasypia po 15 minutach bez ruchu i wstaje około minuty; limit to 750 godzin instancji miesięcznie. Statyczny hosting jest darmowy i bez usypiania, ale ten projekt ma `output: "server"`, więc to web service i adapter Node. Operacje idą głównie przez Git, dashboard i deploy hooki (Partial). MCP nie potwierdzono. Od 23 kwietnia 2026 obowiązują nowe plany workspace; opłata workspace Hobby wynosi 0 USD, a usypianie dotyczy darmowego compute.

### Shortlisted Platforms

#### 1. Cloudflare Workers (Recommended)

Wygrywa kosztem przy tym ruchu, dopasowaniem do adaptera już obecnego w repo i pełną pętlą CLI. Jeden region i zewnętrzna baza nie wymagają nic, czego Workers nie umie: aplikacja woła Supabase i OpenRouter po HTTPS. Edge jest skutkiem platformy, nie wymaganiem produktu.

#### 2. Netlify

Drugi wynik po wagach, bo da się zostać przy 0 USD i bez zimnego startu, a MCP jest oficjalne. Luka wobec Workers: twarde 300 kredytów (częste deploye produkcyjne same zjadają zapas) oraz wymiana adaptera i konfiguracji środowisk w trakcie trwającego MVP.

#### 3. Render

Trzeci, bo darmowy compute istnieje i priorytetem jest koszt. Luka: minutowy zimny start po kwadransie ciszy psuje umawianie wizyty, a agent ma słabsze CLI i brak potwierdzonego MCP. Zostaje jako opcja, gdy Workers okaże się zablokowany, a Netlify zje kredyty.

## Anti-Bias Cross-Check: Cloudflare Workers

### Devil's Advocate — Weaknesses

1. Plan Free daje 10 ms CPU na wywołanie. Middleware sesji i odczyt Supabase w SSR potrafią przekroczyć ten budżet i zwrócić błąd 1102. Płatna podłoga to wtedy 5 USD miesięcznie, a nie 0 USD.
2. `context/foundation/tech-stack.md` zapisuje cel `cloudflare-pages`. Adapter w tym repo (`@astrojs/cloudflare` 14 na Astro 7) nie wdraża na Pages. CI zbudowane według hand-offu opublikuje artefakt w miejsce, którego adapter już nie obsługuje.
3. Worker Previews (`npx wrangler preview`) wymagają Wranglera 4.135.0 lub nowszego (docs, 2026-09-28). Lockfile trzyma `wrangler@4.131.1`. Nowe podglądy branchy nie wystartują na tej wersji.
4. `npx wrangler secret put` tworzy nową wersję i od razu wysyła ją na produkcję. `npx wrangler rollback` nie przywraca poprzednich wartości sekretów.
5. Adresy podglądu na `workers.dev` są publiczne, dopóki nie ma Cloudflare Access. Ankieta psa na preview jest wtedy dostępna bez logowania do panelu Cloudflare.

### Pre-Mortem — How This Could Fail

Pół roku później decyzja wygląda jak pomyłka, choć platforma była właściwa. Hand-off ze stosu został wykonany dosłownie: GitHub Actions publikuje na Pages, build jest zielony, a domena dalej wskazuje stary projekt albo pusty Pages. Lokalnie `astro dev` chodzi na `workerd` i ciasteczka Supabase działają, a na Free każdy chroniony widok dostaje 1102, bo CPU przekracza 10 ms. Ktoś podnosi plan do 5 USD i wgrywa klucz OpenRouter przez `wrangler secret put`, co od razu wchodzi na produkcję. Preview branchy nie dziedziczy sekretów, więc test „działa u mnie” i pada na URL-u. Rollback cofa bundle, zostawia nowy sekret i przez godzinę produkcja woła zły klucz. Klienci widzą błąd limitu albo formularz, który nie zapisuje terminu. Trzy tygodnie po godzinach schodzą na dwa cele wdrożenia i limit CPU, a ankieta i kalendarz stoją.

### Unknown Unknowns

- Od 4 września 2026 limit rozmiaru Workera to 64 MiB nieskompresowane na Free i na Paid. Starszy limit 3 MB po gzip na Free już nie obowiązuje. `npx wrangler deploy --dry-run` pokazuje `Total Upload` jako miarę, która się liczy.
- Od Astro 6 środowisko Cloudflare jest wybierane przy buildzie. Wzorzec to `CLOUDFLARE_ENV=nazwa astro build && npx wrangler deploy`. Sama flaga `wrangler deploy --env` ze Astro 5 nie wybiera środowiska.
- Lokalna zgodność z produkcją jest w `npm run dev` i w `npm run build && npm run preview` (oba na `workerd`). Osobne `wrangler pages dev` nie jest pętlą tego startera.
- Podglądy nie dziedziczą sekretów produkcji. `SUPABASE_URL`, `SUPABASE_KEY` i klucz OpenRouter trzeba nadać na preview osobno.
- Domyślne `imageService: 'cloudflare-binding'` (od zmiany w adapterze) potrafi przy deployu założyć binding Cloudflare Images, nawet gdy aplikacja prawie nie przetwarza obrazów.
- Zapis sesji Astro idzie w KV o nazwie `SESSION` i jest eventually consistent do około 60 sekund między regionami. Ten projekt trzyma sesję w ciasteczkach Supabase (`@supabase/ssr`), nie w `Astro.session`. Włączenie sesji Astro później zmienia ten model bez ostrzeżenia w UI.
- `wrangler.jsonc` w katalogu głównym (`main`, `nodejs_compat`, `assets.directory: ./dist`) jest konfiguracją, której używa `npx wrangler deploy` z README. Równoległy plik wygenerowany pod `dist/server/` przy innym `--config` w CI wdraża inny artefakt.

## Operational Story

- **Preview deploys**: Na Wranglerze 4.131.1 podgląd wersji powstaje przez `npx wrangler versions upload` (URL wersji na `workers.dev`, funkcja od Wranglera 3.91). Nowe `npx wrangler preview` (osobne sekrety i bindingi branchy) wymaga podbicia zależności do `>=4.135.0`. URL-e są publiczne; Cloudflare Access zamyka je logowaniem. Sekrety preview ustawia się osobno, bo nie kopiują się z produkcji. Buildy z forków PR-ów nie były weryfikowane w tym badaniu — przed włączeniem Workers Builds trzeba sprawdzić, czy fork dostaje preview.
- **Secrets**: Nazwy i wartości żyją jako sekrety Workera (`npx wrangler secret put SUPABASE_URL`, to samo dla `SUPABASE_KEY` i później klucza OpenRouter). Wartości nie wracają w `npx wrangler secret list` ani do gita. `secret put` publikuje nową wersję od razu. Odczyt wartości po zapisie nie jest dostępny w CLI; rotacja to ponowne `secret put` przez osobę z uprawnieniem Workers Secrets na tym koncie. Token agenta powinien obejmować jednego Workera, bez rozliczeń i bez sekretów innych projektów.
- **Rollback**: `npx wrangler rollback` albo `npx wrangler rollback <version-id>` przełącza 100% ruchu na wcześniejszą wersję od razu, w granicach 100 ostatnich publikacji. Nie cofa sekretów, danych Supabase ani migracji. Usunięty binding (KV, R2, kolejka) blokuje rollback na wersję, która go używała.
- **Approval**: Człowiek zatwierdza pierwszy deploy produkcyjny, `wrangler secret put` / rotację klucza Supabase i OpenRouter oraz każdą zmianę schematu w Supabase. Agent może bez nadzoru: `npm run build`, `npx wrangler deploy --dry-run`, `npx wrangler versions list`, `npx wrangler tail`. Deploy na produkcję i usunięcie Workera zostają przy człowieku, dopóki token nie jest świadomie zawężony do środowiska nieprodukcyjnego.
- **Logs**: `npx wrangler tail` strumieniuje logi runtime. Filtr: `npx wrangler tail --status error`. Dla agenta: `npx wrangler tail --format json`. W `wrangler.jsonc` jest `observability.enabled`. Na Free Workers Logs to 200 tys. zdarzeń dziennie i retencja 3 dni.

## Risk Register

| Risk | Source | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| SSR z sesją Supabase przekracza 10 ms CPU na Free (1102) | Devil's advocate | M | H | Po pierwszym deployu zmierzyć CPU w `wrangler tail` na logowaniu i kalendarzu. Jeśli 1102 się powtarza, włączyć Workers Paid (5 USD) z limitem CPU w `wrangler.jsonc`, zanim dojdą klienci. |
| CI wdraża na Pages, bo tak zapisano w `tech-stack.md` | Devil's advocate | H | H | Jedyny cel to Workers: `npm run build` i `npx wrangler deploy` z katalogu głównego. Nie używać `wrangler pages deploy`. |
| `wrangler preview` nie działa na 4.131.1 | Unknown unknowns | H | M | Zostawić podgląd wersji przez `wrangler versions upload`, dopóki lockfile nie przejdzie na Wrangler `>=4.135.0`. |
| `secret put` publikuje produkcję, rollback nie cofa sekretu | Devil's advocate | M | H | Klucze Supabase i OpenRouter wgrywa człowiek. Przed rotacją zapisać `wrangler deployments list`, żeby wiedzieć, która wersja kodu była aktywna. |
| Publiczny preview z ankietą psa | Devil's advocate | M | H | Włączyć Cloudflare Access na hostach preview, zanim na podglądzie pojawią się prawdziwe dane. |
| Podgląd bez sekretów woła Supabase w próżnię | Unknown unknowns | H | M | Osobny zestaw `wrangler secret put` na preview albo osobny projekt Supabase do testów. |
| Mylone pliki Wranglera (root vs `dist/server`) | Unknown unknowns | M | H | Deploy tylko `npx wrangler deploy` bez `--config`, zgodnie z README. W logu buildu sprawdzić nazwę Workera `10x-astro-starter`. |
| Binding Cloudflare Images zakładany domyślnie | Unknown unknowns | L | L | Jeśli pojawią się opłaty za Images, ustawić w adapterze `imageService: 'passthrough'` albo `'compile'`. |
| Sesja Astro na KV z opóźnieniem do 60 s | Unknown unknowns | L | M | Zostawić sesję w ciasteczkach Supabase. Nie włączać `Astro.session` bez osobnej decyzji. |
| Stary limit 3 MB gzip odrzuca deploy w czyjejś pamięci, choć limit już nie obowiązuje | Research finding | L | L | Przed deployem `npx wrangler deploy --dry-run` i odczyt `Total Upload` względem 64 MiB (changelog 2026-09-04). |

## Getting Started

Wersje z repo: `astro` `^7.3.2`, `@astrojs/cloudflare` `^14.3.1`, `wrangler` `4.131.1` (lockfile). Adapter i `wrangler.jsonc` już są. Lokalny serwer `npm run dev` używa `workerd`, więc osobny `wrangler dev` nie jest tu krokiem startowym.

1. Zalogować Wranglera z katalogu projektu: `npx wrangler login`. Konto Cloudflare może zostać na planie Free.
2. Zbudować i wysłać Workera (nie Pages): `npm run build`, potem `npx wrangler deploy`. Nazwa z `wrangler.jsonc` to `10x-astro-starter`.
3. Sekrety, świadomie na produkcji: `npx wrangler secret put SUPABASE_URL` i `npx wrangler secret put SUPABASE_KEY`. Klucz OpenRouter tym samym poleceniem, gdy wejdzie do schematu `astro:env/server`.
4. Sprawdzić runtime: `npx wrangler tail`. Wejść w logowanie i chroniony widok. Przy powtarzalnym 1102 podnieść plan do Workers Paid.
5. Podgląd lokalny przed kolejnym deployem: `npm run build` i `npm run preview`. Na tej wersji Wranglera nie używać `npx wrangler preview`.

## Out of Scope

The following were not evaluated in this research:

- Docker image configuration
- CI/CD pipeline setup
- Production-scale architecture (multi-region, HA, DR)
