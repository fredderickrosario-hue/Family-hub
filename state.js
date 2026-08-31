/* ============================================================
   FAMILY HUB — shared state module
   Single source of truth. Every tab imports from here so we
   have one set of Firestore listeners and one state object.
   ============================================================ */
import { db } from "./firebase-config.js";
import {
  collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { t } from "./i18n.js";

export { db, collection, addDoc, updateDoc, deleteDoc, doc };
export { t };

/* ---------- State ---------- */
export const state = {
  viewDate: new Date(),      // calendar cursor (month/week/day pivot)
  calView: localStorage.getItem("familyhub.calView") || "agenda", // month|week|day|agenda
  selectedDateISO: null,     // day open in the day sheet
  events: [],                // {id, title, date, time, notes}
  chores: [],                // {id, title, assignee, isKidChore, points, dueDate,
                             //  completed, completedAt, completionDate,
                             //  recurring, recurrenceDays}
  rewards: [],               // {id, name, cost}
  budgetEntries: [],         // {id, party, amount, type, date, status, notes}
  meals: [],                 // {id, date, mealType, description, ingredients, notes}
  groceryItems: [],          // {id, name, checked, addedDate, category}
  profiles: [],              // {id, name, color, isKid, avatar, points}
  gcalEvents: [],            // read-only, from Google Calendar via the relay
  icsEvents: []              // read-only, from an imported iCal (.ics) URL
};

/* ---------- Pub/sub ---------- */
const listeners = new Set();
export function onStateChange(fn){ listeners.add(fn); return () => listeners.delete(fn); }
function emit(){ listeners.forEach(fn => { try { fn(); } catch (e) { console.error(e); } }); }
export function nudge(){ emit(); }   // force a re-render pass (settings changes etc.)

/* ---------- Date helpers ---------- */
function pref(key, fallback){
  try { const v = localStorage.getItem(key); return v == null ? fallback : v; }
  catch { return fallback; }
}
const LOCALE = pref("familyhub.lang", "en") === "fr" ? "fr-CA" : "en-CA";
const _fmt = (opts) => new Intl.DateTimeFormat(LOCALE, { ...opts, timeZone: "UTC" });
// Jan 1 2023 is a Sunday — build weekday names starting Sunday.
export const DOW      = [...Array(7)].map((_, i) =>
  _fmt({ weekday: "short" }).format(Date.UTC(2023, 0, 1 + i)).replace(".", "").toUpperCase());
export const DOW_FULL = [...Array(7)].map((_, i) =>
  _fmt({ weekday: "long" }).format(Date.UTC(2023, 0, 1 + i)));
export const MONTHS   = [...Array(12)].map((_, i) =>
  _fmt({ month: "long" }).format(Date.UTC(2023, i, 15)));

export function weekStartDay(){
  const n = Number(pref("familyhub.weekStart", "0"));
  return n === 1 ? 1 : 0;
}
/** DOW rotated so the configured first day is index 0 (with its real weekday number). */
export function orderedDOW(){
  const ws = weekStartDay();
  return [...Array(7)].map((_, i) => ({ label: DOW[(i + ws) % 7], day: (i + ws) % 7 }));
}

export const iso = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};
export const todayISO = () => iso(new Date());
export function parseISO(s){
  const [y, m, d] = String(s).split("-").map(Number);
  return new Date(y, m - 1, d);
}
export function addDays(dateISO, n){
  const d = parseISO(dateISO);
  d.setDate(d.getDate() + n);
  return iso(d);
}
export function addDaysD(date, n){
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}
export function startOfWeek(date){
  const ws = weekStartDay();
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() - ws + 7) % 7));
  return d;
}
export function setCalView(v){
  state.calView = v;
  try { localStorage.setItem("familyhub.calView", v); } catch {}
}
export function fmtDayLabel(dateISO){
  const d = parseISO(dateISO);
  return `${DOW_FULL[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}`;
}
export function fmtShort(dateISO){
  const d = parseISO(dateISO);
  return `${MONTHS[d.getMonth()].slice(0,3)} ${d.getDate()}`;
}
export function relativeDay(dateISO){
  const diff = Math.round((parseISO(dateISO) - parseISO(todayISO())) / 86400000);
  if (diff === 0) return t("rel.today");
  if (diff === 1) return t("rel.tomorrow");
  if (diff === -1) return t("rel.yesterday");
  if (diff < 0) return t("rel.days_ago", { n: Math.abs(diff) });
  if (diff < 7) return t("rel.in_days", { n: diff });
  return fmtShort(dateISO);
}

/* ---------- Misc helpers ---------- */
export function escapeHtml(str){
  const d = document.createElement("div");
  d.textContent = str ?? "";
  return d.innerHTML;
}
export function fmtMoney(n){
  const v = Number(n) || 0;
  return v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
export function uid(){
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

/* ---------- Profile helpers ---------- */
export function profileById(id){
  return state.profiles.find(p => p.id === id) || null;
}
export function profileColor(id){
  const p = profileById(id);
  return p ? p.color : "var(--text-soft)";
}
export function profileName(id){
  const p = profileById(id);
  return p ? p.name : t("chores.unassigned");
}
export function profileInitials(p){
  if (!p) return "?";
  if (p.avatar) return p.avatar;
  return p.name.trim().split(/\s+/).map(w => w[0]).join("").slice(0, 2).toUpperCase();
}

/* ---------- Firestore write helpers ---------- */
export const col = (name) => collection(db, name);
export const add = (name, data) => addDoc(collection(db, name), { createdAt: Date.now(), ...data });
export const update = (name, id, data) => updateDoc(doc(db, name, id), data);
export const remove = (name, id) => deleteDoc(doc(db, name, id));

/* ---------- Live sync ---------- */
function watch(name, key){
  onSnapshot(query(collection(db, name)), (snap) => {
    state[key] = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    emit();
  }, (err) => {
    console.warn(`Sync warning for "${name}":`, err.message);
  });
}

let started = false;
export function initSync(){
  if (started) return;
  started = true;
  watch("events", "events");
  watch("chores", "chores");
  watch("rewards", "rewards");
  watch("budgetEntries", "budgetEntries");
  watch("meals", "meals");
  watch("groceryItems", "groceryItems");
  watch("profiles", "profiles");
}
