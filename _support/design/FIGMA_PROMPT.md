# Pouch — Figma design brief

Use the existing file: https://www.figma.com/design/f3bwmbp0DXCIwnaLiAYEhQ

Design a professional mobile-first product identity and interface for **pouch**, a fast, frictionless personal inbox. The brand promise is **“In. And on with your day.”** It should feel like a well-made everyday tool: useful, calm, compact, and quietly distinctive.

## Understand the working product

Pouch is an Expo / React Native app backed by Supabase. A single text field captures notes, links, tasks, expenses, contacts, and quotes. Local rules classify text automatically. Saving must never require choosing a category, folder, or tag. The app supports search, type filters, sorting, task completion/priority/due dates, editable item details, phone and WhatsApp actions, and Cash/GPay expense balances with monthly CSV exports. Authentication uses an email code. Sharing into Pouch is a native-build capability. It is not a chatbot, project-management dashboard, or bank.

## Brand

Use the pocket mark and lowercase pouch wordmark already in the file. The mark is an open-topped pocket with a small downward fold: capture and containment, readable at icon size. Keep its geometry intact. Use generous clear space, at least a quarter of its height. Do not add sparkles, mascots, speed lines, or a lightning bolt.

Light palette: paper #F7F6F2, ink #202A23, field green #286447, secondary text #677168, pale green #E7EFE5, separators #DEE2D9, inputs #EEEFE8. Dark palette: background #151A17, surface #1E2520, text #F1F4EE, secondary text #ACB7AD, accent #70BA90, input #29322C. Green action backgrounds use white text in light mode and #10281B text in dark mode.

Typography: native system sans in the app; Inter is the editable Figma equivalent. Body 16/24, metadata 12–13/18, titles 24–30, sign-in statement 36/46. Use medium weight for row titles, semibold for actions, tabular numerals for money. Spacing follows 4/8/12/16/24/32. Standard corners 10–12px. Controls have at least 44px touch areas. Content must reflow for long text and large type.

## Interface direction

Create hierarchy through alignment, typography, and breathing room. Use a continuous inbox with fine separators, not a pile of floating cards. Reserve color for action, selection, and meaningful status. Small monochrome type icons can help scanning; never assign every type a competing saturated color. Keep the primary capture field at the bottom above the keyboard. Show a subtle inferred type preview while typing. Save with an upward arrow; show actual pending, success, and error states. Do not imply success until saving succeeds. Keep drafts on failure.

The home screen needs a compact wordmark, a short line “A little less to keep in your head.”, search, horizontally scrollable filters, count/sort controls, the inbox list, and the capture field. Preserve all existing filters and secondary task views. Accounts and sign-out are secondary actions. Do not place account email in the main visual hierarchy.

Sign-in: wordmark, “In. And on / with your day.”, “Links, notes, tasks. Drop them here. Find them when you need them.”, email input, “Continue with email”, and a plain explanation of the code. Provide email, code, sending, invalid code, and keyboard-visible states.

Details: content first, then type and only relevant fields. Tasks expose completed, priority, and due date; expenses expose amount, Cash/GPay, direction, and occurrence date; contacts expose call/WhatsApp; links expose open. Keep delete visually secondary with confirmation. Preserve all existing functionality.

Accounts: clear all-time Cash/GPay balances, month navigation, monthly in/out figures, export CSV, and legible transactions. Do not invent charts, spending recommendations, bank connections, or financial features.

## Deliverables

Extend this same Figma file with editable auto-layout frames, bound light/dark variables, text styles, and reusable components. Include populated/empty/no-results/loading/error inbox, composing and saving, task-filtered view, item types, email/code sign-in, accounts, and delete confirmation. Design at 390px and verify 320px; provide a restrained desktop layout with a centered content column capped at 760px. Use realistic sample captures in INR, clearly as sample content.

Include a brand sheet, SVG mark/reversed mark, wordmark lockup, 1024px app icon, spacing/color/type guidance, and voice examples. Link components to existing code where appropriate. Validate wrapping and clipping in rendered screenshots.

## Quality bar

No gradients, glassmorphism, decorative blobs, giant pill cards, rainbow badges, emoji navigation, fabricated stats, oversized dashboard greetings, or generic “unlock your potential” copy. Avoid arbitrary ornamental sections. Make the core action obvious immediately. Motion is short and functional, honors reduced-motion settings, and never delays capture. Do not claim measured performance or offline persistence that the implementation does not provide.
