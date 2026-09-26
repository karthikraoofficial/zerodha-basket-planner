# 5. Hand-written CSS design system, self-hosted font, no chart library

**Status:** accepted (2026-09-26)

The app was restyled in a dashboard design language: rounded cards, pill navigation, stacked bars and gentle motion. There are only a handful of pages and three small charts, so a CSS framework, component kit or chart library would bring more code and supply-chain surface than it saves.

**Decision:**
- All styling lives in one global stylesheet, driven by design tokens (colours, radii, shadows, motion durations and easing) held in CSS custom properties. A dark variant redefines the tokens under `prefers-color-scheme`.
- The typeface is self-hosted through `next/font/google`, so browsers never call a font CDN. The build fetches the font once.
- Charts are plain HTML and CSS rendered by server components from a pure chart geometry module. That module is the only unit-tested part of the redesign. Its percentages are for display only and never feed money math.
- Motion is CSS only: a route template fades pages in, cards stagger and bars grow. A global `prefers-reduced-motion` rule turns it all off.

**Consequences:** no new runtime dependencies. Visual changes are reviewed in the running app, not with DOM tests.
