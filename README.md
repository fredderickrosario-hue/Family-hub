# Family Hub — setup

Working title, rename anytime (change `name`/`short_name` in `manifest.json`
and the `<h1>` in `index.html`).

## What's built so far
Skylight-inspired light UI — colour-coded family profiles, big touch targets,
readable from across the room. Bottom tab bar in portrait, left sidebar in
landscape (`@media (min-width: 768px)`). PWA install + offline shell cache.

- **Calendar** — month grid, today highlighted, coloured dots per entry type,
  tap a day to view everything and quick-add an event / chore / meal.
- **Chores** — Overdue / Due Today / Upcoming / Completed, big satisfying
  checkboxes, kid points, **recurring chores** (daily / weekly / monthly —
  completing advances the due date and keeps a "Done today" badge), scoreboard,
  rewards catalogue with point redemption.
- **Budget** — payments (in) / payouts (out), Pending & Done sections, running
  in / out / net summary, tap to mark done or edit.
- **Meals** — weekly grid (breakfast/lunch/dinner × 7 days), today highlighted,
  "add ingredients to grocery" per meal and "Week → Grocery" for the whole week.
- **Grocery** — big checklist, typed or voice add, auto-category grouping,
  checked items drop to Done, prominent "N to get" count.
- **Family** — add/edit members, pick a colour, mark kids, adjust points.

### Code layout
- `state.js` — single source of truth: all Firestore listeners, shared state,
  date/profile helpers. Every tab imports from here.
- `ui.js` — generic modal form builder + toast.
- `app.js` — shell: header, tab switching, calendar, day sheet, init.
- `chores.js` / `budget.js` / `meals.js` / `grocery.js` / `profiles.js` — one per tab.

Note: `profiles` is the single family-member collection (points live on the
kid profile doc); the older separate `kids` collection is not used.

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
- `events` — {title, date, time, notes, createdAt}
- `chores` — {title, assignee, isKidChore, points, dueDate, completed,
  completedAt, completionDate, recurring, recurrenceDays, createdAt}
- `rewards` — {name, cost, createdAt}
- `budgetEntries` — {party, amount, type, date, status, notes, createdAt}
- `meals` — {date, mealType, description, ingredients, notes, createdAt}
- `groceryItems` — {name, checked, addedDate, category, createdAt}
- `profiles` — {name, color, isKid, avatar, points, createdAt}

## Next steps / out of scope
- Google Calendar read-only relay (Firebase Cloud Function proxying the iCal feed)
- Google Keep sync for the grocery list
- Lock down Firestore rules before the family goes live
- Bump `CACHE_NAME` in `service-worker.js` on every deploy (currently `v3`)
