/* ============================================================
   FAMILY HUB — import a calendar by its iCal (.ics) URL
   Works with Google / Apple iCloud / Outlook·Hotmail / Samsung
   (they all expose a secret iCal address). Read-only snapshot,
   refreshed each time the app loads. Stored per device.
   ============================================================ */
import { state, iso, parseISO } from "./state.js";
import { gcalConfig } from "./gcal.js";
import { openModal, toast } from "./ui.js";
import { t } from "./i18n.js";

const LS = "familyhub.ics";

export function icsConfig(){
  try { return JSON.parse(localStorage.getItem(LS) || "null"); } catch { return null; }
}
export function icsEventList(){ return icsConfig()?.events || []; }

function save(c){
  try { localStorage.setItem(LS, JSON.stringify(c)); } catch {}
  state.icsEvents = c && c.events ? c.events : [];
}
export function clearIcs(){
  try { localStorage.removeItem(LS); } catch {}
  state.icsEvents = [];
}

/* ---------- parse ---------- */
const unesc = (s) => String(s)
  .replace(/\\n/gi, " ").replace(/\\,/g, ",").replace(/\\;/g, ";").replace(/\\\\/g, "\\");

function dtParts(val, params){
  const dateOnly = params.some(p => /VALUE=DATE\b/i.test(p)) || /^\d{8}$/.test(val);
  const date = `${val.slice(0, 4)}-${val.slice(4, 6)}-${val.slice(6, 8)}`;
  if (dateOnly) return { date, time: "", allDay: true };
  return { date, time: `${val.slice(9, 11)}:${val.slice(11, 13)}`, allDay: false };
}

function make(v, date){
  return {
    id: `ics:${v.uid || v.title || "e"}:${date}:${v.time || ""}`,
    date, time: v.time || "", allDay: !!v.allDay,
    title: v.title || "(busy)", location: v.location || "", notes: v.notes || "",
    source: "ics"
  };
}

function expand(v, from, to, out){
  const r = {};
  v.rrule.split(";").forEach(kv => { const [k, val] = kv.split("="); r[(k || "").toUpperCase()] = val; });
  const freq = (r.FREQ || "").toUpperCase();
  const interval = Math.max(1, parseInt(r.INTERVAL || "1", 10) || 1);
  const count = r.COUNT ? parseInt(r.COUNT, 10) : Infinity;
  let until = null;
  if (r.UNTIL){
    const u = r.UNTIL.slice(0, 8);
    until = new Date(+u.slice(0, 4), +u.slice(4, 6) - 1, +u.slice(6, 8));
  }
  let cur = parseISO(v.date);
  let made = 0, iters = 0;
  while (iters < 1500 && made < count && cur <= to && (!until || cur <= until)){
    if (cur >= from){ out.push(make(v, iso(cur))); made++; }
    if (freq === "DAILY") cur.setDate(cur.getDate() + interval);
    else if (freq === "WEEKLY") cur.setDate(cur.getDate() + 7 * interval);
    else if (freq === "MONTHLY") cur.setMonth(cur.getMonth() + interval);
    else if (freq === "YEARLY") cur.setFullYear(cur.getFullYear() + interval);
    else break;
    iters++;
  }
}

export function parseICS(text){
  const lines = String(text)
    .replace(/\r\n/g, "\n").replace(/\r/g, "\n")
    .replace(/\n[ \t]/g, "")            // unfold
    .split("\n");

  const vevents = [];
  let cur = null;
  for (const line of lines){
    if (line === "BEGIN:VEVENT"){ cur = {}; continue; }
    if (line === "END:VEVENT"){ if (cur && cur.date) vevents.push(cur); cur = null; continue; }
    if (!cur) continue;
    const c = line.indexOf(":");
    if (c < 0) continue;
    const params = line.slice(0, c).split(";");
    const key = params[0].toUpperCase();
    const val = line.slice(c + 1);
    if (key === "SUMMARY") cur.title = unesc(val);
    else if (key === "LOCATION") cur.location = unesc(val);
    else if (key === "DESCRIPTION") cur.notes = unesc(val).slice(0, 400);
    else if (key === "DTSTART") Object.assign(cur, dtParts(val, params));
    else if (key === "RRULE") cur.rrule = val;
    else if (key === "UID") cur.uid = val;
  }

  const from = new Date(); from.setHours(0, 0, 0, 0); from.setMonth(from.getMonth() - 1);
  const to = new Date(from); to.setMonth(to.getMonth() + 13);

  const out = [];
  for (const v of vevents){
    if (v.rrule) expand(v, from, to, out);
    else if (parseISO(v.date) >= from && parseISO(v.date) <= to) out.push(make(v, v.date));
  }

  const seen = new Set();
  return out.filter(e => {
    const k = `${e.date}|${e.time}|${e.title}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  }).slice(0, 3000);
}

/* ---------- fetch (direct, then via the Google relay as a CORS proxy) ---------- */
async function fetchText(url){
  try {
    const r = await fetch(url, { redirect: "follow" });
    if (r.ok){
      const txt = await r.text();
      if (txt.includes("BEGIN:VCALENDAR")) return txt;
    }
  } catch { /* CORS or network — fall through to the relay */ }

  const g = gcalConfig();
  if (g && g.url && g.token){
    const r = await fetch(`${g.url}?token=${encodeURIComponent(g.token)}&ics=${encodeURIComponent(url)}`);
    const txt = await r.text();
    if (txt.includes("BEGIN:VCALENDAR")) return txt;
    try { const j = JSON.parse(txt); if (j.error) throw new Error(j.error); } catch {}
  }
  throw new Error(t("ics.blocked"));
}

export async function refreshIcs(){
  const c = icsConfig();
  if (!c || !c.url) return false;
  try {
    const text = await fetchText(c.url.replace(/^webcal:/i, "https:"));
    save({ ...c, events: parseICS(text), at: Date.now() });
    return true;
  } catch (e){
    console.warn("ICS refresh:", e.message);
    return false;
  }
}

export function openIcsImport(onDone){
  const c = icsConfig() || {};
  openModal({
    title: t("ics.title"),
    submitLabel: t("ics.import"),
    deleteLabel: t("common.clear"),
    body: t("ics.help"),
    fields: [
      { name: "url", label: t("ics.url"), type: "text", required: true, value: c.url || "",
        placeholder: "https://calendar.google.com/calendar/ical/…/basic.ics" },
      { name: "name", label: t("ics.name"), type: "text", value: c.name || "" }
    ],
    onDelete: (c.url || (c.events && c.events.length)) ? async () => {
      clearIcs();
      toast(t("common.saved"));
      onDone && onDone();
    } : null,
    onSubmit: async (d) => {
      const url = d.url.trim().replace(/^webcal:/i, "https:");
      const text = await fetchText(url);
      const events = parseICS(text);
      if (!events.length) throw new Error(t("ics.none"));
      save({ url, name: (d.name || "").trim() || "Imported calendar", events, at: Date.now() });
      toast(`${events.length} ${t("ics.events")}`);
      onDone && onDone();
    }
  });
}
