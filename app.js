/* ============================================================
   FAMILY HUB — app shell
   Header, tab switching, module init. Each tab module owns its
   own panel and pulls from state.js.
   ============================================================ */
import { onStateChange, initSync, DOW, MONTHS, todayISO } from "./state.js";
import { t } from "./i18n.js";
import { initTheme } from "./theme.js";

import { initCalendar } from "./calendar.js";
import { initChores, choresLed } from "./chores.js";
import { initBudget, budgetLed } from "./budget.js";
import { initMeals } from "./meals.js";
import { initGrocery, groceryLed } from "./grocery.js";
import { initFamily } from "./profiles.js";
import { initWeather } from "./weather.js";
import { initSettings } from "./settings.js";

/* ---------- Static i18n (data-i18n attributes) ---------- */
function applyStaticI18n(){
  document.querySelectorAll("[data-i18n]").forEach(el => {
    el.textContent = t(el.dataset.i18n);
  });
  document.documentElement.lang = (localStorage.getItem("familyhub.lang") || "en");
}

/* ---------- Header date ---------- */
function renderHeaderDate(){
  const now = new Date();
  document.getElementById("headerDate").textContent =
    `${DOW[now.getDay()]} · ${MONTHS[now.getMonth()].slice(0, 3).toUpperCase()} ${now.getDate()}`;
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

/* ---------- Shared LED helper ---------- */
export function setLed(id, on, color){
  const led = document.getElementById(id);
  if (!led) return;
  led.classList.toggle("on", !!on);
  if (color) led.style.setProperty("--led-color", color);
}

/* ---------- Init ---------- */
initTheme();
applyStaticI18n();
renderHeaderDate();
initWeather();

initCalendar();
initChores();
initBudget();
initMeals();
initGrocery();
initFamily();
initSettings();

onStateChange(() => {
  choresLed();
  budgetLed();
  groceryLed();
});

initSync();

/* refresh "today" at midnight rollover */
let lastToday = todayISO();
setInterval(() => {
  const t = todayISO();
  if (t !== lastToday){ lastToday = t; renderHeaderDate(); }
}, 60000);

/* ---------- Service worker ---------- */
if ("serviceWorker" in navigator){
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch(console.warn);
  });
}
