# Google Calendar sync (read-only)

The Family Hub can show your Google Calendar on the month grid. It **only
reads** — nothing is ever written back to your calendar.

A browser can't read a private Google Calendar directly, so a tiny Google
Apps Script "web app" sits in the middle and hands the Hub your events as
JSON. It runs under your own Google account, so there's no separate login
or OAuth setup.

## One-time setup (~3 minutes)

1. Go to **<https://script.google.com>** → **New project**.
2. Delete the sample code and paste the entire contents of
   [`calendar-relay.gs`](calendar-relay.gs).
3. Change the `SHARED_TOKEN` value to a long random string of your own
   (letters + numbers, ~30 chars). Keep a copy — you'll paste it into the Hub.
4. *(Optional)* set `CALENDAR_ID` to a specific calendar's ID if you don't
   want your primary one. Find it in Google Calendar → that calendar's
   **Settings → Integrate calendar → Calendar ID**.
5. **Deploy → New deployment**:
   - Gear icon → type **Web app**
   - **Execute as:** Me
   - **Who has access:** Anyone
   - **Deploy**, then authorise when Google asks (it will warn the app is
     "unverified" — it's your own script; click *Advanced → go to project*).
6. Copy the **Web app URL** (ends in `/exec`).
7. In the Family Hub → **Calendar** tab → **Sync** button → paste the URL
   and the same token → **Test & connect**.

Do this on each device you want calendar sync on (phone, kitchen display,
laptop). The URL + token are stored only in that device's browser, never
in the shared database.

## Changing the token later

Edit `SHARED_TOKEN` in the script, then **Deploy → Manage deployments →
edit (pencil) → Version: New version → Deploy**. Re-enter the new token in
the Hub.

## Notes

- The relay is capped to the visible month (± ~1 month) per request.
- If "Test & connect" fails: check the URL ends in `/exec`, the token
  matches exactly, and the deployment's access is **Anyone**.
