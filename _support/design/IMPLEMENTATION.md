# Pouch design implementation

Figma file: https://www.figma.com/design/f3bwmbp0DXCIwnaLiAYEhQ

## Screen references

- Inbox light: 4:2; dark: 4:77
- Sign-in: 4:30
- Task detail: 4:44
- Accounts: 4:62
- Brand foundation: 2:24
- App icon: 6:2
- Capture row component: 3:17
- Primary button component: 3:20

## Changes

Shared colors/radii/shadows, native brand component, continuous inbox rows, restrained filters, responsive content width, safe-area spacing, auth layout/copy, accounts styling, dark-mode action contrast, reduced-motion handling, logo assets, app icons and splash config.

Figma is the design direction; implementation retains the richer existing controls (all item types, task views, action icons, detail fields, and export data). System typography is intentional; Figma uses Inter as a visual proxy. The file contains five initial screen designs, not a prototype of every product state. See FIGMA_PROMPT.md for the full expansion brief.

## Verification

TypeScript and ESLint passed. Existing six Jest suites / 38 tests passed. Expo static web export succeeded. Figma previews were inspected and text overlaps corrected. Live browser visual/interaction verification could not run: the computer-control browser service returned “failed to start codex app-server: No such file or directory”. Native share, keyboard, and icon installation still require device review.

The app remains Supabase-backed; no fixture data or authentication bypass was introduced. No backend/schema changes were made.
