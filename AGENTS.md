<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# DESIGN CONSTRAINTS (non-negotiable)

- Palette: paper `#F6F5F1`, raised `#FFFFFF`, ink `#0E0E10`, ink-soft `#2A2A2E`, ink-mid `#5A5A60`, rule-soft `#DBD9D2`. Red `#E6172A` is the ONLY accent.
- No gold. No gradients on text or buttons. No glassmorphism, no `backdrop-filter` on content, no glow, no bloom, no particle fields.
- Square corners. `border-radius: 0` everywhere except circular status dots.
- Fonts: Saira (display, uppercase), Inter (body, weight 300), JetBrains Mono (eyebrows, tags, nav links, labels, tickers — uppercase, wide letter-spacing). No other fonts.
- Motion: `0.2s` hovers on `cubic-bezier(0.2, 0.8, 0.2, 1)`. `0.8s` one-time scroll reveal, `translateY(30px)`. No `500ms` fades.
- Every color must reference a token in the `@theme` block in `src/app/globals.css`. Never hardcode a hex outside that block.
- Dark is punctuation only: the ticker bar and footer. Nothing else.

# WORKFLOW RULES

- Never push to `main`. Always branch, always open a PR, never merge.
- Run `tsc --noEmit`, `next build`, and `eslint` before opening any PR.
- Respect `prefers-reduced-motion` in anything animated.
