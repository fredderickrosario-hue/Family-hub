/* ============================================================
   FAMILY HUB — Meal tab
   Weekly grid (meal type rows × day columns), tap a cell to
   plan, today highlighted, one-tap "add ingredients to grocery".
   ============================================================ */
import {
  state, onStateChange, add, update, remove,
  DOW, iso, todayISO, parseISO, fmtShort, escapeHtml
} from "./state.js";
import { openModal, toast } from "./ui.js";

let panel;
let weekStartISO;               // Sunday of the visible week
const MEAL_TYPES = ["breakfast", "lunch", "dinner"];

export function initMeals(){
  panel = document.getElementById("panel-meal");
  weekStartISO = sundayOf(todayISO());
  panel.innerHTML = `
    <div class="panel-head">
      <h2>Meals</h2>
      <button class="btn-add" id="mealGrocery"><span class="plus">🛒</span> Week → Grocery</button>
    </div>
    <div class="cal-nav">
      <button id="mealPrev" aria-label="Previous week">‹</button>
      <span class="cal-month-label" id="mealWeekLabel">--</span>
      <button id="mealNext" aria-label="Next week">›</button>
    </div>
    <div class="meal-wrap"><div class="meal-grid" id="mealGrid"></div></div>

    <div class="section-title">Tonight & Today</div>
    <div class="today-meals" id="mealToday"></div>
  `;

  panel.querySelector("#mealPrev").addEventListener("click", () => { weekStartISO = shiftWeek(-7); render(); });
  panel.querySelector("#mealNext").addEventListener("click", () => { weekStartISO = shiftWeek(7); render(); });
  panel.querySelector("#mealGrid").addEventListener("click", onGridClick);
  panel.querySelector("#mealGrocery").addEventListener("click", weekToGrocery);
  panel.querySelector("#mealToday").addEventListener("click", onTodayClick);

  onStateChange(render);
  render();
}

function sundayOf(dateISO){
  const d = parseISO(dateISO);
  d.setDate(d.getDate() - d.getDay());
  return iso(d);
}
function shiftWeek(days){
  const d = parseISO(weekStartISO);
  d.setDate(d.getDate() + days);
  return iso(d);
}
function weekDates(){
  return Array.from({ length: 7 }, (_, i) => {
    const d = parseISO(weekStartISO);
    d.setDate(d.getDate() + i);
    return iso(d);
  });
}

function mealAt(dateISO, type){
  return state.meals.find(m => m.date === dateISO && m.mealType === type) || null;
}

function render(){
  if (!panel) return;
  const dates = weekDates();
  const today = todayISO();
  panel.querySelector("#mealWeekLabel").textContent =
    `${fmtShort(dates[0])} – ${fmtShort(dates[6])}`;

  let html = `<div class="mg-head"></div>`;
  dates.forEach(dt => {
    const d = parseISO(dt);
    html += `<div class="mg-head ${dt === today ? "today" : ""}">${DOW[d.getDay()]}<br>${d.getDate()}</div>`;
  });

  MEAL_TYPES.forEach(type => {
    html += `<div class="mg-row-label">${type}</div>`;
    dates.forEach(dt => {
      const m = mealAt(dt, type);
      const linked = m && m.ingredients && m.ingredients.length;
      html += `
        <div class="meal-cell ${dt === today ? "today" : ""} ${m ? "" : "empty-cell"}"
             data-date="${dt}" data-type="${type}">
          ${m ? `<span>${escapeHtml(m.description)}</span>${linked ? `<span class="mc-ingr" title="Has ingredients">🛒</span>` : ""}` : "+"}
        </div>`;
    });
  });
  panel.querySelector("#mealGrid").innerHTML = html;

  renderToday(today);
}

function renderToday(today){
  const meals = state.meals
    .filter(m => m.date === today)
    .sort((a, b) => MEAL_TYPES.indexOf(a.mealType) - MEAL_TYPES.indexOf(b.mealType));
  const el = panel.querySelector("#mealToday");
  if (!meals.length){
    el.innerHTML = `<div class="empty" style="grid-column:1/-1;">No meals planned for today yet.</div>`;
    return;
  }
  el.innerHTML = meals.map(m => `
    <div class="today-meal" data-id="${m.id}">
      <div class="tm-type">${escapeHtml(m.mealType)}</div>
      <div class="tm-desc">${escapeHtml(m.description)}</div>
      ${m.ingredients && m.ingredients.length
        ? `<button class="btn btn-sm btn-ghost" data-act="grocery" style="margin-top:8px;">🛒 Add ingredients</button>` : ""}
    </div>`).join("");
}

function onGridClick(e){
  const cell = e.target.closest(".meal-cell");
  if (!cell) return;
  openMealForm(cell.dataset.date, cell.dataset.type, mealAt(cell.dataset.date, cell.dataset.type));
}
function onTodayClick(e){
  const wrap = e.target.closest(".today-meal");
  if (!wrap) return;
  const m = state.meals.find(x => x.id === wrap.dataset.id);
  if (!m) return;
  if (e.target.closest("[data-act='grocery']")) addIngredients(m.ingredients);
  else openMealForm(m.date, m.mealType, m);
}

export function openMealForm(date, type, m){
  openModal({
    title: m ? "Edit meal" : "Plan meal",
    fields: [
      { name: "mealType", label: "Meal", type: "select", value: type,
        options: ["breakfast", "lunch", "dinner", "snack"].map(v => ({ value: v, label: v.replace(/^./, s => s.toUpperCase()) })) },
      { name: "date", label: "Date", type: "date", value: date, required: true },
      { name: "description", label: "What's cooking?", type: "text", required: true, value: m?.description || "" },
      { name: "ingredients", label: "Ingredients", type: "text",
        value: (m?.ingredients || []).join(", "),
        hint: "Comma separated — powers the grocery sync" },
      { name: "notes", label: "Notes", type: "text", value: m?.notes || "" }
    ],
    onDelete: m ? async () => { await remove("meals", m.id); toast("Meal removed"); } : null,
    onSubmit: async (d) => {
      const payload = {
        date: d.date, mealType: d.mealType, description: d.description,
        ingredients: splitList(d.ingredients), notes: d.notes || ""
      };
      if (m) await update("meals", m.id, payload);
      else await add("meals", payload);
      toast("Saved");
    }
  });
}

function splitList(s){
  return String(s || "").split(",").map(x => x.trim()).filter(Boolean);
}

async function addIngredients(list){
  const items = (list || []).map(x => x.trim()).filter(Boolean);
  if (!items.length){ toast("No ingredients on this meal"); return; }
  const existing = new Set(state.groceryItems.map(g => g.name.toLowerCase()));
  let added = 0;
  for (const name of items){
    if (existing.has(name.toLowerCase())) continue;
    await add("groceryItems", { name, checked: false, addedDate: Date.now(), category: "" });
    added++;
  }
  toast(added ? `Added ${added} item${added === 1 ? "" : "s"} to grocery` : "Already on the list");
}

async function weekToGrocery(){
  const dates = new Set(weekDates());
  const all = [];
  state.meals.forEach(m => { if (dates.has(m.date)) all.push(...(m.ingredients || [])); });
  if (!all.length){ toast("No ingredients planned this week"); return; }
  await addIngredients([...new Set(all)]);
}
