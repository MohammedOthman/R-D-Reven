# Reven Brand System — working summary

Source: `Reven Brand System Guidelines v1.0` (July 2026, internal), plus the master
mark/asset files shipped alongside it. This file is a working summary for
engineering — the pptx is still the source of truth if the two ever disagree.
Raw assets live in [`docs/brand/assets`](./assets).

## Belief and positioning

- **Category:** The Partner Revenue Operating System.
- **Positioning line:** "The operating system for revenue shared between companies."
- **Tagline:** "Turning partnerships from a cost center into a profit center."
- **Belief:** "Partnerships aren't a relationship problem. They're a revenue problem."
- **Voice:** confident, declarative, literal, no hedging. Institutional, not playful.

These three lines (category, positioning, tagline) are fixed per the brand doc —
quote them exactly, never paraphrase, in product copy or marketing.

## Color — one saturated hue

| Token          | Hex                   | Role                                            |
| -------------- | --------------------- | ----------------------------------------------- |
| Ink            | `#0F1629`             | Primary text & logo                             |
| Canvas         | `#FBFAF7`             | Default background — **never pure white**       |
| Card White     | `#FFFFFF`             | Elevated surfaces on canvas                     |
| Accent Blue    | `#2C5BFF`             | **The only saturated hue** — signal/interactive |
| Accent Deep    | `#1E47E0`             | Hover/pressed, gradient partner                 |
| Accent Pale    | `#8DA4FF` / `#AEC5FF` | Headline highlights on dark panels              |
| Muted body     | `#5B6172`             | Body copy                                       |
| Muted caption  | `#6B7180`             | Captions                                        |
| Muted tertiary | `#8A8F9C`             | Tertiary / mono labels                          |
| Muted micro    | `#9AA3B5`             | Micro-labels                                    |
| Caution        | `#C98A1B`             | Status only, sparingly                          |
| Alert          | `#C0392B`             | Status only, sparingly                          |
| Positive       | `#1F8A5B`             | Status only, sparingly                          |

Rule from the doc: **blue is the only saturated hue in the system.** Everything
else is navy, cream or gray. Status colors exist but must never be used as a
primary/decorative color.

Implemented as CSS custom properties + a Tailwind v4 `@theme` in
[`packages/config/tailwind/theme.css`](../../packages/config/tailwind/theme.css).

## Typography — three typefaces, three jobs, never mixed

| Role    | Typeface      | Weights  | Usage                                                                                   |
| ------- | ------------- | -------- | --------------------------------------------------------------------------------------- |
| Display | Sora          | 700, 800 | Headlines, stat numbers, nameplates. Tracking −0.02 to −0.035em.                        |
| Body    | Manrope       | 400–700  | All reading copy, labels, quoted lines.                                                 |
| Label   | IBM Plex Mono | 400–600  | Eyebrows, indexes, footer meta. Always uppercase, tracked 0.08–0.24em. Never body copy. |

Arabic has no typeface specified in the brand doc — see
[`docs/brand/DECISIONS.md`](./DECISIONS.md) for the conservative pairing chosen.

## Layout anatomy (deck convention)

The brand doc's layout rhythm (104px side margins, ~80px top, ~108px bottom,
mono eyebrow always before the headline, exactly one accent-colored clause per
headline, footer with wordmark + 2-digit index) is calibrated for full-bleed
16:9 slides. It is **not applied literally** to the product application — see
`docs/brand/DECISIONS.md` for how it's adapted to an app shell.

## Backgrounds — exactly three surfaces

1. **Flat Canvas** `#FBFAF7` — default, ~80% of surfaces.
2. **Radial Wash** `#F0EAFF → #FBFAF7` — cover/transition moments, ~15%.
3. **Deep Navy** `#0F1629` (or `#1F1740 → #0F1629`) — emphasis panels, ~5%.

In the product, Deep Navy is used for the sidebar; Flat Canvas is the default
content background; Card White is used for elevated surfaces (cards, modals,
table rows). No radial wash is used in the app shell yet — it's reserved for
future marketing/onboarding moments.

## Components referenced in the brand doc

Pill (default/selected), dark contrast panel, stat card, step chips,
comparison/gap bar, browser chrome, CTA/callout bar. All except "comparison/gap
bar" and "browser chrome" and "CTA/callout bar" (deck-only chrome) have direct
equivalents in [`packages/ui`](../../packages/ui).

## Motif

A quiet node-and-flow constellation: 1–1.4px stroke, opacity 0.15–0.55, Accent
Blue only, dark-navy surfaces only, at most one glowing emphasis node per
surface. Decorative only — not used for functional UI in this phase (no
current screen has a dark-navy canvas large enough to host it tastefully; the
sidebar's flat navy fill doesn't count). Revisit when a dashboard/cover-style
surface exists.

## Logo

- One wordmark, one accent chip breaking the R's counter and the foot of the
  n, trailing period always Accent Blue. No alternate lockups.
- Minimum size 120px screen / 25mm print. Clearspace ≥ chip height.
- Reversed (white) mark on navy/photo; monochrome mark for single-ink contexts.
- Never recolored, outlined, glowed, distorted or placed on a busy backdrop.

Master files are in `docs/brand/assets/` (`reven-mark.svg`,
`reven-mark-white.svg`, `reven-mark-mono-ink.svg`, `reven-mark-mono-white.svg`)
and copied into `apps/web/public/brand/` for actual use in the product.
