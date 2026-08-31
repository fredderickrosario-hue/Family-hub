/* ============================================================
   FAMILY HUB — Calendar tab
   Month / Week / Day / Agenda views, event chips in the grid,
   a radial "+" menu, and the day drill-down.
   ============================================================ */
import {
  state, onStateChange, add, update, remove,
  DOW, MONTHS, iso, todayISO, parseISO, fmtDayLabel, relativeDay, escapeHtml,
  profileName, profileById, profileColor, addDaysD, startOfWeek, setCalView,
  orderedDOW, weekStartDay
} from "./state.js";
import { openModal, toast } from "./ui.js";
import { t } from "./i18n.js";
import { gcalEnabled, gcalFetchMonth, openGcalSettings } from "./gcal.js";
import { openChoreForm, toggleChore } from "./chores.js";
import { openBudgetForm } from "./budget.js";
import { openMealForm } from "./meals.js";
import { setLed } from "./app.js";

const cap = (s) => String(s || "").replace(/^./, (c) => c.toUpperCase());

let root;

const VIEWS = ["month", "week", "day", "agenda"];

let dialOpen = false;
function setDial(v){
  dialOpen = v;
  const d = root && root.querySelector(".cal-viewdial");
  if (d) d.classList.toggle("open", v);
}

/* ---------- Init ---------- */
export function initCalendar(){
  root = document.getElementById("calRoot");
  buildFab();
  root.addEventListener("click", onRootClick);

  // close the view dial when clicking anywhere outside it
  document.addEventListener("click", (e) => {
    if (e.target.closest(".cal-viewdial")) return;
    if (dialOpen) setDial(false);
  });

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

function externalEvents(dISO){
  const out = [];
  if (gcalEnabled()) out.push(...state.gcalEvents.filter(e => e.date === dISO));
  if (state.icsEvents && state.icsEvents.length)
    out.push(...state.icsEvents.filter(e => e.date === dISO));
  return out;
}

function itemsForDate(dateISO){
  const out = [];

  state.events.filter(e => e.date === dateISO).forEach(e => out.push({
    kind: "event", cls: "evt", title: e.title || "(untitled)",
    time: e.time || "", allDay: !e.time, raw: e
  }));

  externalEvents(dateISO).forEach(e => out.push({
    kind: "gcal", cls: "gcal", title: e.title || "(busy)",
    time: e.time || "", allDay: !!e.allDay, sub: e.location || "",
    color: e.color || null, raw: e
  }));

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
  if (dialOpen) root.querySelector(".cal-viewdial")?.classList.add("open");

  setLed("ledMain",
    itemsForDate(todayISO()).some(i => i.kind === "event" || i.kind === "gcal"),
    "var(--info)");

  refreshGcal();
}

function toolbar(){
  const on = gcalEnabled();
  const others = VIEWS.filter(v => v !== state.calView);
  return `
    <div class="cal-toolbar">
      <span class="cal-title">${escapeHtml(t("nav.calendar"))}</span>
      <div class="cal-period">
        <button class="cal-step" data-step="-1" aria-label="Previous">‹</button>
        <button class="cal-period-label" data-step="0" title="${escapeHtml(t("common.today"))}">${escapeHtml(periodLabel())}</button>
        <button class="cal-step" data-step="1" aria-label="Next">›</button>
      </div>
      <button class="cal-step cal-today-btn" data-step="0">${escapeHtml(t("common.today"))}</button>
      <div class="cal-viewdial">
        <div class="cal-viewdial-menu">
          ${others.map((v) => `<button class="vd-opt" data-view="${v}">${escapeHtml(t("cal." + v))}</button>`).join("")}
        </div>
        <button class="cal-viewdial-btn" data-viewdial>${escapeHtml(t("cal." + state.calView))}<span class="vd-caret">▾</span></button>
      </div>
      <button class="cal-sync-mini${on ? " on" : ""}" data-sync title="Google Calendar">${on ? "✓" : "🔗"}</button>
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
  return `${MONTHS[d.getMonth()].slice(0, 3)} ${d.getFullYear()}`;
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
  const maxChips = window.matchMedia("(min-width: 768px)").matches ? 4 : 3;

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
  const full = fmtDayLabel(sel);
  const diff = Math.round((parseISO(sel) - parseISO(todayISO())) / 86400000);
  const head = Math.abs(diff) <= 1 ? `${relativeDay(sel)} · ${full}` : full;
  return `
    <div class="agenda">
      <div class="agenda-left">
        <div class="agenda-side card w-side">${miniMonth(sel)}</div>
        ${wGrocery(sel)}
        ${wMeals(sel)}
      </div>
      <div class="agenda-right">
        <div class="agenda-day w-day">${escapeHtml(head)}</div>
        ${wEvents(sel)}
        ${wTasks(sel)}
      </div>
    </div>`;
}

/* ---------- Agenda widgets ---------- */
function widget(ico, title, count, body, extra = ""){
  return `<div class="widget card ${extra}">
    <div class="widget-head"><span class="widget-ico">${ico}</span>${escapeHtml(title)}
      ${count ? `<span class="widget-count">${count}</span>` : ""}</div>
    <div class="widget-body">${body}</div>
  </div>`;
}
const wEmpty = (txt) => `<div class="widget-empty">${escapeHtml(txt)}</div>`;

function wEvents(dISO){
  const rows = [];
  state.events.filter(e => e.date === dISO).forEach(e =>
    rows.push({ id: e.id, kind: "event", cls: "evt", title: e.title || "(untitled)", time: e.time || "", allDay: !e.time }));
  externalEvents(dISO).forEach(e =>
    rows.push({ id: e.id, kind: "gcal", cls: "gcal", title: e.title || "(busy)", time: e.time || "", allDay: !!e.allDay, color: e.color }));
  rows.sort((a, b) => (a.allDay ? 1 : 0) - (b.allDay ? 1 : 0) || (a.time || "").localeCompare(b.time || ""));

  const body = rows.length
    ? rows.map(e => `
      <div class="crow ${e.cls}" data-kind="${e.kind}" data-id="${escapeHtml(e.id)}"${e.color ? ` style="--chip-color:${e.color}"` : ""}>
        <span class="crow-bar"></span>
        <div class="crow-main">
          <div class="crow-title">${escapeHtml(e.title)}</div>
          <div class="crow-meta">${e.allDay ? escapeHtml(t("common.all_day")) : escapeHtml(e.time)}</div>
        </div>
      </div>`).join("")
    : wEmpty(t("cal.empty_short"));
  return widget("📅", t("fab.event"), rows.length, body, "w-events");
}

function wTasks(dISO){
  const cs = state.chores.filter(c => c.dueDate === dISO);
  const body = cs.length
    ? cs.map(c => {
        const done = c.completed || c.completionDate === dISO;
        const p = profileById(c.assignee);
        return `
        <div class="wrow task-row" data-taskid="${escapeHtml(c.id)}">
          <button class="check ${done ? "checked" : ""}" data-taskcheck aria-label="${escapeHtml(c.title)}"></button>
          <div class="crow-main">
            <div class="crow-title${done ? " struck" : ""}">${escapeHtml(c.title)}</div>
            ${p ? `<div class="crow-meta" style="color:${p.color}">${escapeHtml(p.name)}</div>` : ""}
          </div>
          ${c.isKidChore && c.points ? `<span class="badge points">${escapeHtml(t("chores.points", { n: c.points }))}</span>` : ""}
        </div>`;
      }).join("")
    : wEmpty(t("chores.none_today"));
  return widget("✅", t("nav.chores"), cs.length, body, "w-tasks");
}

function wMeals(dISO){
  const order = ["breakfast", "lunch", "dinner", "snack"];
  const ms = state.meals.filter(m => m.date === dISO)
    .sort((a, b) => order.indexOf(a.mealType) - order.indexOf(b.mealType));
  const body = ms.length
    ? ms.map(m => `
      <div class="wrow meal-row" data-mealid="${escapeHtml(m.id)}">
        <span class="meal-tag">${escapeHtml(t("meal." + m.mealType))}</span>
        <div class="crow-title">${escapeHtml(m.description || "")}</div>
      </div>`).join("")
    : wEmpty(t("meal.none_today"));
  return widget("🍽️", t("nav.meal"), ms.length, body, "w-meals");
}

function wGrocery(){
  const items = state.groceryItems.filter(i => !i.checked)
    .sort((a, b) => (a.addedDate || 0) - (b.addedDate || 0));
  const shown = items.slice(0, 8);
  const body = items.length
    ? shown.map(i => `
        <div class="wrow g-row" data-gid="${escapeHtml(i.id)}">
          <button class="check check-sm" data-gcheck aria-label="${escapeHtml(i.name)}"></button>
          <div class="crow-title">${escapeHtml(i.name)}</div>
        </div>`).join("") +
        (items.length > shown.length ? `<div class="wrow-more">+${items.length - shown.length}</div>` : "")
    : wEmpty(t("grocery.empty"));
  return widget("🛒", t("nav.grocery"), items.length, body, "w-grocery");
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
  if (e.target.closest("[data-viewdial]")){ setDial(!dialOpen); return; }

  const vdOpt = e.target.closest(".vd-opt");
  if (vdOpt){ setDial(false); setCalView(vdOpt.dataset.view); render(); return; }

  if (e.target.closest("[data-sync]")){ openGcalSettings(render); return; }

  if (dialOpen) setDial(false);

  const step = e.target.closest("[data-step]");
  if (step){ doStep(Number(step.dataset.step)); return; }

  /* agenda widget interactions */
  const tCheck = e.target.closest("[data-taskcheck]");
  if (tCheck){
    const c = state.chores.find(x => x.id === tCheck.closest("[data-taskid]").dataset.taskid);
    if (c){ tCheck.classList.toggle("checked"); toggleChore(c).catch(() => toast(t("common.error"))); }
    return;
  }
  const taskRow = e.target.closest("[data-taskid]");
  if (taskRow){
    const c = state.chores.find(x => x.id === taskRow.dataset.taskid);
    if (c) openChoreForm(c);
    return;
  }
  const gCheck = e.target.closest("[data-gcheck]");
  if (gCheck){
    gCheck.classList.add("checked");
    update("groceryItems", gCheck.closest("[data-gid]").dataset.gid, { checked: true }).catch(() => {});
    return;
  }
  const mealRow = e.target.closest("[data-mealid]");
  if (mealRow){
    const m = state.meals.find(x => x.id === mealRow.dataset.mealid);
    if (m) openMealForm(m.date, m.mealType, m);
    return;
  }

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
    const ev = state.gcalEvents.find(x => x.id === id) ||
               (state.icsEvents || []).find(x => x.id === id);
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
      <span class="fab-plus" aria-hidden="true"></span>
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
