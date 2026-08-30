/* ============================================================
   FAMILY HUB — Budget tab
   Payments (money in) and payouts (money out). Big readable
   cards, Pending / Done sections, running summary.
   ============================================================ */
import {
  state, onStateChange, add, update, remove,
  todayISO, fmtShort, escapeHtml, fmtMoney
} from "./state.js";
import { openModal, toast } from "./ui.js";
import { t } from "./i18n.js";
import { setLed } from "./app.js";

let panel;

export function initBudget(){
  panel = document.getElementById("panel-budget");
  panel.innerHTML = `
    <div class="panel-head">
      <h2>${escapeHtml(t("budget.title"))}</h2>
      <button class="btn-add" id="budgetAdd"><span class="plus">+</span> ${escapeHtml(t("budget.add"))}</button>
    </div>
    <div class="budget-summary" id="budgetSummary"></div>
    <div id="budgetSections"></div>
  `;
  panel.querySelector("#budgetAdd").addEventListener("click", () => openBudgetForm());
  panel.querySelector("#budgetSections").addEventListener("click", onClick);
  onStateChange(render);
  render();
}

function render(){
  if (!panel) return;
  const entries = state.budgetEntries.slice()
    .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));

  const pending = entries.filter(e => (e.status || "pending") !== "completed");
  const done = entries.filter(e => (e.status || "pending") === "completed");

  renderSummary(entries);

  panel.querySelector("#budgetSections").innerHTML = `
    <div class="section-title">${escapeHtml(t("common.pending"))} <span class="count">${pending.length}</span></div>
    ${pending.length ? `<div class="card-list">${pending.map(card).join("")}</div>` : `<div class="empty">${escapeHtml(t("budget.no_pending"))}</div>`}
    ${done.length ? `<div class="section-title">${escapeHtml(t("common.done"))} <span class="count">${done.length}</span></div>
      <div class="card-list">${done.map(card).join("")}</div>` : ""}
  `;
}

function renderSummary(entries){
  const inSum = entries.filter(e => e.type !== "payout").reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const outSum = entries.filter(e => e.type === "payout").reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const net = inSum - outSum;
  const netStr = `${net < 0 ? "−" : ""}$${fmtMoney(Math.abs(net))}`;
  panel.querySelector("#budgetSummary").innerHTML = `
    <div class="summary-tile"><div class="s-label">${escapeHtml(t("budget.money_in"))}</div><div class="s-value in">$${fmtMoney(inSum)}</div></div>
    <div class="summary-tile"><div class="s-label">${escapeHtml(t("budget.money_out"))}</div><div class="s-value out">$${fmtMoney(outSum)}</div></div>
    <div class="summary-tile"><div class="s-label">${escapeHtml(t("budget.net"))}</div><div class="s-value ${net < 0 ? "out" : "in"}">${netStr}</div></div>
  `;
}

function card(e){
  const isOut = e.type === "payout";
  const dir = isOut ? "out" : "in";
  const completed = (e.status || "pending") === "completed";
  return `
    <div class="budget-card" data-id="${e.id}">
      <div class="budget-icon ${dir}">${isOut ? "↑" : "↓"}</div>
      <div class="budget-main">
        <div class="budget-party">${escapeHtml(e.party || "—")}</div>
        <div class="budget-date">${e.date ? escapeHtml(fmtShort(e.date)) : ""}${e.notes ? " · " + escapeHtml(e.notes) : ""}</div>
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px;">
        <div class="budget-amount ${dir}">${isOut ? "−" : "+"}$${fmtMoney(e.amount)}</div>
        <button class="status-toggle" data-act="status">${completed ? "✓ " + escapeHtml(t("common.done")) : escapeHtml(t("budget.mark_done"))}</button>
      </div>
    </div>`;
}

function onClick(e){
  const cardEl = e.target.closest(".budget-card");
  if (!cardEl) return;
  const entry = state.budgetEntries.find(x => x.id === cardEl.dataset.id);
  if (!entry) return;
  if (e.target.closest("[data-act='status']")){
    const next = (entry.status || "pending") === "completed" ? "pending" : "completed";
    update("budgetEntries", entry.id, { status: next }).catch(() => toast(t("common.error")));
  } else {
    openBudgetForm(entry);
  }
}

export function openBudgetForm(entry){
  const editing = !!(entry && entry.id);
  openModal({
    title: editing ? t("budget.edit") : t("budget.new"),
    fields: [
      { name: "party", label: t("budget.f_party"), type: "text", required: true, value: entry?.party || "" },
      { name: "amount", label: t("budget.f_amount"), type: "number", min: 0, step: 0.01, required: true, value: entry?.amount ?? "" },
      { name: "type", label: t("budget.f_dir"), type: "select", value: entry?.type || "payment",
        options: [{ value: "payment", label: t("budget.in") }, { value: "payout", label: t("budget.out") }] },
      { name: "date", label: t("common.date"), type: "date", required: true, value: entry?.date || todayISO() },
      { name: "status", label: t("budget.f_status"), type: "select", value: entry?.status || "pending",
        options: [{ value: "pending", label: t("common.pending") }, { value: "completed", label: t("common.done") }] },
      { name: "notes", label: t("common.notes"), type: "text", value: entry?.notes || "" }
    ],
    onDelete: editing ? async () => { await remove("budgetEntries", entry.id); toast(t("common.saved")); } : null,
    onSubmit: async (d) => {
      const payload = {
        party: d.party, amount: Number(d.amount) || 0, type: d.type,
        date: d.date, status: d.status, notes: d.notes || ""
      };
      if (editing) await update("budgetEntries", entry.id, payload);
      else await add("budgetEntries", payload);
      toast(t("common.saved"));
    }
  });
}

export function budgetLed(){
  const pending = state.budgetEntries.filter(e => (e.status || "pending") !== "completed");
  const overdue = pending.some(e => e.date && e.date < todayISO());
  setLed("ledBudget", pending.length > 0, overdue ? "var(--accent)" : "var(--warning)");
}
