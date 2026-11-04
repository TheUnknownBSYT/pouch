# Pouch

**In. And on with your day.**

Pouch is a small place for things you need to keep. Its identity expresses a useful everyday pocket: approachable, orderly, and quick to use.

- **Mark:** open pocket with a downward fold. Source: `assets/brand/pouch-mark.svg`; reverse: `pouch-mark-reverse.svg`. Preserve proportions and a quarter-mark clear space.
- **Wordmark:** lowercase, bold system sans, tight spacing. Live lockup in `src/components/brand.tsx`.
- **Palette:** warm paper, dark ink, field green. Source of truth: `src/constants/ui.ts`.
- **Type:** system sans avoids a blocking font download. Figma uses Inter as a cross-platform design proxy, not a bundled app font.
- **Layout:** 4px rhythm; 24px screen gutters; 760px maximum app content width; separators for repeated content; 44px minimum primary touch areas.
- **Voice:** short, helpful, specific. “Drop something here…” / “Search your pouch” / “Save changes”. No AI language or unsupported speed claims.
- **Interaction:** capture before categorization; preserve drafts on failure; one haptic after successful save; reduced-motion support.

Figma: https://www.figma.com/design/f3bwmbp0DXCIwnaLiAYEhQ
Pages: Brand & foundations, Capture components, Product screens. Initial screens cover inbox light/dark, sign-in, task detail, and accounts. The companion prompt specifies the expanded state coverage for further design work.

Implementation keeps the existing authentication, Supabase storage, classification, filters, tasks, links, contacts, and exports. Native share and keyboard behavior need a device build to validate.
