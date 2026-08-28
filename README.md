# Family Hub — setup

Working title, rename anytime (change `name`/`short_name` in `manifest.json`
and the `<h1>` in `index.html`).

## What's built so far
- Full app shell: breaker-panel tab nav (Main / Chores / Budget / Meal / Grocery)
  with status LEDs, install-to-device PWA support, offline shell caching.
- **Main calendar tab**: month grid, tap a day to see/add entries, real-time
  sync across every device that has the page open.
- Chores, Budget, Meal, Grocery tabs are placeholders — next passes.

## 1. Create your Firebase project (free)
1. Go to https://console.firebase.google.com → **Add project** → name it
   anything (e.g. "family-hub") → you can skip Google Analytics.
2. Once created: **Build → Firestore Database → Create database** →
   start in **production mode** → pick a region close to you.
3. Firestore rules: for now, while it's just your household and not yet
   public, go to the **Rules** tab and use:
   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /{document=**} {
         allow read, write: if true;
       }
     }
   }
   ```
   This is wide open — fine while you're building and testing solo. Before
   this goes on a shared/family device, we'll lock it down (e.g. write
   access only from an authenticated device, read-only for the kiosk).
4. **Project settings** (gear icon) → scroll to **Your apps** → click the
   `</>` (web) icon → register the app (nickname anything, skip Firebase
   Hosting) → copy the `firebaseConfig` object it gives you.
5. Paste those values into `firebase-config.js`, replacing the
   `REPLACE_ME` placeholders.

## 2. Host it (same pattern as Battle Plan)
Push this folder to a GitHub repo and enable **GitHub Pages** on it
(Settings → Pages → deploy from the branch/folder). Once live, open the
URL on your phone and use "Add to Home Screen" to install it — same as
Battle Plan.

## 3. Google Calendar (read-only) — when you're ready
Browsers block a webpage from fetching Google's private calendar feed
directly (CORS), so it needs a small relay. Cleanest option since you're
already on Firebase: a **Firebase Cloud Function** that fetches your
calendar's private iCal address server-side, parses it, and returns
JSON. I'll build that function plus the fetch call in `app.js` when you're
ready for this piece — just flag it and we'll wire it in.

## Data model (Firestore collections)
- `events` — {title, date, time, notes} — main tab, already wired
- `chores` — {title, assignee, assigneeType, points, dueDate, completed}
- `budgetEntries` — {party, amount, type, date, status}
- `meals` — {date, mealType, description}
- `groceryItems` — {name, checked}

## Next steps
Say the word and we'll build out Chores (with the kid points/reward
system), Budget, Meal, and Grocery the same way — each tab follows the
same pattern already set up in `app.js`.
