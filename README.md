# Pouch

Personal capture inbox — save thoughts, links, tasks, and expenses in under 2 seconds.

**Full documentation:** [_support/docs/HOW_IT_WORKS.md](_support/docs/HOW_IT_WORKS.md)

**Install on your iPhone:** [_support/docs/IPHONE_TESTING.md](_support/docs/IPHONE_TESTING.md)

**Capture improvements, WhatsApp setup, referrals, and Plus:** [_support/docs/PRODUCT_AND_LAUNCH.md](_support/docs/PRODUCT_AND_LAUNCH.md)

New captures save to a per-account device outbox first, then sync to Supabase. The WhatsApp receiver and referral rewards require the new backend migration; see the setup guide before enabling them. Paid checkout is not enabled.

```bash
npm install
npm run web
```

Non-app files (SQL migrations, docs, scripts) are in [`_support/`](_support/).

**App Store release checklist:** [_support/docs/APP_STORE_RELEASE.md](_support/docs/APP_STORE_RELEASE.md)
