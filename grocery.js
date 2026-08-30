/* ============================================================
   FAMILY HUB — Grocery tab
   Big checklist, quick add (typed or voice), category grouping,
   checked items drop to a Done section, prominent count.
   ============================================================ */
import {
  state, onStateChange, add, update, remove, escapeHtml
} from "./state.js";
import { toast } from "./ui.js";
import { t, getLang } from "./i18n.js";
import { setLed } from "./app.js";

let panel, recognition, listening = false;

const CATEGORIES = ["Produce", "Dairy", "Meat", "Bakery", "Frozen", "Pantry", "Drinks", "Household", "Other"];
const catLabel = (c) => t("cat." + c) === "cat." + c ? c : t("cat." + c);

export function initGrocery(){
  panel = document.getElementById("panel-grocery");
  panel.innerHTML = `
    <div class="panel-head">
      <h2>${escapeHtml(t("grocery.title"))}</h2>
      <span class="sub" id="groceryCount"></span>
    </div>
    <form class="grocery-add" id="groceryForm">
      <input type="text" id="groceryInput" placeholder="${escapeHtml(t("grocery.add_ph"))}" autocomplete="off" aria-label="${escapeHtml(t("grocery.add_ph"))}">
      <button type="button" class="mic" id="groceryMic" aria-label="Voice input" title="Voice input">🎤</button>
      <button type="submit" class="btn btn-primary g-add-btn">${escapeHtml(t("common.add"))}</button>
    </form>
    <div id="groceryList"></div>
  `;

  panel.querySelector("#groceryForm").addEventListener("submit", (e) => {
    e.preventDefault();
    addFromInput();
  });
  panel.querySelector("#groceryInput").addEventListener("keydown", (e) => {
    if (e.key === "Enter"){ e.preventDefault(); addFromInput(); }
  });
  panel.querySelector("#groceryMic").addEventListener("click", toggleMic);
  panel.querySelector("#groceryList").addEventListener("click", onListClick);

  setupSpeech();
  onStateChange(render);
  render();
}

function addFromInput(){
  const input = panel.querySelector("#groceryInput");
  const raw = input.value.trim();
  if (!raw) return;
  // allow "milk, eggs, bread"
  raw.split(",").map(s => s.trim()).filter(Boolean).forEach(addItem);
  input.value = "";
  input.focus();
}

async function addItem(name){
  const clean = name.replace(/\s+/g, " ").trim();
  if (!clean) return;
  if (state.groceryItems.some(g => g.name.toLowerCase() === clean.toLowerCase())){
    toast(`"${clean}" is already on the list`);
    return;
  }
  await add("groceryItems", { name: clean, checked: false, addedDate: Date.now(), category: guessCategory(clean) });
}

function guessCategory(name){
  const n = name.toLowerCase();
  const map = {
    Produce: ["apple", "banana", "lettuce", "tomato", "onion", "potato", "carrot", "spinach", "pepper", "berries", "lemon", "lime", "avocado", "garlic"],
    Dairy: ["milk", "cheese", "yogurt", "butter", "cream", "egg"],
    Meat: ["chicken", "beef", "pork", "bacon", "turkey", "fish", "salmon", "sausage"],
    Bakery: ["bread", "bagel", "bun", "tortilla", "roll"],
    Frozen: ["frozen", "ice cream", "peas"],
    Drinks: ["juice", "soda", "coffee", "tea", "water", "beer", "wine"],
    Household: ["paper towel", "toilet", "detergent", "soap", "trash bag", "foil", "sponge"],
    Pantry: ["pasta", "rice", "flour", "sugar", "oil", "sauce", "beans", "cereal", "salt"]
  };
  for (const [cat, words] of Object.entries(map)){
    if (words.some(w => n.includes(w))) return cat;
  }
  return "Other";
}

function render(){
  if (!panel) return;
  const items = state.groceryItems.slice().sort((a, b) => (a.addedDate || 0) - (b.addedDate || 0));
  const active = items.filter(i => !i.checked);
  const done = items.filter(i => i.checked);

  panel.querySelector("#groceryCount").textContent = t("grocery.to_get", { n: active.length });

  const groups = {};
  active.forEach(i => {
    const cat = i.category || "Other";
    (groups[cat] = groups[cat] || []).push(i);
  });
  const order = CATEGORIES.filter(c => groups[c]);
  Object.keys(groups).forEach(c => { if (!order.includes(c)) order.push(c); });

  let html = "";
  if (!active.length){
    html += `<div class="empty">${escapeHtml(t("grocery.empty"))}</div>`;
  } else if (order.length <= 1){
    html += `<div class="card-list">${active.map(row).join("")}</div>`;
  } else {
    order.forEach(cat => {
      html += `<div class="section-title">${escapeHtml(catLabel(cat))} <span class="count">${groups[cat].length}</span></div>
        <div class="card-list cat-group">${groups[cat].map(row).join("")}</div>`;
    });
  }

  if (done.length){
    html += `<div class="section-title">${escapeHtml(t("common.done"))} <span class="count">${done.length}</span>
      <button class="btn-sm btn-ghost" data-act="clear" style="margin-left:auto;">${escapeHtml(t("common.clear"))}</button></div>
      <div class="card-list">${done.map(row).join("")}</div>`;
  }
  panel.querySelector("#groceryList").innerHTML = html;
}

function row(i){
  return `
    <div class="grocery-row ${i.checked ? "checked" : ""}" data-id="${i.id}">
      <button class="check ${i.checked ? "checked" : ""}" data-act="toggle" aria-label="Toggle ${escapeHtml(i.name)}"></button>
      <span class="g-name">${escapeHtml(i.name)}</span>
      ${i.category && i.category !== "Other" ? `<span class="g-cat">${escapeHtml(catLabel(i.category))}</span>` : ""}
      <button class="g-del" data-act="del" aria-label="Remove ${escapeHtml(i.name)}">✕</button>
    </div>`;
}

function onListClick(e){
  if (e.target.closest("[data-act='clear']")){
    state.groceryItems.filter(i => i.checked).forEach(i => remove("groceryItems", i.id));
    return;
  }
  const rowEl = e.target.closest(".grocery-row");
  if (!rowEl) return;
  const item = state.groceryItems.find(x => x.id === rowEl.dataset.id);
  if (!item) return;
  const act = e.target.closest("[data-act]")?.dataset.act;
  if (act === "toggle"){
    rowEl.classList.toggle("checked");
    update("groceryItems", item.id, { checked: !item.checked }).catch(() => toast(t("common.error")));
  } else if (act === "del"){
    remove("groceryItems", item.id).catch(() => toast(t("common.error")));
  }
}

/* ---------- Voice input ---------- */
function setupSpeech(){
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const mic = panel.querySelector("#groceryMic");
  if (!SR){ mic.style.display = "none"; return; }
  recognition = new SR();
  recognition.lang = getLang() === "fr" ? "fr-CA" : "en-US";
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;
  recognition.addEventListener("result", (e) => {
    const text = e.results[0][0].transcript.trim();
    if (text){
      text.replace(/\band\b/gi, ",").split(",").map(s => s.trim()).filter(Boolean).forEach(addItem);
      toast(`Added: ${text}`);
    }
  });
  recognition.addEventListener("error", () => toast("Voice input didn't catch that"));
  recognition.addEventListener("end", () => { listening = false; mic.classList.remove("listening"); });
}
function toggleMic(){
  if (!recognition) return;
  const mic = panel.querySelector("#groceryMic");
  if (listening){ recognition.stop(); return; }
  try {
    recognition.start();
    listening = true;
    mic.classList.add("listening");
  } catch { /* already started */ }
}

export function groceryLed(){
  const n = state.groceryItems.filter(i => !i.checked).length;
  setLed("ledGrocery", n > 0, "var(--p-orange)");
}
