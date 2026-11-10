# Pouch: capture first, extras by choice

## What this update implements

- Local classification before sending, with a category preview and an optional correction. Saving never requires choosing a category.
- A per-account durable outbox. The composer clears only after the capture is written to device storage. Uploads happen in the background with a stable UUID, so a lost response can be retried without creating another row.
- Per-account draft recovery and a cache of the loaded inbox for offline reading. Pending captures are clearly labeled and read-only until synchronized. Capture retries on app foreground, pull-to-refresh, and every 30 seconds while the app is running. This is not an OS background-sync guarantee.
- Completed-task visibility, multi-word search, useful first-capture examples, category labels, and a separate personal-space screen. Explicitly selected categories survive later edits.
- A WhatsApp connection screen, signed webhook receiver, one-use pairing, disconnect, and database-level message deduplication.
- Private display names, server-controlled lifetime Plus rewards, three qualifying referrals, custom palettes, and compact rows. There is no public profile directory, contacts upload, or social feed.

The classifier remains a deterministic local function. It now handles real amounts such as ₹2,000, keeps instructions like “Buy milk for ₹50” as tasks, avoids treating “got an idea” as an expense, and rejects impossible due dates. It still makes mistakes; immediate correction remains important.

## WhatsApp: the supported experience

The supported API route is **message a Pouch business contact → receive a signed webhook → save to the linked account**. It does not mirror the user's personal “Message yourself” chat. For that chat, the supported workflow is Share → Pouch, or copy/paste if WhatsApp doesn't expose Share for that content. Existing share-sheet support remains in place.

Direct capture supports **new text and links only**. Media, voice notes, attachments, and historical chat exports are not imported. The receiver does not send chat replies. The person confirms pairing by returning to Pouch; a message marked delivered in WhatsApp is not itself a Pouch-save receipt.

Pairing codes contain a random UUID without separators, expire in ten minutes, and are stored as SHA-256 hashes. The person sends the code from the number they want linked. Only a valid Meta webhook can consume it. A phone cannot silently replace another account's existing connection. SQL checks that captures are newer than the current connection, including after disconnect/reconnect.

The app shows only the last four digits of the linked number. The server stores the sender ID to route messages. Saved message content lives in the existing private `items` table. The receipt ledger stores message IDs and account IDs, but no message content; it deliberately survives individual item deletion so retries cannot recreate deleted items. Account deletion cascades through these tables.

## Enable the backend

The `delete-account` and `whatsapp-webhook` functions are now deployed to the connected project. The database migration and Meta setup remain pending. See [the deployment status and WhatsApp setup guide](WHATSAPP_SETUP.md) before enabling the feature.

1. Back up the database and test the migration in a staging project. An existing project needs the v1-v3 item schema. A fresh project can run `_support/supabase/migration.sql`, which already contains that schema.
2. Apply `_support/supabase/migrations/202611040001_space_and_whatsapp.sql` once. It adds tables and RPCs without rewriting existing items. Do not rerun it manually after success.
3. Create/configure the Pouch number in Meta's WhatsApp Business Platform. Use the business number's **phone number ID** on the server; use its international **phone number** in the mobile app. These are different values.
4. Set `WHATSAPP_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN`, and `WHATSAPP_PHONE_NUMBER_ID` in Supabase Edge Function Secrets. The deployed Supabase runtime provides `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. Never put service-role credentials or the Meta app secret in an Expo public environment variable.
5. Deploy from the repository root:

   ```sh
   npx supabase --workdir _support functions deploy whatsapp-webhook --project-ref YOUR_PROJECT_REF
   ```

   `_support/supabase/config.toml` disables gateway JWT verification for the Meta webhook and deletion endpoint. The receiver performs HMAC-SHA256 validation of the raw request body before database access; deletion validates the caller with Supabase Auth. Do not remove either check. The classifier import points to the same source used by the app; keep the repository intact when bundling. Check your installed CLI's `functions deploy --help` before using the example command; deployment in this session used the Supabase connector.

6. In Meta, configure the callback `https://YOUR_PROJECT_REF.supabase.co/functions/v1/whatsapp-webhook`, supply the matching verification token, and subscribe the app/account to the `messages` webhook field. Follow the current account registration and production-access steps shown in Meta's dashboard.
7. Test pairing, two messages in one delivery, a retry, an expired token, unknown sender, disconnect, and sender-local “tomorrow” dates with the test business number. Watch the inbox, not just WhatsApp's delivered indicator. The receiver returns 503 for database failures so Meta can retry; log/alert on response counts without collecting message bodies or tokens.
8. Set `EXPO_PUBLIC_WHATSAPP_NUMBER` to the business number in international digits-only format, and `EXPO_PUBLIC_INSTALL_URL` to the real HTTPS download page. Until configured, direct capture and share-invite actions show their unavailable state. Profile/referral features also degrade gracefully if the migration isn't applied yet.
9. Rebuild the native development/production client: this update adds the SDK 57 `expo-crypto` native dependency. Verify native keyboard behavior and WhatsApp share-sheet entry on a real phone; a web preview cannot validate those.

Client environment variable names are documented in `.env.example`; server-only names are in `_support/supabase/functions/.env.example`. Actual `.env` files are ignored by Git.

## Referral rules and limits

Choose **three friends**, with no reward for merely opening the share sheet. Each friend must have a confirmed email, use the inviter's code within fourteen days of creating their account, and save at least one capture from the mobile app. A capture made before entering the code also counts. Accounts can claim only one inviter; self-referrals and referral cycles are rejected. Three qualifications grant one lifetime entitlement; additional captures cannot multiply credit.

This implementation verifies **account activation**, not cryptographically proven unique-device installation. The client-supplied item source distinguishes normal mobile use from web use, but can be forged by a determined client. Email uniqueness is also not proof of a unique person. Before a large paid launch, add device attestation and abuse monitoring or manual review appropriate to the value of the reward. Do not market this as fraud-proof install attribution. Referral codes are explicit in the invite message and are entered in Your space; deferred store deep-link attribution is not implemented.

Client roles cannot write profiles, referral credits, or entitlements directly. Narrow authenticated RPCs expose only the current person's information. Qualifying friends lock the inviter's profile while counting rewards, so simultaneous activations cannot miss the threshold. The reward remains lifetime if a qualifying friend later deletes an account.

## Monetization recommendation

Keep capture, automatic sorting, search, editing, tasks, basic expense tracking/export, offline saving, and WhatsApp capture free. Pouch must remain useful without an invitation or upgrade.

The implemented Plus package is deliberately small: personal color palettes, a compact inbox, and a lifetime badge in Your space. **It is not enough value for a strong recurring subscription yet.** Start with a one-time supporter purchase after adding a richer set of optional custom icons, themed widgets, and well-designed visual packs. Make previews visible and desirable, while leaving the main inbox quiet. Seasonal artwork can create interest without fake countdowns, invented scarcity, or implying that someone is missing essential functionality.

There is no working checkout in this update. The UI explicitly says paid upgrades aren't available. The entitlement table reserves `purchase` for a future verified billing integration, but no client can grant it. A billing release still needs real store products, purchase verification, restore purchases, and refund/revocation handling. Do not set `source = 'purchase'` from a client or add a button that pretends to complete a purchase.

The lifetime referral reward should cover the defined Plus personalization package. Avoid promising unlimited future AI processing with a lifetime cosmetic reward: model inference has ongoing costs. Price/allowance decisions should be made when the AI product exists.

If adding social features later, start with optional sharing of a selected collection or a designed capture card. Do not turn the private inbox into a feed. Private profile names and useful invitations are sufficient for the current version.

## AI later

Keep the current synchronous classifier as a fallback and preserve the capture-first contract. An optional model should refine classification after local persistence, not add a network call before saving. Respect the person's manual category choice. Add explicit, opt-in correction collection before using any private captures as training data; this update adds no training upload or model dependency.

Use an evaluation set from permissioned examples before deciding to train. Measure mistakes across notes, tasks, contacts, links, amounts, dates, and mixed-content inputs. A smaller model is useful only if it improves those errors without making capture slower or unpredictable.

## Validation

```sh
npm run check
npm run test:db
deno check _support/supabase/functions/whatsapp-webhook/index.ts
```

`test:db` uses PGlite (local PostgreSQL) with test auth roles and an in-memory database. It never touches production. It exercises reward qualification, client privilege boundaries, pairing ownership/expiry, duplicate delivery, deletion/retry, and disconnect. It does not emulate Supabase Realtime, Meta delivery, OS background execution, or store installation attestation.

Relevant primary documentation:
- [Expo SDK 57](https://docs.expo.dev/versions/v57.0.0/)
- [Expo SDK 57 Crypto](https://docs.expo.dev/versions/v57.0.0/sdk/crypto/)
- [WhatsApp Business developer hub](https://whatsappbusiness.com/developers/developer-hub/)
- [Meta's webhook signature behavior](https://whatsapp.github.io/WhatsApp-Nodejs-SDK/api-reference/webhooks/start/) (archived SDK documentation; the implementation here does not use that SDK)
- [Supabase Edge Function authentication](https://supabase.com/docs/guides/functions/auth)
- [Supabase server-side secrets](https://supabase.com/docs/guides/functions/secrets)
