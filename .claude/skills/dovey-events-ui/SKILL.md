---
name: dovey-events-ui
description: Design system and UI rules for the Dovey Events website (event décor & styling, Ghana). Use whenever creating or changing any page, component, style, animation, icon or copy on the Dovey Events site, so new work matches the existing look (ink, ivory and orchid; Cormorant + Manrope; calm, elegant motion) and works on phones.
---

# Dovey Events — UI skill

Dovey Events styles weddings, bridal parties, birthdays, baby christenings and funerals in Ghana. The site sells packages by guest count (50 / 100 / 150 / 200) and takes a deposit through Paystack (Mobile Money or card). Most customers arrive **on a phone**.

The feel: **refined, editorial, quietly luxurious**, like a beautifully dressed room at night. Dark ink and warm ivory, one orchid accent, a high-contrast serif for display, generous space, slow confident motion. Never loud, never cute.

Tagline, used verbatim: **"Where every detail matters."**

---

## 1. Brand & voice

- Name: **Dovey Events**. In the header it's the purple "D" logo (`/img/dovey-logo.png`), then **Dovey** in the display serif, then **EVENTS** in small spaced caps.
- Voice: warm, assured, brief. Speak to the customer ("your date", "your guests"). British spelling (colour, centrepieces). Prices in cedis: `GH₵14,000` (use `money()` from `public/js/common.js`, which takes **pesewas**).
- Headings pair plain words with one *italic accent word* in orchid: `Where every detail <em>matters</em>.`, `Let's hold your <em>date</em>`.
- Never invent testimonials, awards, client names or photos. Real content comes from the owner.
- Funerals are one of the occasions: keep copy about them respectful and never playful.

## 2. Colour tokens

Defined in `public/css/styles.css` `:root`. Always use the variable, never a raw hex, except the few light-on-dark tints noted below.

| Token | Value | Use |
| --- | --- | --- |
| `--ink` | `#0b0d12` | Dark surfaces (hero, band, summary, menu), primary text on light |
| `--ink-soft` | `#3a3f4b` | Secondary text on light |
| `--paper` | `#f6f1ea` | Page background (warm ivory), text on dark |
| `--paper-2` | `#efe8de` | Admin background, subtle fills |
| `--card` | `#fffdf9` | Cards, inputs |
| `--line` / `--line-strong` | `#e2d9cc` / `#cfc3b2` | Hairlines, borders |
| `--muted` | `#6f6a62` | Captions, labels, hints |
| `--accent` | `#9d56c2` | Orchid, sampled from the logo. The one accent: italic words, CTAs, icons, focus rings |
| `--accent-deep` | `#7a3a9e` | Eyebrow labels, accent text on light backgrounds |
| `--ok`/`--ok-bg`, `--warn`/`--warn-bg`, `--bad`/`--bad-bg` | greens / ambers / reds | Status pills and alerts only |

Light orchid tints for text **on dark backgrounds only**: `#cfa6e6` (eyebrows, accents), `#d9b6ee` (large amounts). Hover for accent buttons: `#ad69d1`.

Rules: one accent colour. Dark sections are ink with a soft orchid radial glow, never flat black and never a purple gradient fill. No new hues without a reason.

## 3. Typography

- Display: **Cormorant** 500 / 600 / italic 500 (`--font-display`). All headings, big numbers, prices, the marquee, menu links.
- Body/UI: **Manrope** 400 / 500 / 600 (`--font-body`). Everything else.
- Loaded from Google Fonts in each page's `<head>` (the only allowed external stylesheet).
- Scale: `h1` `clamp(2.8rem, 8vw, 6.2rem)`; `h2` `clamp(2.1rem, 4.6vw, 3.4rem)`; `h3` `1.65rem`; `.lede` `clamp(1.05rem, 1.6vw, 1.2rem)` muted; body 16px / 1.6.
- Headings: weight 500, line-height 1.05, letter-spacing −0.01em.
- **Eyebrow** (`.eyebrow`): 0.74rem, 600, 0.22em tracking, uppercase, accent-deep, with a 28px hairline before it. Used above most section headings.
- Small labels (`dt`, stat labels): 0.72rem, 600, 0.12–0.14em tracking, uppercase, muted.
- Numbers in tables and amounts: `font-variant-numeric: tabular-nums`.

## 4. Layout

- Container: `.wrap` = `min(100% − 2 × gutter, 1160px)`, gutter `clamp(16px, 5vw, 48px)`.
- Sections: `.section` padding `clamp(72px, 12vw, 140px)` (64px on phones); `.flush-top` removes the top.
- `.section-head`: eyebrow + h2 on the left, lede on the right (stacked below 860px).
- Radius: `--radius` 14px (cards), `--radius-sm` 9px (inputs, chips' inner), pills 999px.
- Shadow: `--shadow` only; soft and low. No heavy drop shadows.
- Grids of equal cards use the **hairline grid** pattern: container background `--line`, `gap: 1px`, cards `--card` (see `.packages`, `.stats`).
- Easing everywhere: `--ease` = `cubic-bezier(0.22, 1, 0.36, 1)`.

## 5. Components (reuse before inventing)

- **Buttons** `.btn` (pill, min-height 48px): default ink; `.btn-accent` orchid (main CTA); `.btn-light` on dark; `.btn-ghost` / `.btn-ghost-light` outlines; `.btn-sm`, `.btn-block`. CTA labels end with `<span class="arrow" aria-hidden="true">→</span>`, which nudges right on hover. Busy state: `setBusy(button, true, 'Label…')`.
- **Choice cards** `.choice` (radio/checkbox cards with custom indicator) and **chips** `.chip` (pill radios, used for occasions).
- **Fields** `.field` > `label` + `.input` + `.hint` + `.field-error[data-error-for]`; `.has-error` for invalid state. Inputs are **16px** so iOS doesn't zoom.
- **Package card** `.package` inside `.packages`: italic index "No. 01", h3, description, price block.
- **Ticket** `.ticket` (confirmation): head, dashed perforation with punched notches, `dl.details` two-column grid.
- **Dark summary** `.summary` (booking quote), **band** `.band` (dark quote section), **alerts** `.alert-ok/.alert-bad`, **status pills** `.pill-<status>`.
- Build DOM with `h()` from `common.js` (never string-concatenate user data into HTML).

## 6. Icons

- Occasion icons live in `public/js/icons.js`: `wedding` (rings), `bridal` (bouquet), `birthday` (cake), `christening` (dove), `funeral` (candle), `other` (sparkle).
- Style: 24×24 grid, **1.5px stroke**, round caps and joins, `stroke="currentColor"`, no fills except tiny dots. They sit in the text colour (accent on light, `#cfa6e6` on dark).
- Use `occasionIcon(id)` in JS, or `<span data-occasion-icon="id"></span>` plus `hydrateOccasionIcons()` in HTML.
- New icons must match: same grid, stroke, simplicity. Always `aria-hidden="true"` next to a visible label. No emoji as icons, no icon fonts, no filled or multicolour icons.

## 7. Motion

Motion is **slow, smooth and purposeful**, like fabric settling. Stack: GSAP + ScrollTrigger + SplitText and Lenis, served from `/vendor/` (copied by `scripts/vendor.js`), orchestrated by `public/js/motion.js`.

Opt in with attributes; don't hand-write new scroll animations:

| Attribute | Effect |
| --- | --- |
| `data-reveal="lines"` | Headline rises line by line from behind a mask |
| `data-reveal="up"` | Fades up 40px |
| `data-reveal="stagger"` | Children fade up in sequence (set `aria-busy="true"` while loading, then call `reveal()`) |
| `data-count="<pesewas>"` | Counts up to a cedi amount when revealed |
| `data-magnetic` | Main CTAs lean toward the pointer (mouse only) |
| `data-cursor="Label"` | Custom cursor grows and shows the label (mouse only) |

Existing signature moments, to keep: first-visit intro (logo and "Dovey" letters, then the curtain lifts; once per session), purple curtain page transitions (native View Transitions in `motion.css`), the **draped silk + event lights** hero shader (`public/js/silk.js`), the occasions marquee (speeds up with scroll), the floating action bar, and the phone menu's circular reveal.

Rules:
- Durations 0.6–1.2s, ease `expo.out` / `--ease`. Stagger 0.06–0.1s. Nothing bouncy except magnetic buttons.
- Animate `transform` and `opacity` only.
- Every effect must respect `prefers-reduced-motion` (`boot.js` skips the motion class; CSS falls back to static).
- Content must never depend on JS to become visible: `[data-reveal]` has a CSS fallback timer.
- Removed on purpose, don't bring back: the 3D ribbon hero and the rotating circular text badge.

## 8. Phones first

Test every change at **390×844 with touch emulation** (Chrome DevTools device mode, or CDP `Emulation.setDeviceMetricsOverride` with `mobile: true`). Plain headless `--window-size` can't go below ~492px and gives misleading shots.

- No horizontal scroll, ever (`scrollWidth === innerWidth`).
- Tap targets ≥ 44px; primary actions full-width (`min-height: 54px` in the hero).
- Below 720px the header shows only the logo; navigation is the floating **Menu** pill (`public/js/nav.js`) and the floating action bar.
- Long forms keep the key action in reach: the booking page's sticky `.pay-bar`.
- Tables become cards (`td[data-label]` in `mobile.css`).
- Respect safe areas: `env(safe-area-inset-*)` on fixed bars.
- Keep GPU work light: `silk.js` caps the pixel ratio at 1 on phones and pauses off-screen. Cursor and magnetic effects are mouse-only.
- Phone overrides go in `public/css/mobile.css`, motion styles in `motion.css`, everything else in `styles.css`.

## 9. Technical constraints

- Plain HTML, CSS and ES modules; no framework or build step beyond `scripts/vendor.js`.
- **CSP** (`src/app.js` and `vercel.json`, keep them in sync): scripts from `'self'` only, so **no inline `<script>`, no inline `style=""` attributes, no CDN scripts**. Setting styles from JS (`el.style.setProperty`) is fine.
- New pages: copy an existing page's `<head>` (fonts, `boot.js` before `styles.css`, `motion.css`, `mobile.css`) and its script block (vendor `defer` scripts **before** any `type="module"` script, then `nav.js` and `motion.js`).
- Pages are static on Vercel with `cleanUrls` (`/packages` → `packages.html`); the API is `/api/*`.
- Prices come from `src/catalog.js` via `/api/catalog`. Never hard-code prices in HTML.

## 10. Accessibility

- Visible focus: `:focus-visible` orchid outline. Never remove it.
- Real labels on every field; errors in `.field-error` and announced via `role="alert"` / `aria-live`.
- Decorative SVGs and canvases get `aria-hidden="true"`; duplicated marquee items are `aria-hidden`.
- Contrast: body text on ivory uses `--ink`/`--muted`; on ink uses `--paper` or rgba paper ≥ 0.6.
- Menus and dialogs: `aria-expanded`, Escape to close, focus moved sensibly.

## Checklist before shipping UI work

1. Uses tokens, the two fonts and existing components. One accent colour.
2. Copy: short, warm, British spelling, one italic accent word per heading at most.
3. Motion via `data-reveal` etc.; works with reduced motion; content visible without JS.
4. Phone check at 390px: no sideways scroll, 44px targets, nothing hidden behind fixed bars.
5. No inline scripts or styles (CSP). Prices from the API.
6. `npm test` passes, and `npx vercel build` succeeds if routing or config changed.
