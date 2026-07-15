# Supra Integration Spatial Design System

This document is the authoritative visual specification for `supraintegration.ai`.
It replaces the previous SupraScales light-blueprint treatment following direct user
testing on July 13, 2026. Supra Integration may share typography and red with
SupraScales, but it must now feel like its own futuristic operating system.

## 1. Core idea

The page is one continuous journey through a business growth system in space.
The viewer begins at a central system core, moves through a constellation of
deployed agents, then rotates through the operating layers that hold the system
together. Space is the metaphor for coordination and scale, not decoration.

The site still has one commercial job: book a call. The visual experience must
make the systems understandable and keep the booking path obvious.

## 2. Palette

| Token | Value | Role |
|---|---|---|
| `--void` | `#050507` | Page and scene background |
| `--void-raised` | `#0E0E10` | Raised technical surfaces |
| `--void-soft` | `#17171C` | Secondary depth layer |
| `--white` | `#F6F5F1` | Primary text and bright stars |
| `--white-soft` | `#C2C2C6` | Supporting copy |
| `--white-dim` | `#AFAFB5` | Labels and inactive systems |
| `--rule` | `#2A2A2E` | Borders and orbit lines |
| `--red` | `#E6172A` | The only accent and active signal |

No gold, purple, blue, cyan, or multicolor lighting. Every color in product code
must use a token from the `@theme` block in `src/app/globals.css`.

## 3. Space and depth

- Use a sparse field of white and red stars across the dark page.
- Create foreground/background separation with star size, opacity, and slow
  transform movement—not a dense particle simulator.
- Environmental gradients may create a restrained vignette or deep-space falloff.
- Never put gradients on text or buttons.
- White/red glow is limited to stars, orbit lines, and the central system core.
- Normal cards and controls stay crisp with one-pixel rules and no bloom.
- The page must not resemble Flux Growth's purple globe. Supra uses an original
  red/white system core, orbit geometry, and service constellation.

## 4. Typography

- Saira: display headings, uppercase, weight 600–800.
- Inter: body copy, weight 300.
- JetBrains Mono: eyebrows, labels, navigation, system identifiers, and tickers;
  uppercase with wide letter spacing.
- No other fonts.

## 5. Geometry

- Square controls, cards, and panels.
- Circular geometry is reserved for stars, status dots, orbit rings, and the
  central system core.
- Thin rules, crosshairs, coordinates, and orbit paths communicate precision.
- Avoid generic grids of identical cards. Systems should feel spatially related.

## 6. Scroll narrative

### Stage 1 — Core

The first fold shows the Supra system core in deep space with direct copy and a
clear booking action. Four labeled signals—Audit, Prove, Deploy, Operate—move on
crossing atom-like orbits around the core. It should feel dimensional before the
user scrolls.

### Stage 2 — Constellation

As the user scrolls beyond the first fold, seven system-stars expand away from the
core: AI receptionist, outreach, lead nurture, content/social, paid growth/search,
revenue operations, and SOP/founder offload. The active system moves forward,
brightens red, and reveals concrete copy. Every active system resolves into the
same fixed focal zone beside the explanation panel; never magnify the tiny orbit
label into a different part of the screen. Use a full-size focal label so the type
stays crisp. Passed systems recede. The core must zoom out quickly and reveal the
first active system early in the scroll journey.

### Stage 3 — Operating orbit

The scene rotates through four connected layers: Audit, Prove, Deploy, Operate.
Each layer turns toward the viewer as its explanation becomes active. The motion
must clarify sequence, not become a decorative carousel.
On mobile, rotating layer cards always render in front of the central operating
disc. The desktop-only supporting sentence is hidden so it cannot reappear when
the sticky scene is re-entered by reverse scrolling.

### Stage 4 — Protocols and booking

The experience resolves into readable SOP controls and the embedded Calendly
booking section while remaining inside the same dark spatial world.

## 7. Motion and performance

- Hovers: `0.2s cubic-bezier(0.2, 0.8, 0.2, 1)`.
- Scroll-linked motion may animate transform and opacity only.
- Prefer one scroll progress source per sticky scene. Do not attach a listener to
  every node and do not cause layout recalculation inside animation frames.
- Use CSS 3D, SVG paths, or Canvas 2D. Three.js/WebGL is not approved.
- Keep the star field sparse. Do not create hundreds of DOM particles.
- Respect `prefers-reduced-motion`: render a static, fully readable composition
  and remove continuous scroll tracking or looping star motion.
- Test at 390px. No horizontal page overflow. Mobile smoothness is a release gate.

## 8. Conversion and voice

- The primary action is always the 15-minute systems audit.
- Copy stays direct, simple, and concrete.
- Do not invent results, client names, numbers, or testimonials.
- Never guarantee outcomes.
- The embedded Calendly remains part of the page with a direct-link fallback and
  uses the dark void, white, and red palette rather than Calendly's white theme.
- The Calendly embed auto-sizes to its content, has no nested scrollbar, and
  suppresses Calendly's optional privacy banner inside the booking panel.
- The header wordmark uses the lightweight animated Supra circuit mark shared
  with SupraScales. It pauses on the first frame for reduced-motion visitors.
- The booking panel header shows only calendar status, with no person named.
- The footer omits the parent-entity copyright line.
