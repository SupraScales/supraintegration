# SupraScales Design System

Extracted verbatim from the `ss-website` reference source (`styles.css`, `script.js`,
`index.html`, `affiliates.html`). Every value below is a real value pulled from that
source — nothing here is approximated or invented. This document is the single source
of truth that `supraintegration` should conform to.

---

## 0. Architecture note (read this first)

`ss-website/styles.css` is built in **two layers**:

1. **Carbon base layer** (`styles.css` lines 751–2881) — the original dark "carbon
   fibre / telemetry" theme. It defines the structural tokens (`--font-*`, geometry,
   the full type scale, and all component layout/sizing) plus a dark palette
   (`--carbon-*`, `--red: #ff2d3d`, `--text: #e8ebf0`).

2. **Blueprint light override** (`styles.css` lines 1–749) — a "LIGHT THEME OVERRIDE
   (BLUEPRINT MODE)" block that comes first in the file and wins through heavy
   `!important` usage. It redefines `:root` with a paper/ink palette and a **more
   restrained brand red `#E6172A`**, forces square corners (`border-radius: 0`,
   `clip-path: none`), and repaints nav / buttons / cards / sections as light
   blueprint panels.

**What actually renders is the blueprint (light) theme.** So the blueprint palette,
square geometry, and light surfaces below are authoritative. The carbon layer still
supplies: the three font families, the geometry container widths, the entire type
scale, and — because the override does **not** touch form controls — the **form
inputs remain dark carbon** (documented in §6). Both layers are recorded so the origin
of every rendered value is traceable.

---

## 1. Color

### 1.1 Active palette — Blueprint / light (what renders)

Source: `styles.css:4–27`.

| Token | Hex / value | Used for |
|---|---|---|
| `--paper` | `#F6F5F1` | Page background (warm off-white, not pure white) |
| `--paper-raised` | `#FFFFFF` | Cards, panels, eyebrows/tags, nav pill surfaces |
| `--paper-deep` | `#EDEBE4` | The "old way" compare card background |
| `--ink` | `#0E0E10` | Primary text, headings, primary-button fill, ticker + footer background |
| `--ink-soft` | `#2A2A2E` | Nav links, eyebrow text, FAQ summary text |
| `--ink-mid` | `#5A5A60` | Body copy, paragraphs, list text |
| `--ink-light` | `#8E8E94` | Scroll-progress labels, process spine |
| `--ink-faint` | `#C2C2C6` | Faintest text |
| `--rule` | `#1A1A1C` | Hard rule / strong divider |
| `--rule-soft` | `#DBD9D2` | Default card + input-pill borders, section dividers |
| `--rule-faint` | `#E7E5DE` | Faintest divider |
| `--grid` | `rgba(20, 20, 24, 0.04)` | Blueprint grid tint |

### 1.2 Brand red

| Token | Value | Layer | Used for |
|---|---|---|---|
| `--r-red` | `#E6172A` | Blueprint (**active**) | All accents: links-on-hover, dots, numerals, card top-accent, primary-button hover, circuit pulse |
| `--r-red-soft` | `rgba(230, 23, 42, 0.08)` | Blueprint | Dot glow ring, step-out tint |
| `--r-red-mid` | `rgba(230, 23, 42, 0.18)` | Blueprint | Mid red tint |
| `--red` | `#ff2d3d` | Carbon base | Legacy red; still hardcoded in the `<select>` chevron SVG (`styles.css:2218`) and in raw SVG markup `stroke="#ff3344"` before the CSS override repaints it |
| `--red-bright` | `#ff4555` | Carbon base | Legacy button-gradient top stop |
| `--red-deep` | `#c41e2c` | Carbon base | Legacy button-gradient bottom stop |
| `--red-glow` | `rgba(255, 45, 61, 0.35)` | Carbon base | Legacy glow shadow |
| `--red-trace` | `rgba(255, 45, 61, 0.12)` | Carbon base | Faint trace gradients (hero rule, nav underline) |

> The single canonical brand red for new work is **`#E6172A`**. The `#ff2d3d` family
> is legacy carbon and only survives in un-overridden spots (form chevron, raw SVG).

### 1.3 Telemetry amber

Source: `styles.css:785–786`.

| Token | Value | Used for |
|---|---|---|
| `--amber` | `#ffaa33` | Secondary circuit pulses (`.pulse-2`, `.pulse-5`) in the carbon layer; repainted red by the blueprint override |
| `--amber-dim` | `rgba(255, 170, 51, 0.6)` | Dim amber |

### 1.4 Carbon base palette (dark islands: form inputs, legacy)

Source: `styles.css:753–781`.

| Token | Value | Used for |
|---|---|---|
| `--carbon-deep` | `#050507` | **Form input background**, inner dark panels, ticker/footer in carbon mode |
| `--carbon-base` | `#0a0a0d` | Body background (carbon), input `:focus` background |
| `--carbon-panel` | `#0f0f13` | Dark panel surface |
| `--carbon-raised` | `#14141a` | Raised dark surface / hover |
| `--carbon-hover` | `#1a1a22` | Dark hover |
| `--gunmetal` | `#2a2d35` | Metal gradient start (form-card frame, VSL frame) |
| `--gunmetal-light` | `#3d4148` | Metal gradient light |
| `--titanium` | `#8a8f96` | Muted labels on dark (form labels, eyebrow text in carbon) |
| `--chrome` | `#c8ccd2` | Secondary light text on dark |
| `--chrome-bright` | `#e8ebf0` | Headings on dark |
| `--text` | `#e8ebf0` | Body text on dark (form input text) |
| `--text-dim` | `#8a8f96` | Dim body text on dark |
| `--text-faint` | `#4a4e55` | Faintest text on dark |
| `--line` | `#1c1c24` | Hairline on dark |
| `--line-bright` | `#28282f` | Brighter hairline on dark |
| `--line-hot` | `#383840` | **Form input border**, hottest hairline on dark |

---

## 2. Typography

### 2.1 Font families

Source: `styles.css:789–791`, loaded in `index.html:14`.

| Token | Stack | Role |
|---|---|---|
| `--font-display` | `"Saira", "Arial Narrow", sans-serif` | Headings, buttons, logo, big numerals, wordmark |
| `--font-body` | `"Inter", system-ui, sans-serif` | Body copy, inputs |
| `--font-mono` | `"JetBrains Mono", "Courier New", monospace` | Eyebrows, tags, labels, nav links, ticker, footer headings, step numbers, meta |

**Loaded weights** (Google Fonts, `index.html:14`):
- Saira — `300, 400, 500, 600, 700, 800`
- Inter — `300, 400, 500, 600, 700`
- JetBrains Mono — `400, 500`

Base body: `font-family: var(--font-body)`, `line-height: 1.6`, `font-weight: 400`,
antialiased (`styles.css:804–815`).

Display headings frequently use `font-stretch` (`105%`–`115%`) and `text-transform:
uppercase` in the carbon layer; the blueprint override forces `font-stretch: normal`
on the hero/section titles (`styles.css:104–111, 505`).

### 2.2 Type scale (real values from source)

| Element | Font | Weight | Size | Line-height | Letter-spacing | Transform |
|---|---|---|---|---|---|---|
| `.hero-title` (carbon) | display | 800 | `clamp(2.6rem, 6.2vw, 5.2rem)` | 0.95 | −0.025em | uppercase |
| `.hero-title` (blueprint override) | display | **700** | — | **1.02** | **−0.03em** | uppercase |
| `.section-title` | display | 700 | `clamp(2.4rem, 5.2vw, 4.4rem)` | 1 | −0.015em | uppercase |
| `.aff-hero h1` | display | 800 | `clamp(2.6rem, 6vw, 4.8rem)` | 0.95 | −0.02em | uppercase |
| `.wordmark` | display | 800 | `clamp(3.5rem, 13vw, 11rem)` | 0.9 | −0.02em | uppercase |
| `.fit-title` | display | 700 | `clamp(1.8rem, 4vw, 3rem)` | 1.05 | −0.015em | uppercase |
| `.result-number` | display | 800 | 2.4rem | 1 | −0.02em | uppercase |
| `.engine-title` | display | 700 | 1.7rem | — | −0.01em | uppercase |
| `.compare-h` | display | 700 | 1.55rem | 1.1 | −0.005em | uppercase |
| `.process-card h3` | display | 700 | 1.55rem | — | −0.005em | uppercase |
| `.step-title` | display | 700 | `clamp(1.4rem, 2.4vw, 1.9rem)` | 1.05 | −0.01em | uppercase |
| `.aff-form-inner h3` | display | 700 | 1.6rem | — | −0.005em | uppercase |
| `.why-block h4` | display | 700 | 1.2rem | — | −0.005em | uppercase |
| `.faq-item summary` | display | 600 | 1.02rem | — | 0.005em | — |
| `.nav-logo` | display | 700 | 1.15rem | — | 0.04em | uppercase |
| `.hero-sub` | body | 300 | `clamp(1rem, 1.35vw, 1.18rem)` | 1.6 | — | — |
| `.section-lead` | body | (400) | 1.05rem | 1.7 | — | — |
| Body paragraph default | body | **300** | ~0.92–0.96rem | 1.6–1.7 | — | — |
| `.hero-eyebrow` | mono | 500 | 0.78rem | — | 0.22em | uppercase |
| `.eyebrow` | mono | 500 | 0.72rem | — | 0.25em | uppercase |
| `.nav-links a` | mono | 500 | 0.78rem | — | 0.15em | uppercase |
| `.compare-tag` / `.engine-tag` / `.sv-tag` | mono | 500 | 0.68–0.72rem | — | 0.25–0.28em | uppercase |
| `.footer-col h5` | mono | 500 | 0.7rem | — | 0.28em | uppercase |
| `.form-group label` | mono | 500 | 0.7rem | — | 0.22em | uppercase |
| `.step-num` | mono | 600 | 0.72rem | — | 0.28em | uppercase |
| `.ticker-track` | mono | 500 | 0.82rem | — | 0.28em | uppercase |

Note the paragraph body weight is predominantly **300 (light)**, not 400.

---

## 3. Spacing & layout

There is no numeric spacing-token scale; spacing is expressed directly. Real values:

### 3.1 Containers & geometry

Source: `styles.css:793–799, 884–891`.

| Token / rule | Value |
|---|---|
| `--container` | `1280px` |
| `--container-narrow` | `980px` |
| `.container` padding | `0 24px` |
| `--bevel` | `14px` (carbon clip-path corner) |
| `--bevel-sm` | `8px` (carbon clip-path corner) |

> Blueprint override sets `border-radius: 0` and `clip-path: none` on nav, buttons,
> and cards (`styles.css:74, 93, 131, 173, …`), so **corners render square** even
> though the carbon `--bevel` tokens exist.

### 3.2 Section rhythm

Source: `styles.css:893–927`.

| Rule | Value |
|---|---|
| `.section` padding | `120px 0` |
| `.section` padding (≤768px) | `80px 0` |
| `.section-header` margin-bottom | `72px` |
| `.section-header` max-width | `880px` (centered) |

### 3.3 Grid gaps

| Grid | Gap | Source |
|---|---|---|
| `.compare-grid` | 20px | `styles.css:1387` |
| `.engines-grid` | 20px | `styles.css:1545` |
| `.process-grid` | 20px | `styles.css:1655` |
| `.why-grid` | 80px (48px ≤980px) | `styles.css:1724, 1728` |
| `.aff-grid` | 60px | `styles.css:2077` |
| `.fit-criteria` | 14px | `styles.css:1831` |
| `.book-features` | 14px 24px | `styles.css:1899` |
| `.faq-list` | 10px | `styles.css:1852` |
| `.nav-links` | 36px | `styles.css:1079` |

### 3.4 Common component padding

| Component | Padding | Source |
|---|---|---|
| `.compare-card` | `40px 36px 32px` | `styles.css:1394` |
| `.engine-card` | `36px 32px 32px` | `styles.css:1551` |
| `.aff-step` | `26px` | `styles.css:2087` |
| `.fit-card` (carbon) | `70px 44px` | `styles.css:1773` |
| `.fit-card` (blueprint) | `56px 44px` | `styles.css:515` |
| `.aff-form-inner` | `36px 32px` | `styles.css:2166` |
| `.eyebrow` | `8px 16px` (blueprint generic: `8px 14px`) | `styles.css:969 / 443` |

---

## 4. Buttons

Source: `styles.css:986–1026` (carbon) and `styles.css:69–98` (blueprint override).

### 4.1 Base `.btn`

```
display: inline-flex; align-items: center; justify-content: center; gap: 10px;
font-family: var(--font-display); font-weight: 600; font-size: 0.95rem;
letter-spacing: 0.06em; text-transform: uppercase;
padding: 16px 30px;
transition: all 0.2s cubic-bezier(0.2, 0.8, 0.2, 1);
white-space: nowrap;
```
Sizes: `.btn-sm` → `padding: 11px 20px; font-size: 0.78rem` · `.btn-lg` → `padding:
19px 38px; font-size: 1rem` · `.btn-full` → `width: 100%`.

### 4.2 `.btn-primary` — rendered (blueprint override)

```
background: var(--ink)  (#0E0E10);
color: var(--paper-raised)  (#FFFFFF);
border: 1px solid var(--ink);
border-radius: 0; clip-path: none;   /* square corners */
box-shadow: none;
font-weight: 500; letter-spacing: 0.08em;
transition: all 0.2s ease;
```
Hover: `background: var(--r-red) #E6172A; border-color: #E6172A; transform:
translateY(-1px);`

> The carbon `.btn-primary` (a red `#ff4555 → #c41e2c` gradient with glow and a beveled
> clip-path, `styles.css:1005–1022`) is **fully overridden** and does not render.

### 4.3 `.btn-secondary` / `.btn-ghost` (blueprint)

```
background: transparent; color: var(--ink);
border: 1px solid var(--ink-soft) (#2A2A2E);
border-radius: 0; clip-path: none;
```
Hover: `background: var(--ink); color: var(--paper-raised);`

---

## 5. Links

| Context | Resting | Hover | Source |
|---|---|---|---|
| Global `a` | `color: inherit; text-decoration: none` | — | `styles.css:816` |
| `.nav-links a` | `color: var(--ink-soft)` (blueprint) | `color: var(--r-red)` | `styles.css:62–63` |
| `.nav-links a::before` | red `4px` dot, `opacity: 0` | `opacity: 1` (red bullet appears left of link) | `styles.css:1093–1105` |
| `.footer-col a` | `color: var(--paper)` at `opacity: 0.78` | `opacity: 1; color: var(--r-red)` | `styles.css:242–246, 2031` |
| `.scroll-progress a` | `color: var(--ink-light)`, hollow square marker | `color: var(--ink)`, marker fills red | `styles.css:346–370` |
| Link/color transition | `0.2s` | | `styles.css:1088, 2028` |

---

## 6. Inputs (form controls)

The blueprint override does **not** restyle form controls, so inputs render in the
**carbon dark** treatment. Source: `styles.css:2186–2233`.

### 6.1 `.form-group input, select, textarea`

```
width: 100%;
padding: 14px 16px;
background: var(--carbon-deep)  (#050507);
border: 1px solid var(--line-hot)  (#383840);
color: var(--text)  (#e8ebf0);
font-family: var(--font-body); font-size: 0.95rem;
transition: all 0.2s;
```

### 6.2 `:focus`

```
outline: none;
border-color: var(--red)  (#ff2d3d);
background: var(--carbon-base)  (#0a0a0d);
box-shadow: 0 0 0 2px rgba(255, 45, 61, 0.15);
```

### 6.3 Labels & select

- `.form-group label`: mono, `0.7rem`, weight 500, `letter-spacing: 0.22em`,
  `color: var(--titanium)` (#8a8f96), uppercase, `margin-bottom: 8px`.
- `.form-group` margin-bottom: `18px`.
- `<select>` custom chevron: inline red SVG `stroke='%23ff2d3d'`, positioned
  `right 16px center`, `padding-right: 44px`, native appearance removed.
- `.form-meta`: mono, `0.7rem`, `letter-spacing: 0.18em`, `color: var(--text-faint)`,
  uppercase, centered.

---

## 7. Cards

Rendered treatment = blueprint override. Source: `styles.css:151–203`.

### 7.1 Default card

```
background: var(--paper-raised)  (#FFFFFF);
border: 1px solid var(--rule-soft)  (#DBD9D2);
border-radius: 0; clip-path: none;   /* square */
box-shadow: none;
```
Applies to: `.compare-card, .engine-card, .process-step, .fit-card, .faq-item,
.success-card, .vsl-card, .book-card, …`

### 7.2 Card hover

```
border-color: var(--ink)  (#0E0E10);
transform: translateY(-2px);
box-shadow: 0 8px 24px rgba(20, 20, 24, 0.06);
```

### 7.3 Card accents

- `.compare-card.compare-new` → `border-top: 3px solid var(--r-red)` (#E6172A).
- `.compare-card.compare-old` → `background: var(--paper-deep)` (#EDEBE4).
- `.engine-num, .process-num` → `color: var(--r-red)`, weight 700.
- `.fit-card` → white panel, `box-shadow: 0 8px 32px rgba(20, 20, 24, 0.04)`,
  padding `56px 44px`, centered.

---

## 8. Eyebrows, tags & pills

Source: `styles.css:117–137, 426–453`.

```
display: inline-flex; align-items: center; gap: 10px;
background: var(--paper-raised)  (#FFFFFF);
border: 1px solid var(--rule-soft)  (#DBD9D2);
color: var(--ink-soft)  (#2A2A2E);
font-family: var(--font-mono); font-weight: 500;
font-size: 0.7rem; letter-spacing: 0.25em; text-transform: uppercase;
padding: 8px 14px; border-radius: 0;
margin-bottom: 18px;
```
Leading **dot**: `6px` red (`#E6172A`) circle with `box-shadow: 0 0 0 3px
var(--r-red-soft)`, animated `pulse-dot-light 2s ease-in-out infinite`.

---

## 9. Animation — timing & easing

### 9.1 Easing curves

| Curve | Where |
|---|---|
| `cubic-bezier(0.2, 0.8, 0.2, 1)` | **Primary curve** — buttons (carbon), cards, `.fade-in` reveal, VSL/engine hovers |
| `ease` | Blueprint button transition (`transition: all 0.2s ease`) |
| `ease-in-out` | All pulse/glow keyframes |
| `linear` | Ticker scroll, circuit pulse travel, process spine flow |
| `ease-out` | Modal fade-in |

### 9.2 Transition durations

| Interaction | Duration | Source |
|---|---|---|
| Buttons | `0.2s` | `styles.css:78, 998` |
| Links / color shifts | `0.2s` | `styles.css:1088` |
| Card hover (default) | `0.2s–0.3s` | `styles.css:1554, 1856` |
| Scroll-reveal `.fade-in` | `0.8s` on opacity + transform | `styles.css:2348` |
| Inputs | `0.2s` | `styles.css:2205` |

`.fade-in` initial state: `opacity: 0; transform: translateY(30px)` →
`.visible { opacity: 1; transform: translateY(0) }` (`styles.css:2345–2353`).

### 9.3 Keyframe animations

| Name | Duration / timing | Purpose | Source |
|---|---|---|---|
| `pulse-dot` | `1.5s ease-in-out infinite` | Carbon accent dot pulse (opacity+scale) | `styles.css:981` |
| `pulse-dot-light` | `2s ease-in-out infinite` | Blueprint dot glow-ring pulse | `styles.css:377` |
| `pulse-travel` | `8s linear infinite` | Circuit red pulse travels the trace | `styles.css:867` |
| `.pulse-2 / .pulse-5` | `10s / 7s` (delays `0–4s`) | Secondary circuit pulses | `styles.css:861–865` |
| `spine-flow` | `6s linear infinite` | Process-diagram spine pulse | `styles.css:573` |
| `node-pulse` | `2.4s ease-in-out infinite` | Process node solder-joint glow | `styles.css:629` |
| `vsl-pulse` | `2.4s ease-in-out infinite` | Hero VSL play-button scale | `styles.css:1305` |
| `scroll-x` | `40s linear infinite` | Ticker marquee (`translateX(0 → -50%)`) | `styles.css:1379` |
| `pulse-success` | `2s ease-in-out infinite` | Success-page icon glow | `styles.css:2269` |
| `vsl-modal-fade` | `0.25s ease-out` | Lightbox modal open | `styles.css:2519` |

### 9.4 JS-driven motion

Source: `script.js`.

- Scroll reveal via `IntersectionObserver`: `threshold: 0.1`, `rootMargin: '0px 0px
  -50px 0px'`; adds `.visible`, then unobserves (fires once). (`script.js:56–69`)
- Smooth in-page scroll with an `80px` top offset. (`script.js:71–82`)
- Scroll-progress active-section tracking rAF-throttled, activation line at
  `scrollY + innerHeight * 0.35`. (`script.js:113–142`)

---

## 10. Global surfaces & chrome

| Surface | Treatment | Source |
|---|---|---|
| `body` | `background: var(--paper) #F6F5F1; color: var(--ink) #0E0E10`; carbon-fibre `body::before` texture is **killed** (`display: none`) | `styles.css:30–39` |
| `.nav` | `background: rgba(246,245,241,0.85)`; `backdrop-filter: blur(12px)`; `border-bottom: 1px solid var(--rule-soft)`; sticky, `z-index: 100` | `styles.css:55–59, 1029–1037` |
| `.ticker` | `background: var(--ink)`; track text `var(--paper)`; dots `var(--r-red)`; mono, `letter-spacing: 0.28em` | `styles.css:221–227` |
| `.footer` | `background: var(--ink)` (dark); text `var(--paper)` at `opacity: 0.78`; hover red; column heads mono uppercase | `styles.css:234–246` |
| `.circuit-bg` | Light radial red washes (`rgba(230,23,42,0.035)` / `0.025`) over paper; static traces `rgba(20,20,24,0.16)`; nodes + pulses red; vignette removed | `styles.css:42–52` |
| `.social-icon` | `40×40`, `1px` border, hover fills `var(--r-red)` + `translateY(-2px)` | `styles.css:727–745` |
| `::selection` | (not set in reference — browser default) | — |

---

## 11. Quick reference — the "feel"

- **Light blueprint**, not dark. Warm off-white paper `#F6F5F1`, near-black ink
  `#0E0E10`, one surgical brand red `#E6172A`.
- **Square corners.** No border-radius; no glass blur on content cards (only the nav
  uses a 12px backdrop blur). Panels are opaque white with a 1px `#DBD9D2` hairline.
- **Three fonts, strict roles:** Saira (display, uppercase, condensed via
  `font-stretch`), Inter (body, often weight 300), JetBrains Mono (every eyebrow, tag,
  label, nav link, ticker — wide `letter-spacing`, uppercase).
- **Motion is restrained and mechanical:** short `0.2s` hovers on the
  `cubic-bezier(0.2,0.8,0.2,1)` curve, slow looping red "telemetry" pulses (1.5s–8s),
  a one-time `0.8s` scroll-reveal.
- Dark is used only as **punctuation** — the ticker and footer bars, and the form
  inputs — against the light field.
