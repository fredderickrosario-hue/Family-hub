/* ============================================================
   FAMILY HUB — Chores tab
   Due Today / Overdue / Upcoming / Completed, big satisfying
   checkboxes, kid points, recurring chores, rewards catalog.
   ============================================================ */
import {
  state, onStateChange, add, update, remove,
  todayISO, parseISO, iso, addDays, relativeDay,
  escapeHtml, profileById, profileColor
} from "./state.js";
import { openModal, toast, confirmAction } from "./ui.js";
import { setLed } from "./app.js";

let panel;

export function initChores(){
  panel = document.getElementById("panel-chores");
  panel.innerHTML = `
    <div class="panel-head">
      <h2>Chores</h2>
      <button class="btn-add" id="choreAdd"><span class="plus">+</span> Chore</button>
    </div>
    <div id="choreSections"></div>

    <div class="section-title">Scoreboard</div>
    <div class="scoreboard" id="choreScore"></div>

    <div class="section-title">
      Rewards
      <button class="btn-sm btn-ghost" id="rewardAdd" style="margin-left:auto;">+ Reward</button>
    </div>
    <div class="card-list" id="rewardList"></div>
  `;

  panel.querySelector("#choreAdd").addEventListener("click", () => openChoreForm());
  panel.querySelector("#rewardAdd").addEventListener("click", () => openRewardForm());

  panel.querySelector("#choreSections").addEventListener("click", onSectionClick);
  panel.querySelector("#rewardList").addEventListener("click", onRewardClick);

  onStateChange(render);
  render();
}

/* ---------- Recurrence ---------- */
function isRecurring(c){ return c.recurring && c.recurring !== "never"; }

function nextDue(c, fromISO){
  const from = parseISO(fromISO);
  if (c.recurring === "daily") return addDays(fromISO, 1);
  if (c.recurring === "monthly"){
    const target = from.getDate();
    const d = new Date(from.getFullYear(), from.getMonth() + 1, 1);
    const dim = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    d.setDate(Math.min(target, dim));
    return iso(d);
  }
  // weekly
  const days = (c.recurrenceDays && c.recurrenceDays.length)
    ? [...c.recurrenceDays].sort((a, b) => a - b)
    : [from.getDay()];
  const cur = from.getDay();
  let next = days.find(d => d > cur);
  let delta;
  if (next == null){ next = days[0]; delta = 7 - cur + next; }
  else delta = next - cur;
  return addDays(fromISO, delta || 7);
}

/* ---------- Points ---------- */
async function awardPoints(profileId, delta){
  const p = profileById(profileId);
  if (!p) return;
  await update("profiles", profileId, { points: Math.max(0, (p.points || 0) + delta) });
}

/* ---------- Complete / undo ---------- */
async function toggleChore(c){
  const today = todayISO();
  if (isRecurring(c)){
    if (c.completionDate === today){
      await update("chores", c.id, { completionDate: null, dueDate: today });
      if (c.isKidChore && c.assignee) await awardPoints(c.assignee, -(c.points || 0));
    } else {
      await update("chores", c.id, { completionDate: today, dueDate: nextDue(c, today) });
      if (c.isKidChore && c.assignee) await awardPoints(c.assignee, c.points || 0);
    }
  } else {
    const nowDone = !c.completed;
    await update("chores", c.id, { completed: nowDone, completedAt: nowDone ? Date.now() : null });
    if (c.isKidChore && c.assignee) await awardPoints(c.assignee, nowDone ? (c.points || 0) : -(c.points || 0));
  }
}

/* ---------- Buckets ---------- */
function buckets(){
  const today = todayISO();
  const overdue = [], dueToday = [], upcoming = [], completed = [];
  for (const c of state.chores){
    if (isRecurring(c)){
      if (c.completionDate === today){ dueToday.push({ c, doneToday: true }); continue; }
      if (c.dueDate < today) overdue.push({ c });
      else if (c.dueDate === today) dueToday.push({ c });
      else upcoming.push({ c });
    } else {
      if (c.completed){ completed.push({ c }); continue; }
      if (!c.dueDate || c.dueDate > today) upcoming.push({ c });
      else if (c.dueDate < today) overdue.push({ c });
      else dueToday.push({ c });
    }
  }
  const byDate = (a, b) => String(a.c.dueDate || "").localeCompare(String(b.c.dueDate || ""));
  overdue.sort(byDate); upcoming.sort(byDate);
  completed.sort((a, b) => (b.c.completedAt || 0) - (a.c.completedAt || 0));
  return { overdue, dueToday, upcoming, completed };
}

/* ---------- Render ---------- */
function render(){
  if (!panel) return;
  const { overdue, dueToday, upcoming, completed } = buckets();
  const sections = [];

  if (overdue.length)
    sections.push(section("Overdue", overdue, true));
  sections.push(section("Due Today", dueToday, false, "Nothing due today — nice."));
  if (upcoming.length)
    sections.push(section("Upcoming", upcoming.slice(0, 30)));
  if (completed.length)
    sections.push(section("Completed", completed.slice(0, 20)));

  panel.querySelector("#choreSections").innerHTML = sections.join("");
  renderScoreboard();
  renderRewards();
}

function section(title, items, danger, emptyMsg){
  const rows = items.length
    ? `<div class="card-list">${items.map(choreRow).join("")}</div>`
    : `<div class="empty">${escapeHtml(emptyMsg || "Nothing here.")}</div>`;
  return `
    <div class="section-title ${danger ? "danger" : ""}">
      ${escapeHtml(title)} <span class="count">${items.length}</span>
    </div>
    ${rows}`;
}

function choreRow({ c, doneToday }){
  const today = todayISO();
  const p = profileById(c.assignee);
  const done = doneToday || c.completed;
  const overdue = !done && c.dueDate && c.dueDate < today;
  return `
    <div class="chore-row ${done ? "done" : ""} ${overdue ? "overdue" : ""}" data-id="${c.id}">
      <button class="check ${done ? "checked" : ""}" data-act="toggle" aria-label="Toggle ${escapeHtml(c.title)}"></button>
      <div class="chore-main">
        <div class="chore-title">${escapeHtml(c.title)}</div>
        <div class="chore-sub">
          ${p ? `<span class="assignee-name" style="--chip-color:${p.color}">${escapeHtml(p.name)}</span>` : ""}
          ${c.dueDate ? `<span class="chore-due ${overdue ? "overdue" : ""}">${escapeHtml(relativeDay(c.dueDate))}</span>` : ""}
          ${c.isKidChore && c.points ? `<span class="badge points">${c.points} pt${c.points === 1 ? "" : "s"}</span>` : ""}
          ${isRecurring(c) ? `<span class="badge recur">↻ ${escapeHtml(c.recurring)}</span>` : ""}
          ${doneToday ? `<span class="badge done-today">Done today</span>` : ""}
        </div>
      </div>
      <span class="row-edit" aria-hidden="true">✏️</span>
    </div>`;
}

function onSectionClick(e){
  const row = e.target.closest(".chore-row");
  if (!row) return;
  const c = state.chores.find(x => x.id === row.dataset.id);
  if (!c) return;
  if (e.target.closest(".check")){
    const btn = e.target.closest(".check");
    if (btn && !btn.classList.contains("checked")) btn.classList.add("checked"); // instant feedback
    toggleChore(c).catch(() => toast("Couldn't update chore"));
  } else {
    // tap anywhere else on the row to edit (assignee, points, due date, repeat)
    openChoreForm(c);
  }
}

/* ---------- Scoreboard ---------- */
function renderScoreboard(){
  const kids = state.profiles.filter(p => p.isKid);
  const el = panel.querySelector("#choreScore");
  if (!kids.length){
    el.innerHTML = `<div class="empty" style="grid-column:1/-1;">Add kid profiles in the Family tab to track points.</div>`;
    return;
  }
  el.innerHTML = kids
    .slice()
    .sort((a, b) => (b.points || 0) - (a.points || 0))
    .map(p => `
      <div class="score-card" style="--chip-color:${p.color}">
        <div class="score-name">${escapeHtml(p.name)}</div>
        <div class="score-pts">${p.points || 0}</div>
        <div class="score-lbl">points</div>
      </div>`).join("");
}

/* ---------- Rewards ---------- */
function renderRewards(){
  const el = panel.querySelector("#rewardList");
  if (!state.rewards.length){
    el.innerHTML = `<div class="empty">No rewards yet. Add screen time, dessert, allowance…</div>`;
    return;
  }
  el.innerHTML = state.rewards
    .slice()
    .sort((a, b) => (a.cost || 0) - (b.cost || 0))
    .map(r => `
      <div class="reward-row" data-id="${r.id}">
        <div>
          <div style="font-weight:600;">${escapeHtml(r.name)}</div>
          <div class="reward-cost">${r.cost || 0} points</div>
        </div>
        <div style="display:flex;gap:8px;">
          <button class="btn btn-sm btn-primary" data-act="redeem">Redeem</button>
          <button class="btn btn-sm btn-ghost" data-act="edit">Edit</button>
        </div>
      </div>`).join("");
}

function onRewardClick(e){
  const row = e.target.closest(".reward-row");
  if (!row) return;
  const r = state.rewards.find(x => x.id === row.dataset.id);
  const act = e.target.closest("[data-act]")?.dataset.act;
  if (act === "redeem") redeemReward(r);
  else if (act === "edit") openRewardForm(r);
}

function redeemReward(r){
  const kids = state.profiles.filter(p => p.isKid);
  if (!kids.length){ toast("Add a kid profile first"); return; }
  openModal({
    title: `Redeem: ${r.name}`,
    submitLabel: "Redeem",
    fields: [{
      name: "who", label: "For which kid?", type: "select",
      options: kids.map(p => ({ value: p.id, label: `${p.name} (${p.points || 0} pts)` }))
    }],
    onSubmit: async ({ who }) => {
      const p = profileById(who);
      if (!p) return;
      if ((p.points || 0) < (r.cost || 0)){ toast(`${p.name} needs ${r.cost - (p.points || 0)} more points`); return; }
      await update("profiles", p.id, { points: (p.points || 0) - (r.cost || 0) });
      toast(`🎉 ${p.name} redeemed ${r.name}`);
    }
  });
}

function openRewardForm(r){
  openModal({
    title: r ? "Edit reward" : "New reward",
    fields: [
      { name: "name", label: "Reward", type: "text", required: true, value: r?.name || "" },
      { name: "cost", label: "Cost (points)", type: "number", min: 0, value: r?.cost ?? 10 }
    ],
    onDelete: r ? async () => { await remove("rewards", r.id); toast("Reward removed"); } : null,
    onSubmit: async (d) => {
      if (r) await update("rewards", r.id, { name: d.name, cost: Number(d.cost) || 0 });
      else await add("rewards", { name: d.name, cost: Number(d.cost) || 0 });
      toast("Saved");
    }
  });
}

/* ---------- Chore form ---------- */
export function openChoreForm(c){
  const editing = !!(c && c.id);
  const profileOpts = [{ value: "", label: "Unassigned" }]
    .concat(state.profiles.map(p => ({ value: p.id, label: p.name })));
  const recurOpts = ["never", "daily", "weekly", "monthly"]
    .map(v => ({ value: v, label: v.replace(/^./, s => s.toUpperCase()) }));

  openModal({
    title: editing ? "Edit chore" : "New chore",
    fields: [
      { name: "title", label: "Chore", type: "text", required: true, value: c?.title || "" },
      { name: "assignee", label: "Assigned to", type: "select", options: profileOpts, value: c?.assignee || "" },
      { name: "dueDate", label: "Due date", type: "date", value: c?.dueDate || todayISO(), required: true },
      { name: "isKidChore", label: "Kid chore (earns points)", type: "checkbox", value: c?.isKidChore ?? false },
      { name: "points", label: "Points", type: "number", min: 0, value: c?.points ?? 5 },
      { name: "recurring", label: "Repeats", type: "select", options: recurOpts, value: c?.recurring || "never",
        hint: "Weekly repeats on the due date's weekday" }
    ],
    onDelete: editing ? async () => { await remove("chores", c.id); toast("Chore deleted"); } : null,
    onSubmit: async (d) => {
      const payload = {
        title: d.title,
        assignee: d.assignee || null,
        dueDate: d.dueDate,
        isKidChore: !!d.isKidChore,
        points: Number(d.points) || 0,
        recurring: d.recurring || "never",
        recurrenceDays: d.recurring === "weekly" ? [parseISO(d.dueDate).getDay()] : []
      };
      if (editing){
        await update("chores", c.id, payload);
      } else {
        await add("chores", { ...payload, completed: false, completedAt: null, completionDate: null });
      }
      toast("Saved");
    }
  });
}

/* ---------- Nav LED ---------- */
export function choresLed(){
  const today = todayISO();
  const pending = state.chores.filter(c => {
    if (isRecurring(c)) return c.completionDate !== today && c.dueDate <= today;
    return !c.completed && c.dueDate && c.dueDate <= today;
  });
  const assignees = [...new Set(pending.map(c => c.assignee).filter(Boolean))];
  let color = "var(--p-teal)";
  if (pending.some(c => c.dueDate < today)) color = "var(--accent)";
  else if (assignees.length === 1) color = profileColor(assignees[0]);
  setLed("ledChores", pending.length > 0, color);
}
