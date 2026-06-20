# De-Slop the Durare UI (warm green + light brown)

## What makes the current UI feel "AI slop"

From `prediction-card.tsx`, `app-shell.tsx`, `styles.css`:

1. **One generic sans for everything** (Public Sans 400–800) — no editorial contrast.
2. **Rounded-everything** — `rounded-full` on chips, ribbons, confidence bars, nav pills; `rounded-xl` on cards and CTAs. The universal "friendly SaaS pill" tic.
3. **Soft pastel surfaces + drop shadows + radial glow** (`durare-glow`, `card-elevated`) — Figma-template gloss.
4. **Whole-card tonal recoloring** (primary/warning/urgent dye the chip, band, button, border, ribbon) — screams instead of informs.
5. **Decorative flourishes** — floating ribbons, sparkles icon next to "Why this forecast?", gradient CTAs.
6. **Uppercase micro-labels with wide tracking everywhere** — Stripe-clone tic.
7. **Boldness inflation** — `font-extrabold` on logo + numbers, `font-bold` on every tile, so no real hierarchy.
8. **Symmetric same-size card grid** with no rhythm — every card identical.

## Design direction — calm green + warm light brown, friendly not industrial

Editorial-but-cozy. Warm paper surfaces, a soft humanist serif for headings (not a clinical grotesk), restrained rounding (gentle, not pill), one accent indicator instead of full-card dye, generous whitespace.

### Palette (replaces current tokens in `src/styles.css`)
Warm cream paper + moss green + light walnut brown.

- `--background` cream `#FBF7F0`
- `--surface-low` `#F3ECDF` (warm beige)
- `--card` `#FFFDF8`
- `--border` `#E4D9C5` (warm hairline)
- `--foreground` deep cocoa `#2B221A`
- `--muted-foreground` `#7A6A55`
- `--primary` moss green `#3F6B4E` (calm, not forest-black)
- `--primary-soft` `#D9E4D2`
- `--accent` light walnut `#B08968`
- `--accent-soft` `#E8D8C4`
- `--warning` warm amber `#C8862A`, `--warning-soft` `#F1E1BE`
- `--destructive` terracotta `#B5482E` (warmer than current red), `--destructive-soft` `#F2D6CA`
- `--success` sage `#5C8A66`

Dark mode tokens adjusted to match (deep moss bg, cream foreground) but no separate redesign pass.

### Type system (replace Public Sans)
- **Display / headings:** `Fraunces` (variable humanist serif — warm, slightly soft, very friendly)
- **UI / body:** `Inter Tight` (modern, neutral, pairs cleanly with Fraunces)
- **Tabular numerals:** `JetBrains Mono` for the raw quantity in tiles, confidence endpoints, distances
- Load via `<link>` tags in `src/routes/__root.tsx` (Tailwind v4 forbids URL `@import` in `src/styles.css`)
- Register as `--font-display`, `--font-sans`, `--font-mono` in `@theme`
- Headings use `font-display`; body/UI default to `font-sans`. Kill `font-extrabold` — hierarchy via family + size.

### Radius — soften, don't industrialize
- `--radius` from `0.875rem` (14px) → `0.5rem` (8px). Cards feel gentle, not pill-shaped or razor-edged.
- Cards: `rounded-lg`
- Buttons / inputs: `rounded-md`
- Chips / tags: `rounded-md` (no more `rounded-full` chips)
- Keep `rounded-full` ONLY for: avatars, the point-estimate marker dot, and icon-only circular buttons
- Confidence bar: thinner (`h-2`) track with slightly rounded ends and a small vertical tick marker

### Surface & shadow
- Remove `durare-glow` and the soft drop-shadow on `card-elevated`. Cards = warm white on cream, `1px` warm hairline border, no shadow (or a single very subtle `0 1px 0` warm shadow).
- Replace whole-card tone-dyeing with a **3px left accent bar** (moss/amber/terracotta) + a small inline status tag in the header row. Background stays warm white regardless of urgency.
- Remove the floating ribbon ("Urgent" / "Expiring Soon") — becomes an inline tag.

### Layout & rhythm (coordinator)
- Featured "next pickup" card at top (richer detail) + dense list rows below for the rest. Asymmetric, not a uniform 3-col grid.
- Inside each card: 12-col grid; quantity on the left in mono, meta on the right. Drop the centered two-tile pair.
- Sentence-case labels in `text-muted-foreground` at normal tracking. Reserve uppercase for the single status tag.

### Decoration to remove
- Sparkles icon on "Why this forecast?" → plain chevron
- All `bg-gradient-*`, `durare-glow`, decorative flourishes
- Soft drop shadows on cards, buttons, marker dots
- Ribbon tags

### Files touched
- `src/styles.css` — palette, font tokens, radius, drop `durare-glow`, simplify `card-elevated` to border-only, dark-mode parity
- `src/routes/__root.tsx` — `<link>` tags for Fraunces + Inter Tight + JetBrains Mono (with `preconnect`)
- `src/components/prediction-card.tsx` — remove ribbon, whole-card tone styling, `rounded-full`; add left accent bar, serif heading, mono numbers, inline status tag
- `src/components/confidence-bar.tsx` — thinner track, tick marker, mono endpoints
- `src/components/app-shell.tsx` — softer logo mark (`rounded-md`, not `rounded-xl`), remove `rounded-full` nav pills, lighter weight nav text, serif wordmark
- `src/components/ui/button.tsx` — default `rounded-md`, no `shadow`
- `src/components/ui/card.tsx` — `rounded-lg`, border-only, no shadow
- `src/components/ui/badge.tsx` — `rounded-md` (was likely `rounded-full`)
- `src/routes/_authenticated/coordinator.tsx` — featured + dense-row layout

## Out of scope
- No changes to data flow, model wiring, predictions, routing logic
- No new npm deps (fonts via `<link>`)
- No dark-mode visual redesign beyond token parity

## Validation
Build, then open `/coordinator`, `/retailer`, `/pickups` in preview. Screenshot each. Confirm: no `rounded-full` outside the allowlist, no `font-extrabold` survivors, no `durare-glow`/ribbon/sparkles, fonts loaded (Fraunces visible on headings).
