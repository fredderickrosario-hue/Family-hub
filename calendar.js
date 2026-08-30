/* ============================================================
   FAMILY HUB — Calendar tab
   Month / Week / Day / Agenda views, event chips in the grid,
   a radial "+" menu, and the day drill-down.
   ============================================================ */
import {
  state, onStateChange, add, update, remove,
  DOW, MONTHS, iso, todayISO, parseISO, fmtDayLabel, escapeHtml,
  profileName, profileColor, addDaysD, startOfWeek, setCalView,
  orderedDOW, weekStartDay
} from "./state.js";
import { openModal, toast } from "./ui.js";
import { t } from "./i18n.js";
import { gcalEnabled, gcalFetchMonth, openGcalSettings } from "./gcal.js";
import { openChoreForm } from "./chores.js";
import { openBudgetForm } from "./budget.js";
import { openMealForm } from "./meals.js";
import { setLed } from "./app.js";

const cap = (s) => String(s || "").replace(/^./, (c) => c.toUpperCase());

let root;

/* ---------- Init ---------- */
export function initCalendar(){
  root = document.getElementById("calRoot");
  buildFab();
  root.addEventListener("click", onRootClick);

  const syncBtn = document.getElementById("gcalBtn");
  if (syncBtn) syncBtn.addEventListener("click", () => openGcalSettings(render));

  let rz;
  window.addEventListener("resize", () => { clearTimeout(rz); rz = setTimeout(render, 200); });

  onStateChange(render);
  render();
}

/* ============================================================
   Normalised day items (shared by every view)
   ============================================================ */
const KIND_ORDER = { event: 0, gcal: 1, meal: 2, chore: 3, budget: 4 };
const MEAL_ORDER = { breakfast: 0, lunch: 1, dinner: 2, snack: 3 };

function itemsForDate(dateISO){
  const out = [];

  state.events.filter(e => e.date === dateISO).forEach(e => out.push({
    kind: "event", cls: "evt", title: e.title || "(untitled)",
    time: e.time || "", allDay: !e.time, raw: e
  }));

  if (gcalEnabled()){
    state.gcalEvents.filter(e => e.date === dateISO).forEach(e => out.push({
      kind: "gcal", cls: "gcal", title: e.title || "(busy)",
      time: e.time || "", allDay: !!e.allDay, sub: e.location || "",
      color: e.color || null, raw: e
    }));
  }

  state.meals.filter(m => m.date === dateISO).forEach(m => out.push({
    kind: "meal", cls: "meal", title: m.description || "(meal)",
    sub: t("meal." + m.mealType) === "meal." + m.mealType ? cap(m.mealType) : t("meal." + m.mealType),
    mealType: m.mealType, allDay: true, raw: m
  }));

  state.chores.filter(c => c.dueDate === dateISO).forEach(c => out.push({
    kind: "chore", cls: "chore", title: c.title || "(chore)",
    sub: c.assignee ? profileName(c.assignee) : "",
    color: c.assignee ? profileColor(c.assignee) : null,
    done: c.completed || c.completionDate === dateISO,
    allDay: true, raw: c
  }));

  state.budgetEntries.filter(b => b.date === dateISO).forEach(b => out.push({
    kind: "budget", cls: "budget",
    title: `${b.party || "Budget"} · ${b.type === "payout" ? "−" : "+"}$${Number(b.amount || 0).toFixed(0)}`,
    sub: (b.status || "pending") === "completed" ? "done" : "pending",
    allDay: true, raw: b
  }));

  out.sort((a, b) => {
    if (a.allDay !== b.allDay) return a.allDay ? 1 : -1;
    if (!a.allDay) return (a.time || "").localeCompare(b.time || "");
    if (a.kind === "meal" && b.kind === "meal") return MEAL_ORDER[a.mealType] - MEAL_ORDER[b.mealType];
    return KIND_ORDER[a.kind] - KIND_ORDER[b.kind];
  });
  return out;
}

/* ============================================================
   Render
   ============================================================ */
let gcalBusy = false;
async function refreshGcal(){
  if (gcalBusy || !gcalEnabled()) return;
  gcalBusy = true;
  let changed = false;
  try { changed = await gcalFetchMonth(state.viewDate); }
  finally { gcalBusy = false; }
  if (changed) render();
}

function render(){
  if (!root) return;
  const v = state.calView;
  const view =
    v === "week"   ? weekView() :
    v === "day"    ? dayView() :
    v === "agenda" ? agendaView() :
                     monthView();

  root.innerHTML = toolbar() + `<div class="cal-body cal-${v}">${view}</div>`;

  const syncBtn = document.getElementById("gcalBtn");
  if (syncBtn){
    const on = gcalEnabled();
    syncBtn.classList.toggle("synced", on);
    syncBtn.innerHTML = on
      ? `<span class="plus">✓</span> ${escapeHtml(t("cal.synced"))}`
      : `<span class="plus">🔗</span> ${escapeHtml(t("cal.sync"))}`;
  }

  setLed("ledMain",
    itemsForDate(todayISO()).some(i => i.kind === "event" || i.kind === "gcal"),
    "var(--info)");

  refreshGcal();
}

function toolbar(){
  const views = ["month", "week", "day", "agenda"];
  return `
    <div class="cal-toolbar">
      <div class="cal-views">
        ${views.map(v => `<button class="cal-view-btn${state.calView === v ? " active" : ""}" data-view="${v}">${escapeHtml(t("cal." + v))}</button>`).join("")}
      </div>
      <div class="cal-period">
        <button class="cal-step" data-step="-1" aria-label="Previous">‹</button>
        <button class="cal-step cal-today-btn" data-step="0">${escapeHtml(t("common.today"))}</button>
        <span class="cal-period-label">${escapeHtml(periodLabel())}</span>
        <button class="cal-step" data-step="1" aria-label="Next">›</button>
      </div>
    </div>`;
}

function periodLabel(){
  const d = state.viewDate, v = state.calView;
  if (v === "day") return fmtDayLabel(iso(d));
  if (v === "week"){
    const s = startOfWeek(d), e = addDaysD(s, 6);
    const a = `${MONTHS[s.getMonth()].slice(0, 3)} ${s.getDate()}`;
    const b = s.getMonth() === e.getMonth()
      ? `${e.getDate()}` : `${MONTHS[e.getMonth()].slice(0, 3)} ${e.getDate()}`;
    return `${a} – ${b}`;
  }
  return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

function doStep(dir){
  const d = new Date(state.viewDate);
  if (dir === 0){
    state.viewDate = new Date();
    state.selectedDateISO = todayISO();
  } else if (state.calView === "day"){
    d.setDate(d.getDate() + dir); state.viewDate = d;
  } else if (state.calView === "week"){
    d.setDate(d.getDate() + 7 * dir); state.viewDate = d;
  } else {
    d.setDate(1); d.setMonth(d.getMonth() + dir); state.viewDate = d;
  }
  render();
}

/* ---------- Month ---------- */
function monthView(){
  const y = state.viewDate.getFullYear(), m = state.viewDate.getMonth();
  const ws = weekStartDay();
  const first = (new Date(y, m, 1).getDay() - ws + 7) % 7;
  const dim = new Date(y, m + 1, 0).getDate();
  const today = todayISO();
  const maxChips = window.matchMedia("(min-width: 768px)").matches ? 3 : 2;

  let cells = "";
  for (let i = 0; i < first; i++) cells += `<div class="mcell empty"></div>`;
  for (let d = 1; d <= dim; d++){
    const dISO = iso(new Date(y, m, d));
    const items = itemsForDate(dISO);
    const shown = items.slice(0, maxChips);
    const extra = items.length - shown.length;
    cells += `
      <div class="mcell${dISO === today ? " today" : ""}" data-date="${dISO}" role="button" tabindex="0">
        <span class="mcell-day">${d}</span>
        <div class="mcell-items">
          ${shown.map(chipMini).join("")}
          ${extra > 0 ? `<button class="mcell-more" data-more="${dISO}">${escapeHtml(t("cal.more", { n: extra }))}</button>` : ""}
        </div>
      </div>`;
  }
  return `
    <div class="mgrid-dow">${orderedDOW().map(x => `<div>${x.label}</div>`).join("")}</div>
    <div class="mgrid">${cells}</div>`;
}

function chipMini(it){
  return `<span class="chip-mini ${it.cls}${it.done ? " done" : ""}"${it.color ? ` style="--chip-color:${it.color}"` : ""}>` +
    `${it.time ? `<b>${escapeHtml(it.time)}</b> ` : ""}${escapeHtml(it.title)}</span>`;
}

/* ---------- Week ---------- */
function weekView(){
  const s = startOfWeek(state.viewDate);
  const today = todayISO();
  let out = "";
  for (let i = 0; i < 7; i++){
    const dt = addDaysD(s, i);
    const dISO = iso(dt);
    const items = itemsForDate(dISO);
    out += `
      <div class="week-day${dISO === today ? " today" : ""}" data-date="${dISO}">
        <button class="week-day-head" data-open="${dISO}">
          <span class="wd-dow">${DOW[dt.getDay()]}</span>
          <span class="wd-num">${dt.getDate()}</span>
        </button>
        <div class="week-day-items">
          ${items.length ? items.map(chipRow).join("") : `<div class="week-empty">—</div>`}
        </div>
      </div>`;
  }
  return `<div class="week-wrap">${out}</div>`;
}

/* ---------- Day ---------- */
function dayView(){
  const dISO = iso(state.viewDate);
  const items = itemsForDate(dISO);
  return `<div class="day-view">
    ${items.length
      ? items.map(chipRow).join("")
      : `<div class="empty">${escapeHtml(t("cal.empty_day"))}</div>`}
  </div>`;
}

/* ---------- Agenda (mini month + day detail) ---------- */
function agendaSel(){
  const vd = state.viewDate;
  if (state.selectedDateISO){
    const s = parseISO(state.selectedDateISO);
    if (s.getMonth() === vd.getMonth() && s.getFullYear() === vd.getFullYear()) return state.selectedDateISO;
  }
  const now = new Date();
  if (vd.getMonth() === now.getMonth() && vd.getFullYear() === now.getFullYear()) return todayISO();
  return iso(new Date(vd.getFullYear(), vd.getMonth(), 1));
}

function agendaView(){
  const sel = agendaSel();
  const items = itemsForDate(sel);
  return `
    <div class="agenda">
      <div class="agenda-cal card">${miniMonth(sel)}</div>
      <div class="agenda-detail card">
        <div class="agenda-detail-head">${escapeHtml(fmtDayLabel(sel))}</div>
        ${items.length ? items.map(chipRow).join("") : `<div class="empty">${escapeHtml(t("cal.empty_short"))}</div>`}
      </div>
    </div>`;
}

function miniMonth(selISO){
  const y = state.viewDate.getFullYear(), m = state.viewDate.getMonth();
  const ws = weekStartDay();
  const first = (new Date(y, m, 1).getDay() - ws + 7) % 7;
  const dim = new Date(y, m + 1, 0).getDate();
  const today = todayISO();
  let cells = "";
  for (let i = 0; i < first; i++) cells += `<div class="mini-day empty"></div>`;
  for (let d = 1; d <= dim; d++){
    const dISO = iso(new Date(y, m, d));
    const has = itemsForDate(dISO).length > 0;
    cells += `<button class="mini-day${dISO === today ? " today" : ""}${dISO === selISO ? " sel" : ""}" data-mini="${dISO}">
      <span>${d}</span>${has ? `<span class="mini-dot"></span>` : ""}</button>`;
  }
  return `
    <div class="mini-dow">${orderedDOW().map(x => `<div>${x.label[0]}</div>`).join("")}</div>
    <div class="mini-grid">${cells}</div>`;
}

/* ---------- Shared row ---------- */
function chipRow(it){
  const bits = [];
  if (!it.allDay && it.time) bits.push(it.time);
  else if (it.allDay) bits.push(it.sub || "All day");
  if (it.sub && !(it.allDay && bits[0] === it.sub)) bits.push(it.sub);
  const meta = [...new Set(bits.filter(Boolean))].join(" · ");
  return `
    <div class="crow ${it.cls}${it.done ? " done" : ""}"${it.color ? ` style="--chip-color:${it.color}"` : ""}
         data-kind="${it.kind}" data-id="${escapeHtml(it.raw.id)}">
      <span class="crow-bar"></span>
      <div class="crow-main">
        <div class="crow-title">${escapeHtml(it.title)}</div>
        ${meta ? `<div class="crow-meta">${escapeHtml(meta)}</div>` : ""}
      </div>
    </div>`;
}

/* ============================================================
   Clicks
   ============================================================ */
function goToDay(dISO){
  state.viewDate = parseISO(dISO);
  state.selectedDateISO = dISO;
  setCalView("day");
  render();
}

function onRootClick(e){
  const viewBtn = e.target.closest(".cal-view-btn");
  if (viewBtn){ setCalView(viewBtn.dataset.view); render(); return; }

  const step = e.target.closest("[data-step]");
  if (step){ doStep(Number(step.dataset.step)); return; }

  const crow = e.target.closest(".crow");
  if (crow){ openItemEditor(crow.dataset.kind, crow.dataset.id); return; }

  const more = e.target.closest(".mcell-more");
  if (more){ goToDay(more.dataset.more); return; }

  const mini = e.target.closest(".mini-day[data-mini]");
  if (mini){ state.selectedDateISO = mini.dataset.mini; render(); return; }

  const wHead = e.target.closest(".week-day-head");
  if (wHead){ goToDay(wHead.dataset.open); return; }

  const mcell = e.target.closest(".mcell:not(.empty)");
  if (mcell){ goToDay(mcell.dataset.date); return; }
}

function openItemEditor(kind, id){
  if (kind === "event"){
    const ev = state.events.find(x => x.id === id);
    if (ev) openEventForm(ev);
  } else if (kind === "gcal"){
    const ev = state.gcalEvents.find(x => x.id === id);
    if (ev) showGcalEvent(ev);
  } else if (kind === "chore"){
    const c = state.chores.find(x => x.id === id);
    if (c) openChoreForm(c);
  } else if (kind === "meal"){
    const m = state.meals.find(x => x.id === id);
    if (m) openMealForm(m.date, m.mealType, m);
  } else if (kind === "budget"){
    const b = state.budgetEntries.find(x => x.id === id);
    if (b) openBudgetForm(b);
  }
}

/* ============================================================
   Add / edit forms
   ============================================================ */
export function openEventForm(ev){
  const editing = !!(ev && ev.id);
  openModal({
    title: editing ? t("cal.edit_event") : t("cal.add_event"),
    fields: [
      { name: "title", label: t("common.title"), type: "text", required: true, value: ev?.title || "" },
      { name: "date", label: t("common.date"), type: "date", required: true, value: ev?.date || todayISO() },
      { name: "time", label: t("common.time"), type: "time", value: ev?.time || "" },
      { name: "notes", label: t("common.notes"), type: "textarea", value: ev?.notes || "" }
    ],
    onDelete: editing ? async () => { await remove("events", ev.id); toast(t("cal.event_deleted")); } : null,
    onSubmit: async (d) => {
      const payload = { title: d.title, date: d.date, time: d.time, notes: d.notes || "" };
      if (editing) await update("events", ev.id, payload);
      else await add("events", payload);
      toast(t("common.saved"));
    }
  });
}

function showGcalEvent(ev){
  openModal({
    title: ev.title || "Google Calendar",
    submitLabel: t("common.close"),
    body: [
      ev.allDay ? t("common.all_day") : (ev.time ? `${t("common.time")} · ${escapeHtml(ev.time)}` : ""),
      ev.location ? `📍 ${escapeHtml(ev.location)}` : "",
      ev.notes ? escapeHtml(ev.notes) : "",
      `<span class="muted">${escapeHtml(t("cal.gcal_readonly"))}</span>`
    ].filter(Boolean).join("<br>"),
    onSubmit: async () => {}
  });
}

function openAdd(kind, dateISO){
  if (kind === "event"){
    openEventForm({ date: dateISO });
  } else if (kind === "chore"){
    openChoreForm({ dueDate: dateISO });
  } else if (kind === "meal"){
    openMealForm(dateISO, "dinner", null);
  } else if (kind === "budget"){
    openBudgetForm({ date: dateISO });
  } else if (kind === "grocery"){
    openModal({
      title: t("grocery.title"),
      fields: [{ name: "name", label: t("fab.grocery"), type: "text", required: true,
        placeholder: "milk, eggs, bread", hint: t("meal.f_ingr") }],
      onSubmit: async (d) => {
        const names = d.name.split(",").map(s => s.trim()).filter(Boolean);
        for (const name of names){
          if (state.groceryItems.some(g => g.name.toLowerCase() === name.toLowerCase())) continue;
          await add("groceryItems", { name, checked: false, addedDate: Date.now(), category: "" });
        }
        toast(t("common.saved"));
      }
    });
  }
}

/* ============================================================
   Radial "+" menu
   ============================================================ */
const FAB_ACTIONS = [
  { kind: "event",   labelKey: "fab.event",   ico: "📅" },
  { kind: "chore",   labelKey: "fab.chore",   ico: "✅" },
  { kind: "meal",    labelKey: "fab.meal",    ico: "🍽️" },
  { kind: "budget",  labelKey: "fab.budget",  ico: "💰" },
  { kind: "grocery", labelKey: "fab.grocery", ico: "🛒" }
];

function fabDate(){
  if (state.calView === "day") return iso(state.viewDate);
  if (state.calView === "agenda") return agendaSel();
  return todayISO();
}

function buildFab(){
  if (document.getElementById("fabWrap")) return;
  const wrap = document.createElement("div");
  wrap.id = "fabWrap";
  wrap.innerHTML = `
    <div class="fab-scrim" id="fabScrim"></div>
    <div class="fab-menu">
      ${FAB_ACTIONS.map((a, i) => `
        <button class="fab-item" data-fab="${a.kind}" style="--i:${i}">
          <span class="fab-item-label">${escapeHtml(t(a.labelKey))}</span>
          <span class="fab-item-ico">${a.ico}</span>
        </button>`).join("")}
    </div>
    <button class="fab" id="fabBtn" aria-label="${escapeHtml(t("common.add"))}" aria-haspopup="true" aria-expanded="false">
      <span class="fab-plus">+</span>
    </button>`;
  document.body.appendChild(wrap);

  const btn = wrap.querySelector("#fabBtn");
  const setOpen = (v) => {
    wrap.classList.toggle("open", v);
    btn.setAttribute("aria-expanded", v ? "true" : "false");
  };
  const close = () => setOpen(false);
  btn.addEventListener("click", () => setOpen(!wrap.classList.contains("open")));
  wrap.querySelector("#fabScrim").addEventListener("click", close);
  wrap.querySelector(".fab-menu").addEventListener("click", (e) => {
    const b = e.target.closest("[data-fab]");
    if (!b) return;
    close();
    openAdd(b.dataset.fab, fabDate());
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });
}
