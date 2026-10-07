# Kontrakt tokenów — onboarding

Źródło wartości: `src/styles/global.css`. Role są zdefiniowane w `:root` i `.dark`, a `@theme inline` publikuje je jako `--color-*`. `components.json` ma `baseColor: neutral`.

W tej zmianie nikt nie edytuje tych wartości oklch. Nie edytować `src/styles/global.css`.

## Wartości (`:root`)

| Rola | Właściwość | Wartość |
| --- | --- | --- |
| background | `--background` | `oklch(1 0 0)` |
| foreground | `--foreground` | `oklch(0.145 0 0)` |
| card | `--card` | `oklch(1 0 0)` |
| card-foreground | `--card-foreground` | `oklch(0.145 0 0)` |
| primary | `--primary` | `oklch(0.205 0 0)` |
| primary-foreground | `--primary-foreground` | `oklch(0.985 0 0)` |
| muted-foreground | `--muted-foreground` | `oklch(0.556 0 0)` |
| border | `--border` | `oklch(0.922 0 0)` |
| ring | `--ring` | `oklch(0.708 0 0)` |

## Wartości (`.dark`)

| Rola | Właściwość | Wartość |
| --- | --- | --- |
| background | `--background` | `oklch(0.145 0 0)` |
| foreground | `--foreground` | `oklch(0.985 0 0)` |
| card | `--card` | `oklch(0.205 0 0)` |
| card-foreground | `--card-foreground` | `oklch(0.985 0 0)` |
| primary | `--primary` | `oklch(0.922 0 0)` |
| primary-foreground | `--primary-foreground` | `oklch(0.205 0 0)` |
| muted-foreground | `--muted-foreground` | `oklch(0.708 0 0)` |
| border | `--border` | `oklch(1 0 0 / 10%)` |
| ring | `--ring` | `oklch(0.556 0 0)` |

## Publikacja (`@theme inline`)

| Token Tailwind | Źródło |
| --- | --- |
| `--color-background` | `var(--background)` |
| `--color-foreground` | `var(--foreground)` |
| `--color-card` | `var(--card)` |
| `--color-card-foreground` | `var(--card-foreground)` |
| `--color-primary` | `var(--primary)` |
| `--color-primary-foreground` | `var(--primary-foreground)` |
| `--color-muted-foreground` | `var(--muted-foreground)` |
| `--color-border` | `var(--border)` |
| `--color-ring` | `var(--ring)` |

## `bg-cosmic`

Utility zostaje w CSS (`src/styles/global.css:113-115`). Po fazie 3 nie występuje w plikach widoku.

```css
@utility bg-cosmic {
  background-image: linear-gradient(to bottom, #0a0e1a, #0f1529, #0a0e1a);
}
```

## Dozwolone utility widoku

`bg-background`, `text-foreground`, `bg-card`, `text-card-foreground`, `text-muted-foreground`, `border-border`, `bg-primary`, `text-primary-foreground`, `text-primary`, `ring-ring`, oraz `rounded-xl` tam, gdzie promień nie bierze się z komponentu Card.
