/* ============================================================
   FAMILY HUB — Google Calendar sync (READ-ONLY)
   Browsers can't read a private Google Calendar directly, so a
   tiny Apps Script web app relays it as JSON. See apps-script/.
   Config (relay URL + shared token) lives in localStorage per
   device — it never touches the open Firestore database.
   ============================================================ */
import { state } from "./state.js";
import { openModal, toast } from "./ui.js";

const LS_KEY = "familyhub.gcal";

export function gcalConfig(){
  try { return JSON.parse(localStorage.getItem(LS_KEY) || "null"); }
  catch { return null; }
}
export function gcalEnabled(){
  const c = gcalConfig();
  return !!(c && c.url && c.token);
}
function saveConfig(c){ localStorage.setItem(LS_KEY, JSON.stringify(c)); }
function clearConfig(){ localStorage.removeItem(LS_KEY); }

let cache = { key: "", ts: 0, inflight: null };
export function bustGcalCache(){ cache = { key: "", ts: 0, inflight: null }; }

/* Fetch the visible month (+/- a month of spill) from the relay.
   Returns true when state.gcalEvents actually changed. */
export async function gcalFetchMonth(viewDate){
  if (!gcalEnabled()){
    if (state.gcalEvents.length){ state.gcalEvents = []; return true; }
    return false;
  }
  const y = viewDate.getFullYear(), m = viewDate.getMonth();
  const key = `${y}-${m}`;
  if (cache.key === key && Date.now() - cache.ts < 120000) return false;
  if (cache.inflight) return cache.inflight;

  const c = gcalConfig();
  const start = new Date(y, m - 1, 15).toISOString();
  const end   = new Date(y, m + 2, 15).toISOString();
  const url = `${c.url}?token=${encodeURIComponent(c.token)}` +
             `&start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`;

  cache.inflight = fetch(url)
    .then(r => r.json())
    .then(data => {
      if (data.error) throw new Error(data.error);
      state.gcalEvents = (data.events || []).map(ev => ({ ...ev, source: "gcal" }));
      cache = { key, ts: Date.now(), inflight: null };
      return true;
    })
    .catch(err => {
      console.warn("Google Calendar sync:", err.message);
      cache.inflight = null;
      return false;
    });
  return cache.inflight;
}

async function testRelay(url, token){
  const q = `?token=${encodeURIComponent(token)}` +
            `&start=${new Date().toISOString()}` +
            `&end=${new Date(Date.now() + 86400000).toISOString()}`;
  const r = await fetch(url + q);
  const d = await r.json();
  if (d.error) throw new Error(d.error);
  if (!Array.isArray(d.events)) throw new Error("Unexpected response");
  return d.events.length;
}

/* Settings modal. onDone() is called after connect/disconnect so the
   caller can refresh the calendar. */
export function openGcalSettings(onDone){
  const c = gcalConfig() || {};
  openModal({
    title: gcalEnabled() ? "Google Calendar sync" : "Connect Google Calendar",
    submitLabel: "Test & connect",
    deleteLabel: "Disconnect",
    fields: [
      { name: "url", label: "Relay URL", type: "text", required: true, value: c.url || "",
        placeholder: "https://script.google.com/macros/s/…/exec",
        hint: "The Apps Script web-app URL — see apps-script/README.md" },
      { name: "token", label: "Shared token", type: "text", required: true, value: c.token || "",
        hint: "Must match SHARED_TOKEN in the script" }
    ],
    onDelete: gcalEnabled() ? async () => {
      clearConfig();
      state.gcalEvents = [];
      bustGcalCache();
      toast("Google Calendar disconnected");
      onDone && onDone();
    } : null,
    onSubmit: async (d) => {
      const url = d.url.replace(/\s+/g, "");
      let n;
      try { n = await testRelay(url, d.token); }
      catch (err){ throw new Error(`Couldn't reach the relay — check the URL and token (${err.message})`); }
      saveConfig({ url, token: d.token });
      bustGcalCache();
      toast(n === 0 ? "Connected — no events in range yet" : `Connected — found ${n} event${n === 1 ? "" : "s"}`);
      onDone && onDone();
    }
  });
}
