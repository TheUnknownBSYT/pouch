# App Store release — Pouch 1.0

## Verdict

The core product is substantial enough for a focused free v1: capture, local sorting, search, editable tasks, expenses, CSV export, offline capture and native sharing. More AI or social features are not prerequisites. App Store approval cannot be guaranteed by a code audit.

The repository is not a deployed, device-tested release. Do not submit until the checklist below is complete. Plus sales are unfinished and remain outside the initial release. Reward promotion is now disabled unless EXPO_PUBLIC_ENABLE_REWARDS=true. Direct WhatsApp capture is optional and needs a configured Meta number and deployed receiver; ordinary share-to-Pouch works independently.

## What has been added for release

Deployment update: both Edge Functions are deployed to the connected project. The profile/WhatsApp database migration is still pending because the Supabase connector's confirmations expired. WhatsApp is not enabled: the owner has not yet created the Meta app or business number. See [WHATSAPP_SETUP.md](WHATSAPP_SETUP.md) for verified endpoint results and the exact remaining setup.

- In-app Delete account with an irreversible-action confirmation, an authenticated server endpoint, and device-cache removal after server success. The server derives identity from auth.getUser(token), never from a client-supplied account ID, then revokes refresh sessions globally before deletion. Existing access JWTs expire normally; foreign keys cascade owned records and prevent their recreation after the Auth user is deleted.
- Privacy and support links in Your space, plus a privacy link before sign-in.
- Production build validation refuses missing or placeholder privacy/support URLs.
- Launch flags keep unfinished reward marketing out of the default build.

## Your Apple account: no Swift rewrite

Expo/React Native builds a native iOS application. Swift is not required. EAS Build compiles and signs the app, and EAS Submit uploads it to App Store Connect.

1. Enroll your Apple Account (formerly Apple ID) in the paid Apple Developer Program. Enable two-factor authentication. Review Apple's current local enrollment price. For individual enrollment, your legal name normally appears as seller; an organization needs its legal entity and enrollment verification.
2. Create an Expo account if needed and run `npm run eas:login`.
3. When EAS asks you to sign into Apple for signing setup, enter your credentials directly in the CLI/browser yourself. Do not place your Apple password or 2FA codes in source files, .env, or chat.
4. Retain the configured bundle ID `com.siddhant2612.pouch`. EAS needs the app identifier, distribution certificate, provisioning profile, and App Group/share-extension identifier. Let its credential flow manage these. Your Apple login is for developer signing; it does not add Sign in with Apple to the product. Email-only authentication is a separate flow.

## Before building

1. Apply the item schema and the space/WhatsApp migration as documented in PRODUCT_AND_LAUNCH.md. Verify row-level access with two different test accounts.
2. Deploy the deletion endpoint:
   `npx supabase --workdir _support functions deploy delete-account --project-ref YOUR_PROJECT_REF`
   It reads the server-injected Supabase URL/service-role key. Its config disables gateway JWT checks because the function explicitly validates the user token with Supabase Auth. Never remove that validation.
3. Test deletion on a disposable account: create captures and a profile, delete in the app, confirm auth user and dependent data disappear, and confirm a different account remains untouched. Test invalid/expired sessions and offline errors. Do not delete your main account as a test.
4. Configure production Supabase email delivery (SMTP), OTP email template, sender identity, redirect URLs and rate limits. Verify first sign-in, resend/retry, expired codes, returning sessions and sign-out on a physical phone. Do not depend on a restricted development email service.
5. Publish a truthful privacy policy and support page at HTTPS URLs you control. Set EXPO_PUBLIC_PRIVACY_URL and EXPO_PUBLIC_SUPPORT_URL in the EAS **production** environment, along with EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY. Local .env values alone are not enough for cloud builds.
6. Keep EXPO_PUBLIC_ENABLE_REWARDS=false for the initial release. Do not advertise paid Plus, subscriptions, automatic self-chat mirroring, voice notes, or AI. If direct WhatsApp is advertised, complete and test its deployment first; otherwise omit EXPO_PUBLIC_WHATSAPP_NUMBER.
7. Run `npm run check`, `npm run test:db`, and `node --env-file=.env _support/scripts/check-ios-build.js --production`. The last command intentionally fails until real public policy/support links exist. This validates configuration, not whether pages are reachable or their content accurate.

Privacy policy content to supply: your identity and contact, email/account IDs, user-saved content (including potentially financial/contact information), Supabase processing and retention, device caches, deletion behavior, backup retention based on actual service settings, and Meta processing only if WhatsApp integration is enabled. Describe actual analytics/crash SDK behavior; do not claim data is never collected when the app stores it on a server. There is no training-data upload or advertising SDK intentionally added by this implementation. Have the policy reflect your actual production configuration.

## Build and TestFlight

1. Run `npm run build:ios:production`. This is the App Store build; `build:ios` is a development client and is not the submission artifact.
2. In App Store Connect, create the app under your developer team with the same bundle ID, name, primary language and a unique SKU. Keep the numeric App Store Connect app ID for EAS Submit configuration if prompted.
3. Run `npm run submit:ios` and select the successful production build. EAS may guide you through App Store Connect API-key setup. Uploading does not publish or submit the app for review automatically.
4. Wait for Apple processing, complete any export-compliance questions truthfully, and install through TestFlight. Existing encryption configuration assumes only exempt encryption; review it against the actual shipped functionality.
5. Test on real iPhones: keyboard/composer, light/dark mode, larger text, VoiceOver labels, long notes/URLs, category correction, task dates, expense export, app background/relaunch, offline save then reconnect, repeated share-sheet captures, account switching, and deletion. Confirm app icon and share-extension behavior in the installed binary. Native dependencies/share extensions require a new binary; Metro/web success is insufficient.
6. Have several people unfamiliar with the app complete “save a note, find it, share a link into Pouch” unaided. Fix crashes, lost data, blocked sign-in and confusing states before adding more features.

## App Store Connect and review

- Add actual device screenshots, icon/build, description, subtitle, keywords, category, age-rating answers, copyright, support URL and privacy-policy URL. Use truthful screenshots of the final build, not unimplemented Figma concepts.
- Complete App Privacy answers from the actual data flow and SDKs: account email/identifiers and saved content are linked to an account. Review contact/financial/user-content categories based on the content handled, and disclose optional WhatsApp sender identifiers when enabled. Verify third-party SDK privacy manifests and required-reason API declarations in the generated archive; don't guess manifest reasons to silence warnings.
- Set availability and pricing for a free initial release. StoreKit purchases, verified receipts, restore purchases and refund handling are future work before selling digital Plus features. There is no working payment system in this build.
- Add App Review contact details and reliable instructions for email-code login. Reviewers must be able to access the app without your intervention: validate the reviewer path, explain that they can create an account using their own accessible email if appropriate, and provide whatever review account/access Apple requests. Never ship a universal OTP or hard-coded auth bypass.
- Explain native Share → Pouch, offline sync, and where account deletion lives (Your space → Your account → Delete account). Keep the backend online throughout review.
- Select the processed build, complete required fields, add it to the review submission and submit. Choose manual release if you want control over launch timing after approval. Respond to App Review questions in App Store Connect.

## Still owner-dependent

Developer enrollment/payment, real URLs and privacy disclosures, backend deployment credentials, production SMTP, real-phone/TestFlight validation, review-access arrangements and store metadata cannot be completed from this repository alone. No production account was deleted and no Apple purchase, build upload or submission was performed by the audit.

Primary references (checked November 7, 2026):
- https://developer.apple.com/app-store/review/guidelines/
- https://developer.apple.com/help/app-review/guideline-reference/5-1-1-account-deletion
- https://developer.apple.com/programs/enroll/
- https://docs.expo.dev/submit/ios/
- https://supabase.com/docs/reference/javascript/auth-admin-deleteuser
