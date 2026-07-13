<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# DESIGN CONSTRAINTS (non-negotiable)

- The active visual direction is a dark, spatial operating system. The whole page may use the void palette; the old light blueprint direction is retired.
- Palette: void `#050507`, void-raised `#0E0E10`, void-soft `#17171C`, white `#F6F5F1`, white-soft `#C2C2C6`, white-dim `#AFAFB5`, rule `#2A2A2E`. Red `#E6172A` is the ONLY accent.
- No gold, purple, blue, cyan, or multicolor accents. Stars, highlights, and light effects may only be white or red.
- No gradients on text or buttons. Environmental gradients are allowed only to create restrained space depth. Controlled white/red glow is allowed on stars, orbit lines, and the central system core—not on ordinary cards, copy, or buttons.
- A limited white/red star field is part of the design. Keep it sparse and render it with CSS backgrounds or a small fixed set of elements; never create hundreds of DOM particles.
- Square corners. `border-radius: 0` everywhere except circular stars, status dots, orbit rings, and the central system core.
- Fonts: Saira (display, uppercase), Inter (body, weight 300), JetBrains Mono (eyebrows, tags, nav links, labels, tickers — uppercase, wide letter-spacing). No other fonts.
- Motion: `0.2s` hovers on `cubic-bezier(0.2, 0.8, 0.2, 1)`. Scroll-linked 3D transforms and opacity are allowed for the constellation and operating-layer journey. Avoid generic long fades.
- Depth must be built with CSS 3D transforms, SVG lines, or Canvas 2D. Do not add Three.js or WebGL unless Brayden explicitly approves it in a future request.
- Anything animated must respect `prefers-reduced-motion`. Reduced motion must snap to a readable static composition with no continuous scroll tracking.
- Mobile performance is a release gate: animate transform and opacity only, avoid layout thrashing, keep the scene legible at 390px, and remove an effect if it cannot remain smooth on a mid-range phone.
- Every color must reference a token in the `@theme` block in `src/app/globals.css`. Never hardcode a hex outside that block.

# WORKFLOW RULES

- Never push to `main`. Always branch, always open a PR, never merge.
- Run `tsc --noEmit`, `next build`, and `eslint` before opening any PR.
- Respect `prefers-reduced-motion` in anything animated.
