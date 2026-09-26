# Pouch review and improvements

## Architecture

Pouch is an Expo SDK 57 / React Native app with file-based Expo Router screens. Email OTP establishes a Supabase session. The capture composer sends trimmed text through a local rule-based classifier, then stores an item in Postgres. Row-level security scopes access to the signed-in user. A shared ItemsProvider keeps the inbox and details synchronized; Supabase realtime triggers reloads. Accounts and exports are computed from expense items. Native share intents feed the same capture path.

The best product direction remains fast capture followed by easy retrieval. The implemented changes support that core workflow without adding a model, paid API, new service, or schema migration.

## Changes

| Area | Problem addressed | New behavior |
| --- | --- | --- |
| Capture | No feedback about classification; double submissions possible | Type/amount/date preview and an immediate submission lock |
| Draft | Text typed during an in-flight save could disappear | Clear only the draft that was actually submitted |
| Tasks | Completed, due-today, and overdue items were mixed together | Dedicated task views and priority/due-date sorting |
| Search | Only a contiguous content substring matched | All query words can match content, type, source, or account |
| Link rows | Truncating text also truncated tappable URLs | Preserve full link targets; visually clamp to two lines |
| Editing | Reclassification overwrote manual choices | Text edits preserve metadata; explicit type changes clear incompatible fields |
| Detail forms | Every realtime refresh reset unsaved fields | Hydrate once per item instead of overwriting an active draft |
| Type changes | Bypassed shared list state | Writes pass through ItemsProvider |
| Sync | Older requests could overwrite newer results | Request generations and mutation guards reject stale snapshots |
| User changes | Previous account's state could survive | Provider is keyed to user identity and ignores late unmounted results |
| Failed deletes | Removed item depended on another network request to return | Restore the item locally before attempting a reload |
| Inbox size | Single PostgREST response could truncate older records | Ordered, successive 500-row pages |
| Shares | Failure reset the intent; local file paths were treated as captures | Visible retry/dismiss, combined text and link, explicit unsupported-file message |
| Money | 1900–2100 amounts rejected as years; quantities mistaken for prices | Accept these prices and prioritize explicit currency/price phrases |
| Intent | A future payment could be counted as spending | Explicit reminders and buy/pay commands become tasks |
| Dates | Invalid calendar dates rolled into another month | Validate exact day/month/year; same weekday means today |
| Exports | Floating-point drift; monthly balance started at zero; UTC dates shifted local transactions | Integer-paise totals, opening balances, local dates, formula-safe descriptions |
| Auth | Network failures could leave the form submitting indefinitely | Try/finally recovery; check sign-out errors; protect session initialization |

## Verification

Regression tests cover classification, URLs, task views/sorting, balances/CSV safety, service pagination and validation, and provider behavior under late responses, duplicate saves, failed deletes, and failed toggles. Run `npm run check`.

The web production export is checked with placeholder Supabase configuration. This validates bundling and route generation, not a real Supabase deployment. No production database, email OTP, RLS policy, physical-device share extension, or native build was exercised here.

## Remaining limitations

- Saves still need connectivity. A durable offline queue requires client-generated IDs and an idempotent retry design; this change does not pretend that a failed write is saved.
- A network response lost after a successful server insert can still cause a duplicate on manual retry. Submission locks prevent simultaneous duplicates, not ambiguous network outcomes.
- Shared images/files need an attachment-storage design. Temporary device paths are not durable attachments.
- Task dates are organizational fields, not scheduled notifications.
- Classification is heuristic. The preview and type picker make mistakes visible and correctable; they are not semantic understanding.
- Fetching every page ensures coverage under the default response limits but remains a full reload. Very large inboxes should use server-side filtering, keyset pagination, and server-side account aggregates. Concurrent inserts/deletes during offset paging can shift page boundaries.
- Edits preserve local drafts but do not implement cross-device conflict resolution. Last successful server write wins.
- Balances represent recorded transactions, not connected bank balances.
