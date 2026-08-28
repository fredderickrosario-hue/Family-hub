import { db } from "./firebase-config.js";
import {
  collection, addDoc, onSnapshot, query
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

/* ============================================================
   STATE
   ============================================================ */
const state = {
  viewDate: new Date(),        // month currently shown in the grid
  selectedDateISO: null,       // date open in the bottom sheet
  events: [],                  // from Firestore: {id, title, date, time, notes}
  chores: [],                  // from Firestore: {id, title, dueDate, completed}
  budgetEntries: [],           // from Firestore: {id, party, amount, type, date, status}
  gcalEvents: []                // from Google Calendar (read-only) — wired later
};

const DOW = ["SUN","MON","TUE","WED","THU","FRI","SAT"];
const MONTHS = ["January","February","March","April","May","June","July",
                "August","September","October","November","December"];

const iso = (d) => {
  const y = d.getFullYear(), m = String(d.getMonth()+1).padStart(2,"0"), day = String(d.getDate()).padStart(2,"0");
  return `${y}-${m}-${day}`;
};

/* ============================================================
   HEADER DATE
   ============================================================ */
function renderHeaderDate(){
  const now = new Date();
  document.getElementById("headerDate").textContent =
    `${DOW[now.getDay()]} · ${MONTHS[now.getMonth()].slice(0,3).toUpperCase()} ${now.getDate()}`;
}

/* ============================================================
   TAB SWITCHING
   ============================================================ */
document.getElementById("tabPanel").addEventListener("click", (e) => {
  const btn = e.target.closest(".tab-btn");
  if (!btn) return;
  document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
  document.querySelectorAll(".panel").forEach(p => p.classList.remove("active"));
  btn.classList.add("active");
  document.getElementById(`panel-${btn.dataset.tab}`).classList.add("active");
});

/* ============================================================
   CALENDAR RENDER
   ============================================================ */
function renderDow(){
  const el = document.getElementById("calDow");
  el.innerHTML = DOW.map(d => `<div class="cal-dow">${d}</div>`).join("");
}

function entriesForDate(dateISO){
  return {
    events: state.events.filter(e => e.date === dateISO),
    gcal: state.gcalEvents.filter(e => e.date === dateISO),
    chores: state.chores.filter(c => c.dueDate === dateISO),
    budget: state.budgetEntries.filter(b => b.date === dateISO)
  };
}

function renderCalendar(){
  const y = state.viewDate.getFullYear();
  const m = state.viewDate.getMonth();
  document.getElementById("calMonthLabel").textContent = `${MONTHS[m]} ${y}`;

  const firstWeekday = new Date(y, m, 1).getDay();
  const daysInMonth = new Date(y, m+1, 0).getDate();
  const todayISO = iso(new Date());

  let html = "";
  for (let i=0; i<firstWeekday; i++){
    html += `<div class="cal-cell empty"></div>`;
  }
  for (let d=1; d<=daysInMonth; d++){
    const cellDate = new Date(y, m, d);
    const dateISO = iso(cellDate);
    const { events, gcal, chores, budget } = entriesForDate(dateISO);
    const isToday = dateISO === todayISO;

    let dots = "";
    if (events.length) dots += `<span class="dot evt"></span>`;
    if (gcal.length)   dots += `<span class="dot gcal"></span>`;
    if (chores.length) dots += `<span class="dot chore"></span>`;
    if (budget.length) dots += `<span class="dot budget"></span>`;

    html += `
      <div class="cal-cell${isToday ? " today" : ""}" data-date="${dateISO}">
        <span class="daynum">${d}</span>
        <div class="cal-dots">${dots}</div>
      </div>`;
  }
  document.getElementById("calGrid").innerHTML = html;
  updateMainLed(todayISO);
}

document.getElementById("calGrid").addEventListener("click", (e) => {
  const cell = e.target.closest(".cal-cell:not(.empty)");
  if (!cell) return;
  openDaySheet(cell.dataset.date);
});

document.getElementById("calPrev").addEventListener("click", () => {
  state.viewDate = new Date(state.viewDate.getFullYear(), state.viewDate.getMonth()-1, 1);
  renderCalendar();
});
document.getElementById("calNext").addEventListener("click", () => {
  state.viewDate = new Date(state.viewDate.getFullYear(), state.viewDate.getMonth()+1, 1);
  renderCalendar();
});

/* ============================================================
   MAIN TAB STATUS LED — lights up amber if today has anything on it
   ============================================================ */
function updateMainLed(todayISO){
  const { events, gcal } = entriesForDate(todayISO);
  const led = document.getElementById("ledMain");
  led.classList.toggle("on-amber", events.length + gcal.length > 0);
}

/* ============================================================
   DAY DETAIL SHEET
   ============================================================ */
const backdrop = document.getElementById("sheetBackdrop");
const addForm = document.getElementById("addEventForm");

function formatDateLabel(dateISO){
  const [y,m,d] = dateISO.split("-").map(Number);
  const dt = new Date(y, m-1, d);
  return `${DOW[dt.getDay()]}, ${MONTHS[m-1]} ${d}`;
}

function openDaySheet(dateISO){
  state.selectedDateISO = dateISO;
  document.getElementById("sheetDateLabel").textContent = formatDateLabel(dateISO);
  renderSheetEntries();
  addForm.style.display = "none";
  backdrop.classList.add("open");
}

function renderSheetEntries(){
  const { events, gcal, chores, budget } = entriesForDate(state.selectedDateISO);
  const rows = [];

  events.forEach(e => rows.push({dot:"evt", title:e.title, meta:e.time || "All day"}));
  gcal.forEach(e => rows.push({dot:"gcal", title:e.title, meta:"Google Calendar"}));
  chores.forEach(c => rows.push({dot:"chore", title:c.title, meta: c.completed ? "Done" : "Chore due"}));
  budget.forEach(b => rows.push({dot:"budget", title:`${b.party || "Budget"} — $${b.amount ?? "?"}`, meta:b.type || "Budget"}));

  const container = document.getElementById("sheetEntries");
  if (!rows.length){
    container.innerHTML = `<div class="empty-state">Nothing on this day yet.</div>`;
    return;
  }
  container.innerHTML = rows.map(r => `
    <div class="entry-row">
      <span class="dot ${r.dot}"></span>
      <div>
        <div class="entry-title">${escapeHtml(r.title)}</div>
        <div class="entry-meta">${escapeHtml(r.meta)}</div>
      </div>
    </div>`).join("");
}

function escapeHtml(str){
  const d = document.createElement("div");
  d.textContent = str ?? "";
  return d.innerHTML;
}

document.getElementById("sheetClose").addEventListener("click", () => {
  backdrop.classList.remove("open");
});
backdrop.addEventListener("click", (e) => {
  if (e.target === backdrop) backdrop.classList.remove("open");
});
document.getElementById("showAddForm").addEventListener("click", () => {
  addForm.style.display = addForm.style.display === "none" ? "flex" : "none";
});

addForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const title = document.getElementById("newEventTitle").value.trim();
  const time = document.getElementById("newEventTime").value;
  const notes = document.getElementById("newEventNotes").value.trim();
  if (!title) return;

  await addDoc(collection(db, "events"), {
    title, time, notes,
    date: state.selectedDateISO,
    createdAt: Date.now()
  });

  document.getElementById("newEventTitle").value = "";
  document.getElementById("newEventTime").value = "";
  document.getElementById("newEventNotes").value = "";
  addForm.style.display = "none";
  // renderSheetEntries() fires automatically via the live listener below
});

/* ============================================================
   LIVE FIRESTORE SYNC
   Every device with this page open updates instantly —
   no refresh, no re-import.
   ============================================================ */
function watchCollection(name, stateKey, mapFn){
  onSnapshot(query(collection(db, name)), (snap) => {
    state[stateKey] = snap.docs.map(d => mapFn ? mapFn(d) : ({ id: d.id, ...d.data() }));
    renderCalendar();
    if (backdrop.classList.contains("open")) renderSheetEntries();
  }, (err) => {
    // Collection may not exist yet, or config isn't filled in —
    // fail quietly so the calendar still renders locally.
    console.warn(`Sync warning for "${name}":`, err.message);
  });
}

watchCollection("events", "events");
watchCollection("chores", "chores");
watchCollection("budgetEntries", "budgetEntries");

/* ============================================================
   GOOGLE CALENDAR (read-only) — stub
   Wire this up once the Cloud Function proxy from README §3 is
   deployed. It should return: [{ title, date: "YYYY-MM-DD" }, ...]
   ============================================================ */
async function fetchGoogleCalendarEvents(){
  // const res = await fetch("https://YOUR-CLOUD-FUNCTION-URL/gcal-feed");
  // state.gcalEvents = await res.json();
  // renderCalendar();
  return [];
}
fetchGoogleCalendarEvents();

/* ============================================================
   INIT
   ============================================================ */
renderHeaderDate();
renderDow();
renderCalendar();

if ("serviceWorker" in navigator){
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch(console.warn);
  });
}
