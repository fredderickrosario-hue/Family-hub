/* ============================================================
   FAMILY HUB — Google Calendar sync (READ-ONLY)
   A tiny Apps Script web app relays the calendar(s) as JSON.
   Config (relay URL + shared token + which calendars) lives in
   localStorage per device — never in the open Firestore.
   ============================================================ */
import { state } from "./state.js";
import { openModal, toast } from "./ui.js";
import { t } from "./i18n.js";

const LS_KEY = "familyhub.gcal";

export function gcalConfig(){
  try { return JSON.parse(localStorage.getItem(LS_KEY) || "null"); }
  catch { return null; }
}
export function gcalEnabled(){
  const c = gcalConfig();
  return !!(c && c.url && c.token);
}
export function saveGcalConfig(patch){
  saveConfig({ ...(gcalConfig() || {}), ...patch });
  bustGcalCache();
}
function saveConfig(c){ try { localStorage.setItem(LS_KEY, JSON.stringify(c)); } catch {} }
function clearConfig(){ try { localStorage.removeItem(LS_KEY); } catch {} }

/** ids of calendars to sync; empty array / undefined = all */
export function selectedCals(){
  const c = gcalConfig();
  return Array.isArray(c?.cals) ? c.cals : null;
}
export function setSelectedCals(ids){
  saveGcalConfig({ cals: ids });
}

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
  const sel = selectedCals();
  const key = `${y}-${m}|${(sel || []).join(",")}`;
  if (cache.key === key && Date.now() - cache.ts < 120000) return false;
  if (cache.inflight) return cache.inflight;

  const c = gcalConfig();
  const start = new Date(y, m - 1, 15).toISOString();
  const end   = new Date(y, m + 2, 15).toISOString();
  let url = `${c.url}?token=${encodeURIComponent(c.token)}` +
            `&start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`;
  if (sel && sel.length) url += `&cals=${encodeURIComponent(sel.join(","))}`;

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

async function relayGet(params){
  const c = gcalConfig();
  if (!c || !c.url) throw new Error("not configured");
  const q = new URLSearchParams({ token: c.token, ...params }).toString();
  const r = await fetch(`${c.url}?${q}`);
  const d = await r.json();
  if (d.error) throw new Error(d.error);
  return d;
}

/* List the calendars the Google account can see (needs relay v2). */
export async function gcalListCalendars(){
  const d = await relayGet({ list: "1" });
  if (!Array.isArray(d.calendars)) throw new Error("This relay is v1 — redeploy calendar-relay.gs to pick calendars");
  return d.calendars;   // [{ id, name, color, primary }]
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

/* Relay connect / disconnect modal. */
export function openGcalSettings(onDone){
  const c = gcalConfig() || {};
  openModal({
    title: gcalEnabled() ? t("set.reconfigure") : t("set.connect_gcal"),
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
      saveConfig({ ...(gcalConfig() || {}), url, token: d.token });
      bustGcalCache();
      toast(n === 0 ? "Connected — no events in range yet" : `Connected — found ${n} event${n === 1 ? "" : "s"}`);
      onDone && onDone();
    }
  });
}
