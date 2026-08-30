/* ============================================================
   FAMILY HUB — app shell
   Header, tab switching, main calendar tab, day sheet.
   Tab modules register themselves and pull from state.js.
   ============================================================ */
import {
  state, onStateChange, initSync,
  DOW, MONTHS, iso, todayISO, parseISO, fmtDayLabel,
  escapeHtml, add, profileColor, profileName
} from "./state.js";
import { openModal, toast } from "./ui.js";

import { initChores, choresLed } from "./chores.js";
import { initBudget, budgetLed } from "./budget.js";
import { initMeals } from "./meals.js";
import { initGrocery, groceryLed } from "./grocery.js";
import { initFamily } from "./profiles.js";
import { gcalEnabled, gcalFetchMonth, openGcalSettings } from "./gcal.js";

/* ---------- Header ---------- */
function renderHeaderDate(){
  const now = new Date();
  document.getElementById("headerDate").textContent =
    `${DOW[now.getDay()]} · ${MONTHS[now.getMonth()].slice(0,3).toUpperCase()} ${now.getDate()}`;
}

/* ---------- Tab switching ---------- */
document.getElementById("tabNav").addEventListener("click", (e) => {
  const btn = e.target.closest(".tab-btn");
  if (!btn) return;
  document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
  document.querySelectorAll(".panel").forEach(p => p.classList.remove("active"));
  btn.classList.add("active");
  document.getElementById(`panel-${btn.dataset.tab}`).classList.add("active");
  window.scrollTo({ top: 0 });
});

/* ---------- Calendar ---------- */
function renderDow(){
  document.getElementById("calDow").innerHTML =
    DOW.map(d => `<div class="cal-dow">${d}</div>`).join("");
}

function entriesForDate(dateISO){
  return {
    events: state.events.filter(e => e.date === dateISO),
    gcal:   state.gcalEvents.filter(e => e.date === dateISO),
    chores: state.chores.filter(c => c.dueDate === dateISO),
    meals:  state.meals.filter(m => m.date === dateISO),
    budget: state.budgetEntries.filter(b => b.date === dateISO)
  };
}

function paintCalendar(){
  const y = state.viewDate.getFullYear();
  const m = state.viewDate.getMonth();
  document.getElementById("calMonthLabel").textContent = `${MONTHS[m]} ${y}`;

  const firstWeekday = new Date(y, m, 1).getDay();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const today = todayISO();

  let html = "";
  for (let i = 0; i < firstWeekday; i++) html += `<div class="cal-cell empty"></div>`;

  for (let d = 1; d <= daysInMonth; d++){
    const dateISO = iso(new Date(y, m, d));
    const { events, gcal, chores, meals, budget } = entriesForDate(dateISO);
    const isToday = dateISO === today;

    let dots = "";
    if (events.length) dots += `<span class="dot evt"></span>`;
    if (gcal.length)   dots += `<span class="dot gcal"></span>`;
    if (chores.length) dots += `<span class="dot chore"></span>`;
    if (meals.length)  dots += `<span class="dot meal"></span>`;
    if (budget.length) dots += `<span class="dot budget"></span>`;

    html += `
      <div class="cal-cell${isToday ? " today" : ""}" data-date="${dateISO}" role="button" tabindex="0">
        <span class="daynum">${d}</span>
        <div class="cal-dots">${dots}</div>
      </div>`;
  }
  document.getElementById("calGrid").innerHTML = html;
  updateMainLed(today);
}

let gcalBusy = false;
async function refreshGcal(){
  if (!gcalEnabled() || gcalBusy) return;
  gcalBusy = true;
  let changed = false;
  try { changed = await gcalFetchMonth(state.viewDate); }
  finally { gcalBusy = false; }
  if (changed){
    paintCalendar();
    if (backdrop.classList.contains("open")) renderSheetEntries();
  }
}

function renderCalendar(){
  paintCalendar();
  updateGcalBtn();
  refreshGcal();
}

function updateGcalBtn(){
  const btn = document.getElementById("gcalBtn");
  if (!btn) return;
  const on = gcalEnabled();
  btn.classList.toggle("synced", on);
  btn.innerHTML = on
    ? `<span class="plus">✓</span> Synced`
    : `<span class="plus">🔗</span> Sync`;
}

function updateMainLed(today){
  const { events } = entriesForDate(today);
  setLed("ledMain", events.length > 0, "var(--info)");
}

document.getElementById("calGrid").addEventListener("click", (e) => {
  const cell = e.target.closest(".cal-cell:not(.empty)");
  if (cell) openDaySheet(cell.dataset.date);
});
document.getElementById("calGrid").addEventListener("keydown", (e) => {
  if (e.key !== "Enter" && e.key !== " ") return;
  const cell = e.target.closest(".cal-cell:not(.empty)");
  if (cell){ e.preventDefault(); openDaySheet(cell.dataset.date); }
});
document.getElementById("calPrev").addEventListener("click", () => {
  state.viewDate = new Date(state.viewDate.getFullYear(), state.viewDate.getMonth() - 1, 1);
  renderCalendar();
});
document.getElementById("calNext").addEventListener("click", () => {
  state.viewDate = new Date(state.viewDate.getFullYear(), state.viewDate.getMonth() + 1, 1);
  renderCalendar();
});

/* ---------- LED helper (shared) ---------- */
export function setLed(id, on, color){
  const led = document.getElementById(id);
  if (!led) return;
  led.classList.toggle("on", !!on);
  if (color) led.style.setProperty("--led-color", color);
}

/* ---------- Day sheet ---------- */
const backdrop = document.getElementById("sheetBackdrop");

function openDaySheet(dateISO){
  state.selectedDateISO = dateISO;
  document.getElementById("sheetDateLabel").textContent = fmtDayLabel(dateISO);
  renderSheetEntries();
  backdrop.classList.add("open");
}
function closeDaySheet(){ backdrop.classList.remove("open"); }

function renderSheetEntries(){
  const { events, gcal, chores, meals, budget } = entriesForDate(state.selectedDateISO);
  const rows = [];
  events.forEach(e => rows.push({ dot: "evt", title: e.title, meta: e.time || "All day" }));
  gcal.forEach(e => rows.push({
    dot: "gcal",
    title: e.title || "(busy)",
    meta: [e.allDay ? "All day" : e.time, e.location].filter(Boolean).join(" · ") || "Google Calendar"
  }));
  chores.forEach(c => rows.push({
    dot: "chore",
    title: c.title,
    meta: `${c.assignee ? profileName(c.assignee) + " · " : ""}${c.completed || c.completionDate === state.selectedDateISO ? "Done" : "Chore due"}`
  }));
  meals.forEach(m => rows.push({ dot: "meal", title: m.description, meta: (m.mealType || "meal").replace(/^./, s => s.toUpperCase()) }));
  budget.forEach(b => rows.push({
    dot: "budget",
    title: `${b.party || "Budget"} — $${Number(b.amount || 0).toFixed(2)}`,
    meta: `${b.type === "payout" ? "Money out" : "Money in"} · ${b.status || "pending"}`
  }));

  const container = document.getElementById("sheetEntries");
  container.innerHTML = rows.length
    ? rows.map(r => `
        <div class="entry-row">
          <span class="dot ${r.dot}"></span>
          <div>
            <div class="entry-title">${escapeHtml(r.title)}</div>
            <div class="entry-meta">${escapeHtml(r.meta)}</div>
          </div>
        </div>`).join("")
    : `<div class="empty">Nothing planned for this day yet.</div>`;
}

document.getElementById("sheetClose").addEventListener("click", closeDaySheet);
backdrop.addEventListener("mousedown", (e) => { if (e.target === backdrop) closeDaySheet(); });

/* Google Calendar sync button */
document.getElementById("gcalBtn").addEventListener("click", () => {
  openGcalSettings(() => { updateGcalBtn(); renderCalendar(); });
});

/* Quick-add from a day */
backdrop.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-add]");
  if (!btn) return;
  const kind = btn.dataset.add;
  const date = state.selectedDateISO;

  if (kind === "event"){
    openModal({
      title: `Add event · ${fmtDayLabel(date)}`,
      fields: [
        { name: "title", label: "Title", type: "text", required: true },
        { name: "time", label: "Time", type: "time" },
        { name: "notes", label: "Notes", type: "textarea" }
      ],
      onSubmit: async (d) => { await add("events", { ...d, date }); toast("Event added"); }
    });
  } else if (kind === "chore"){
    const profileOpts = [{ value: "", label: "Unassigned" }]
      .concat(state.profiles.map(p => ({ value: p.id, label: p.name })));
    openModal({
      title: `Add chore · ${fmtDayLabel(date)}`,
      fields: [
        { name: "title", label: "Chore", type: "text", required: true },
        { name: "assignee", label: "Assigned to", type: "select", options: profileOpts },
        { name: "isKidChore", label: "Kid chore (earns points)", type: "checkbox" },
        { name: "points", label: "Points", type: "number", min: 0, value: 5 },
        { name: "recurring", label: "Repeats", type: "select", value: "never",
          options: ["never","daily","weekly","monthly"].map(v => ({ value: v, label: v.replace(/^./, s => s.toUpperCase()) })) }
      ],
      onSubmit: async (d) => {
        await add("chores", {
          title: d.title, assignee: d.assignee || null,
          isKidChore: !!d.isKidChore, points: Number(d.points) || 0,
          dueDate: date, completed: false, completedAt: null,
          completionDate: null, recurring: d.recurring || "never",
          recurrenceDays: d.recurring === "weekly" ? [parseISO(date).getDay()] : []
        });
        toast("Chore added");
      }
    });
  } else if (kind === "meal"){
    openModal({
      title: `Add meal · ${fmtDayLabel(date)}`,
      fields: [
        { name: "mealType", label: "Meal", type: "select",
          options: ["breakfast","lunch","dinner","snack"].map(v => ({ value: v, label: v.replace(/^./, s => s.toUpperCase()) })) },
        { name: "description", label: "What's cooking?", type: "text", required: true },
        { name: "ingredients", label: "Ingredients (comma separated)", type: "text",
          hint: "Used for the grocery sync button" }
      ],
      onSubmit: async (d) => {
        await add("meals", {
          date, mealType: d.mealType, description: d.description,
          ingredients: (d.ingredients || "").split(",").map(s => s.trim()).filter(Boolean),
          notes: ""
        });
        toast("Meal added");
      }
    });
  }
});

/* ---------- Init ---------- */
renderHeaderDate();
renderDow();
renderCalendar();

initChores();
initBudget();
initMeals();
initGrocery();
initFamily();

onStateChange(() => {
  renderCalendar();
  if (backdrop.classList.contains("open")) renderSheetEntries();
  choresLed();
  budgetLed();
  groceryLed();
});

initSync();

/* refresh "today" at midnight rollover */
let lastToday = todayISO();
setInterval(() => {
  const t = todayISO();
  if (t !== lastToday){ lastToday = t; renderHeaderDate(); renderCalendar(); }
}, 60000);

/* ---------- Service worker ---------- */
if ("serviceWorker" in navigator){
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch(console.warn);
  });
}
