# Pouch — how the app works

Pouch is a zero-friction inbox: type or share something, it lands in one list, auto-sorted by simple rules. No folders, no manual tags at save time.

---

## Quick start

```bash
cp .env.example .env          # add Supabase URL + anon key
npm install
npm run web                   # or npm run ios / android
```

Run SQL migrations in Supabase (in order if upgrading an existing DB):

1. `_support/supabase/migration.sql` — fresh project
2. `_support/supabase/migration-v2.sql` — if you already had v1
3. `_support/supabase/migration-v3.sql` — priority, due dates, contact/quote types

---

## User flow

```
Open app → (signed in?) → Inbox
                ↓ no
           Auth: email → 6-digit code → session saved locally

Inbox: type in bottom bar → Enter → classifyItem() → insert Supabase → list updates (realtime)

Tap row → Item detail → edit / delete / task priority / expense account

Footer → Accounts → balances + monthly CSV export
```

**Auth persistence:** After you verify the email code once, Supabase stores a refresh token in AsyncStorage (mobile) or localStorage (web). You should not need to log in every visit unless you sign out or clear site data.

---

## Project layout — what to read vs ignore

### Read these (your app logic)


| Path                              | Purpose                                           |
| --------------------------------- | ------------------------------------------------- |
| `src/app/index.tsx`               | Inbox screen — list, search, filters, capture bar |
| `src/app/item/[id].tsx`           | Item detail — edit, delete, task/expense fields   |
| `src/app/auth.tsx`                | Email + OTP login UI                              |
| `src/app/accounts.tsx`            | Cash/GPay balances + CSV export                   |
| `src/app/_layout.tsx`             | Root navigation, auth gate, share-intent wrapper  |
| `src/lib/classifyItem.ts`         | **Auto-detection rules** (link, expense, task, …) |
| `src/lib/items.ts`                | Supabase CRUD for items                           |
| `src/lib/urls.ts`                 | URL parsing + split text so only links are blue   |
| `src/contexts/AuthContext.tsx`    | Login state + OTP                                 |
| `src/contexts/ItemsContext.tsx`   | Shared inbox state + realtime                     |
| `src/types/item.ts`               | TypeScript types for items                        |
| `src/constants/ui.ts`             | Colors, typography                                |
| `src/components/rich-content.tsx` | Renders mixed text + clickable URLs               |


### Support files (helpful but secondary)


| Path                                 | Purpose                                        |
| ------------------------------------ | ---------------------------------------------- |
| `src/components/filter-bar.tsx`      | All / Links / Tasks chips                      |
| `src/components/type-picker.tsx`     | Change item type on detail                     |
| `src/components/priority-picker.tsx` | Task priority                                  |
| `src/components/date-field.tsx`      | Date picker                                    |
| `src/components/confirm-dialog.tsx`  | Delete confirmation (works on web)             |
| `src/hooks/useShareIntentCapture.ts` | Saves shares from other apps (needs dev build) |
| `src/lib/accounts.ts`                | Balance math + CSV rows                        |
| `src/lib/export.ts`                  | Download/share CSV file                        |
| `src/lib/contacts.ts`                | Phone → call / WhatsApp                        |
| `src/lib/auth-storage.ts`            | Remember last email                            |
| `src/lib/auth-callback.ts`           | Magic-link deep links (fallback)               |


### Tests


| Path                           | Purpose               |
| ------------------------------ | --------------------- |
| `src/lib/classifyItem.test.ts` | Classifier unit tests |
| `src/lib/urls.test.ts`         | URL splitting tests   |


Run: `npm test`

### Config / infra (touch rarely)


| Path                                       | Purpose                                              |
| ------------------------------------------ | ---------------------------------------------------- |
| `app.json`                                 | Expo config, share-intent plugin                     |
| `eas.json`                                 | EAS Build profiles (needs $99 Apple Developer later) |
| `.env`                                     | Supabase keys (not in git)                           |
| `_support/supabase/*.sql`                  | Database migrations                                  |
| `_support/scripts/clear-apple-keychain.js` | Fixes wrong Apple password during EAS setup          |


### Safe to ignore


| Path                     | Why                                       |
| ------------------------ | ----------------------------------------- |
| `node_modules/`          | Dependencies                              |
| `.expo/`                 | Local Expo cache                          |
| `assets/`                | App icons only                            |
| `_support/`              | Docs, SQL, scripts — not app runtime code |
| `AGENTS.md`, `CLAUDE.md` | AI assistant notes                        |


---

## How classification works

On save, `classifyItem(content)` in `src/lib/classifyItem.ts` runs **before** insert:

1. URL present → **link**
2. Money keywords + number → **expense** (cash/gpay, in/out)
3. Phone number → **contact**
4. Quoted / forwarded text → **quote**
5. Task verbs / todo / urgent → **task** (+ priority, due date hints)
6. Else → **note**

Priority order matters: a string with both a URL and "spent 500" becomes a **link**.

To change behavior, edit `classifyItem.ts` and run `npm test`.

---

## Inline link styling

`splitContentByUrls()` in `src/lib/urls.ts` splits:

`youtube https://www.youtube.com/watch?v=abc`

into `[{ text: "youtube " }, { link: "https://..." }]`.

`RichContent` renders only the URL in blue and tappable. The word "youtube" stays normal text.

---

## Sharing from Instagram / WhatsApp (reels, links, text)

**Not available in Expo Go or web.** Requires:

1. **Apple Developer Program** ($99/year) — enroll when the app is ready
2. **EAS dev build** on your phone (`npm run build:ios`)
3. `expo-share-intent` (already in `app.json`)

### After you pay for Apple Developer

```bash
npm run eas:login
npm run device:ios          # register your iPhone
npm run build:ios           # cloud build (~15 min)
# Install .ipa from expo.dev link on your phone
npm start                   # dev server; open Pouch dev client (not Expo Go)
```

Then: Instagram → Share → **Pouch** → item saved with `source: share-instagram`.

**Reels:** Instagram often shares a **link** to the reel, not the video file. Pouch will save that URL as a **link** item — which is what you want for finding it later.

Android: same flow with `npm run build:android`; share sheet works without Apple's $99, but iOS needs it.

---

## Replacing keyword rules with a small neural network

Today, classification is **regex + keywords** — fast, offline, no API cost, easy to debug. When you outgrow it:

### Option A — Tiny on-device model (recommended later)

1. **Export training data** from your own items:
  ```sql
   SELECT content, type FROM items WHERE user_id = 'you';
  ```
2. **Label** a few hundred rows (your past saves are ground truth).
3. **Train a small classifier** — don't start from scratch:
  - **TensorFlow.js** + MobileNet text embedding + 2-layer dense head
  - Or **transformers.js** `Xenova/distilbert-base-uncased` fine-tuned on your 5 classes
4. **Run in app** via `@tensorflow/tfjs-react-native` or a Cloud Function.

Pipeline:

```
content → tokenizer → embedding (128–768 dims) → softmax over [note, link, task, expense, contact, quote]
```

Keep `classifyItem()` as fallback if the model fails or offline.

### Option B — Supabase Edge Function + API

Send `content` to an edge function that calls OpenAI / a hosted model. Adds latency and cost — fine for v2, not for "under 2 seconds capture."

### Option C — Hybrid (practical)

```typescript
// src/lib/classifyItem.ts
export async function classifyItemSmart(content: string) {
  const rules = classifyItem(content);           // always run first (links, URLs)
  if (rules.type === 'link') return rules;

  const ml = await runLocalClassifier(content);    // your tiny net
  if (ml.confidence > 0.85) return ml;

  return rules;                                  // fallback
}
```

### Building a *very simple* net yourself

1. **Features:** bag-of-words or 50-dim embedding from a pretrained model (don't train embeddings from scratch on 200 examples).
2. **Architecture:** `Dense(64, relu) → Dropout(0.2) → Dense(6, softmax)`.
3. **Train:** Python + Keras, ~5 minutes on CPU with 500 labeled lines.
4. **Convert:** TensorFlow.js converter → `model.json` in `assets/model/`.
5. **Integrate:** load once in app, inference <10ms on phone.

**When to switch:** when keyword rules feel wrong often *and* you have 300+ labeled examples from your own usage.

Until then, extend `classifyItem.ts` — it's the right tool.

---

## Commands


| Command                        | What it does                          |
| ------------------------------ | ------------------------------------- |
| `npm run web`                  | Run in browser                        |
| `npm start`                    | Metro for phone dev client            |
| `npm test`                     | Unit tests                            |
| `npm run build:ios`            | EAS iOS build (after Apple Developer) |
| `npm run apple:clear-keychain` | Fix cached wrong Apple password       |


---

## Supabase

- **Auth:** Email OTP; session in client storage
- **Table:** `items` with RLS (`user_id = auth.uid()`)
- **Realtime:** inbox subscribes to `postgres_changes` on `items`

Dashboard: [supabase.com/dashboard](https://supabase.com/dashboard)