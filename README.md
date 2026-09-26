# Pouch

Personal capture inbox — save thoughts, links, tasks, and expenses in under 2 seconds.

**Full documentation:** [_support/docs/HOW_IT_WORKS.md](_support/docs/HOW_IT_WORKS.md)

```bash
cp .env.example .env   # set your Supabase URL and anon key
npm ci
npm run web
```

Non-app files (SQL migrations, docs, scripts) are in [`_support/`](_support/).


## Inbox improvements

- Capture preview shows the detected type, amount, and due date before saving.
- Search matches multiple words across content, accounts, types, and sources.
- Tasks have All, Open, Today, Overdue, and Done views; sort by newest, oldest, or priority and due date.
- Editing preserves manually chosen types and metadata. Due dates can be removed.
- Failed shares stay available for retry; failed deletes restore the item.
- Full inbox pagination keeps older captures in searches and account totals.
- Monthly CSVs carry forward opening balances and calculate money in integer paise.

No database migration is required for these changes. Authentication and sync still require your configured Supabase project. Capture is not offline-first: wait for save confirmation before closing the app.

Run `npm run check` for TypeScript, lint, and regression tests. See [_support/docs/IMPROVEMENTS.md](_support/docs/IMPROVEMENTS.md) for the review and remaining limitations.
