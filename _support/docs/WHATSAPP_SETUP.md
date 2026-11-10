# Pouch WhatsApp setup and deployment status

## Status checked November 10, 2026

Connected Supabase project: `ibaswbzmtzhmbydbpdwa` (dashboard name `buffer`). Its URL matches this app's local configuration.

| Component | Status |
| --- | --- |
| Existing items schema | Inspected; ownership RLS enabled and user deletion cascades configured |
| Profile/referral/WhatsApp migration | **Pending**: connector confirmations expired; no successful migration reported |
| `delete-account` Edge Function | Deployed, version 1; missing/invalid token returns 401; GET returns 405 |
| `whatsapp-webhook` Edge Function | Deployed, version 1; returns 503 `Not configured` until Meta secrets are supplied |
| Meta business app and Pouch phone number | Owner confirmed neither is set up yet |
| Real WhatsApp-to-inbox capture | **Not tested or enabled** |
| Real account-deletion test | Pending a disposable account; no existing account was deleted |

The pending migration is `_support/supabase/migrations/202611040001_space_and_whatsapp.sql`. It has passed local PostgreSQL tests. It adds isolated tables/RPCs and an item-insert trigger; it does not replace existing tables. The live project also contains older Pouch tables and functions that this change leaves intact. The deployed receiver cannot save captures until this migration succeeds.

The Supabase connector requires its own confirmation for `apply_migration`; those requests expired in this session. Approve a fresh connector request when available, or review and run the same SQL once in the project's SQL Editor. First check that `public.whatsapp_links` and the migration do not already exist. After success, verify the schema, permissions and advisors, and run the two-account acceptance checks below. Do not treat a deployed Edge Function as proof of a completed database deployment.

## What the experience actually is

Pouch gets one business contact. Each person connects their own existing WhatsApp number by sending the short-lived connection message from Pouch. After returning to Pouch to confirm the link, they send notes or links to that business contact and find them sorted in their private Pouch inbox.

This does not automatically monitor a personal “Message yourself” chat. For an existing self-chat, use Share → Pouch when offered, or copy/paste. No QR login, personal chat-session scraping, or contacts upload is involved. Users do not need to buy another number.

Pouch's operator does need a business number for production. Start with Meta's provided test number while setting up; there is no reason to buy a number before testing the integration. For production, use a dedicated number you control and can verify through Meta's onboarding. Avoid moving your personal WhatsApp number. Meta's current onboarding determines registration and verification requirements.

## Owner setup, in order

1. Start at the [official WhatsApp developer hub](https://whatsappbusiness.com/developers/developer-hub/). Register/sign in as a Meta developer, create the Pouch app with the WhatsApp Business Platform use case, and connect the required business portfolio/account. Complete identity, terms and any business verification directly with Meta.
2. Use the provided test number and authorized test participants first. Keep the **phone number ID**, **business account ID**, and the actual **phone number** distinct. Only the phone number ID goes in `WHATSAPP_PHONE_NUMBER_ID`.
3. Open [Supabase Edge Function Secrets](https://supabase.com/dashboard/project/ibaswbzmtzhmbydbpdwa/functions/secrets) and configure:

   | Secret | Value |
   | --- | --- |
   | `WHATSAPP_APP_SECRET` | The app secret from the Pouch Meta app; validates signed deliveries |
   | `WHATSAPP_VERIFY_TOKEN` | A long random value you generate and use identically in Meta's webhook setup |
   | `WHATSAPP_PHONE_NUMBER_ID` | Meta's ID for the selected test/production business number |

   Enter these directly in the dashboard. Do not paste secrets into chat, GitHub, screenshots, or any `EXPO_PUBLIC_` setting. Supabase supplies the function's service-role key server-side. This inbound-only receiver does not require a stored Graph API access token; Meta may require one for onboarding/subscription steps. Do not add an outbound token to the mobile app.
4. In the Meta app's WhatsApp webhook configuration, use callback URL `https://ibaswbzmtzhmbydbpdwa.supabase.co/functions/v1/whatsapp-webhook` and the matching verification token. Subscribe to `messages` and ensure the app is subscribed to the intended WhatsApp Business Account. Follow Meta's current dashboard requirements for production access. A successful webhook challenge alone does not prove real incoming messages are being delivered.
5. Complete the pending database migration before testing captures. Verify the receiver returns 401 for unsigned POST requests after secrets are configured. It must never accept an arbitrary public POST as a message.
6. For the test build only, set `EXPO_PUBLIC_WHATSAPP_NUMBER` to the test business number in international digits-only format, then rebuild/relaunch with that environment. Keep it unset in a production build until real-number capture passes acceptance testing.
7. Before launch, register the dedicated production number through Meta, complete the required account checks, update the phone number ID secret and public phone number, and repeat acceptance testing against production configuration. Publish privacy/support pages and accurately disclose WhatsApp processing. Any Meta fees or verification requirements must be reviewed in your own account.

## Acceptance checks before enabling production

- Account A sends its connection message and sees its own masked number in Pouch. A normal note, a link, an expense, and a task appear in A's inbox. Account B cannot see those captures.
- Account B cannot take over A's already-linked phone number. Expired/reused connection tokens do not establish a new connection and never become notes.
- A duplicate Meta delivery produces one item. Deleting that item and redelivering does not recreate it. A database failure produces a retriable non-2xx response.
- Unknown or disconnected senders cannot create items. Disconnect/reconnect does not import older messages. Test “tomorrow” against the sender's local date.
- Invalid signatures fail before database access. Logs and alerts contain status/count information without private text or pairing codes.
- On a disposable account only, use in-app deletion. Confirm the Auth user, saved items, profile and WhatsApp mapping disappear; another account remains intact. Confirm revoked/deleted-account credentials cannot recreate data.
- Repeat app capture and native Share → Pouch on a physical iPhone, with background/relaunch, poor connectivity and account switching.

## Privacy and practical limits

Only new text and links sent to the connected Pouch contact are supported. Media, voice notes, historical imports and automatic replies are not implemented. Check the Pouch inbox for save confirmation; WhatsApp delivery is not a Pouch-save receipt.

Saved captures and the sender identifier are processed on Pouch's backend. Ownership policies restrict access through the app; this is not an end-to-end encrypted personal vault against the service operator. Disconnect stops future imports and leaves existing captures. Deleting the account removes live owned records; the public privacy policy must describe backup retention according to actual Supabase settings.

The security advisor currently reports intentionally restricted tables without direct client policies and authenticated security-definer RPCs, plus disabled leaked-password protection on the project. Review advisor output after migration; do not add permissive policies merely to clear a warning. Pouch currently uses email-code login. If password login is enabled later, review that Auth setting as well.

Remaining Apple, SMTP, privacy, build and review steps are in [APP_STORE_RELEASE.md](APP_STORE_RELEASE.md).
