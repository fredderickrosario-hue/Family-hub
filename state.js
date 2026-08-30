/* ============================================================
   FAMILY HUB — shared state module
   Single source of truth. Every tab imports from here so we
   have one set of Firestore listeners and one state object.
   ============================================================ */
import { db } from "./firebase-config.js";
import {
  collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

export { db, collection, addDoc, updateDoc, deleteDoc, doc };

/* ---------- State ---------- */
export const state = {
  viewDate: new Date(),      // calendar cursor (month/week/day pivot)
  calView: localStorage.getItem("familyhub.calView") || "month", // month|week|day|agenda
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
  gcalEvents: []             // read-only, from Google Calendar via the relay
};

/* ---------- Pub/sub ---------- */
const listeners = new Set();
export function onStateChange(fn){ listeners.add(fn); return () => listeners.delete(fn); }
function emit(){ listeners.forEach(fn => { try { fn(); } catch (e) { console.error(e); } }); }

/* ---------- Date helpers ---------- */
export const DOW      = ["SUN","MON","TUE","WED","THU","FRI","SAT"];
export const DOW_FULL = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
export const MONTHS   = ["January","February","March","April","May","June","July",
                         "August","September","October","November","December"];

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
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay());
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
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  if (diff < 0) return `${Math.abs(diff)} days ago`;
  if (diff < 7) return `In ${diff} days`;
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
  return p ? p.name : "Unassigned";
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
