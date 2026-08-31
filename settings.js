/* ============================================================
   FAMILY HUB — Settings tab
   Appearance (theme, language), calendar prefs, Google Calendar
   sync + calendar picker, data/update tools, about.
   ============================================================ */
import { state, onStateChange, nudge, escapeHtml } from "./state.js";
import { t, getLang, setLang } from "./i18n.js";
import { getTheme, setTheme } from "./theme.js";
import { toast } from "./ui.js";
import {
  gcalEnabled, gcalConfig, openGcalSettings, bustGcalCache,
  gcalListCalendars, selectedCals, setSelectedCals
} from "./gcal.js";
import { icsConfig, openIcsImport } from "./ics.js";

const APP_VERSION = "12";                 // keep in step with service-worker CACHE_NAME

let panel;
let calList = null;                       // cached calendar list from the relay
let calListErr = null;

export function initSettings(){
  panel = document.getElementById("panel-settings");
  panel.addEventListener("click", onClick);
  panel.addEventListener("change", onChange);
  if (gcalEnabled()) loadCalendars();
  onStateChange(render);
  render();
}

function pref(key, fallback){
  try { const v = localStorage.getItem(key); return v == null ? fallback : v; }
  catch { return fallback; }
}
function setPref(key, val){ try { localStorage.setItem(key, val); } catch {} }

/* ---------- Render ---------- */
function render(){
  if (!panel) return;
  panel.innerHTML = `
    <div class="panel-head"><h2>${escapeHtml(t("set.title"))}</h2></div>

    <div class="set-section">
      <div class="set-section-title">${escapeHtml(t("set.appearance"))}</div>
      <div class="set-row">
        <span class="set-label">${escapeHtml(t("set.theme"))}</span>
        <div class="seg" data-seg="theme">
          ${segBtn("theme", "light", t("set.theme_light"), getTheme())}
          ${segBtn("theme", "dark", t("set.theme_dark"), getTheme())}
          ${segBtn("theme", "system", t("set.theme_system"), getTheme())}
        </div>
      </div>
      <div class="set-row">
        <span class="set-label">${escapeHtml(t("set.language"))}</span>
        <div class="seg" data-seg="lang">
          ${segBtn("lang", "en", "English", getLang())}
          ${segBtn("lang", "fr", "Français", getLang())}
        </div>
      </div>
    </div>

    <div class="set-section">
      <div class="set-section-title">${escapeHtml(t("set.calendar"))}</div>
      <div class="set-row">
        <span class="set-label">${escapeHtml(t("set.default_view"))}</span>
        <select class="set-select" data-pref="familyhub.calView">
          ${["month","week","day","agenda"].map(v =>
            `<option value="${v}" ${pref("familyhub.calView","agenda") === v ? "selected" : ""}>${escapeHtml(t("cal." + v))}</option>`).join("")}
        </select>
      </div>
      <div class="set-row">
        <span class="set-label">${escapeHtml(t("set.week_start"))}</span>
        <div class="seg" data-seg="weekstart">
          ${segBtn("weekstart", "0", t("set.sunday"), pref("familyhub.weekStart","0"))}
          ${segBtn("weekstart", "1", t("set.monday"), pref("familyhub.weekStart","0"))}
        </div>
      </div>
    </div>

    <div class="set-section">
      <div class="set-section-title">${escapeHtml(t("set.synced_cals"))}</div>
      ${renderCalendars()}
    </div>

    <div class="set-section">
      <div class="set-section-title">${escapeHtml(t("set.data"))}</div>
      <button class="set-action" data-act="update">
        <span>${escapeHtml(t("set.check_updates"))}</span><span class="set-chevron">›</span>
      </button>
      <button class="set-action" data-act="reset-weather">
        <span>${escapeHtml(t("set.reset_weather"))}</span><span class="set-chevron">›</span>
      </button>
    </div>

    <div class="set-section">
      <div class="set-section-title">${escapeHtml(t("set.about"))}</div>
      <div class="set-row"><span class="set-label">${escapeHtml(t("set.version"))}</span>
        <span class="set-value">v${APP_VERSION}</span></div>
      <div class="set-row"><span class="set-label">Firestore</span>
        <span class="set-value">${state.profiles.length} · ${state.events.length + state.chores.length + state.meals.length}</span></div>
    </div>
  `;
}

function segBtn(seg, val, label, current){
  return `<button class="seg-btn${String(current) === val ? " active" : ""}" data-seg-val="${val}">${escapeHtml(label)}</button>`;
}

function icsBlock(){
  const c = icsConfig();
  const status = c && c.events && c.events.length
    ? `<p class="set-hint">${escapeHtml(t("ics.imported", { n: c.events.length, name: c.name || "calendar" }))}</p>`
    : "";
  return `
    ${status}
    <button class="set-action" data-act="import-ics">
      <span>${escapeHtml(t("set.import_phone"))}</span><span class="set-chevron">›</span>
    </button>`;
}

function renderCalendars(){
  if (!gcalEnabled()){
    return `
      <p class="set-hint">${escapeHtml(t("set.not_connected"))}</p>
      <button class="set-primary" data-act="connect">${escapeHtml(t("set.sync_new"))}</button>
      ${icsBlock()}`;
  }
  let rows = "";
  if (calList){
    const sel = selectedCals();
    rows = calList.map(c => {
      const on = !sel || sel.includes(c.id);
      return `
        <label class="cal-pick">
          <span class="cal-swatch" style="background:${escapeHtml(c.color || "#9AA7B0")}"></span>
          <span class="cal-pick-name">${escapeHtml(c.name)}${c.primary ? " ·" : ""}</span>
          <input type="checkbox" data-cal="${escapeHtml(c.id)}" ${on ? "checked" : ""}>
          <span class="cal-toggle"></span>
        </label>`;
    }).join("");
  } else if (calListErr){
    rows = `<p class="set-hint">${escapeHtml(calListErr)}</p>`;
  } else {
    rows = `<p class="set-hint">…</p>`;
  }
  return `
    <p class="set-hint">${escapeHtml(t("set.calendars_on"))}</p>
    <div class="cal-pick-list">${rows}</div>
    <div class="set-actions">
      <button class="set-primary" data-act="connect">${escapeHtml(t("set.reconfigure"))}</button>
      <button class="set-ghost" data-act="refresh-cals">↻</button>
    </div>
    ${icsBlock()}`;
}

/* ---------- Calendar list loading ---------- */
async function loadCalendars(){
  calListErr = null;
  try {
    calList = await gcalListCalendars();
    calList.sort((a, b) => (b.eventsThisMonth || 0) - (a.eventsThisMonth || 0));
  } catch (e){
    calList = null;
    calListErr = e.message;
  }
  render();
}

/* ---------- Events ---------- */
function onClick(e){
  const seg = e.target.closest(".seg-btn");
  if (seg){
    const which = seg.closest(".seg").dataset.seg;
    const val = seg.dataset.segVal;
    if (which === "theme"){ setTheme(val); render(); }
    else if (which === "lang") setLang(val);          // reloads
    else if (which === "weekstart"){ setPref("familyhub.weekStart", val); toast(t("common.saved")); render(); rerenderCalendar(); }
    return;
  }

  const act = e.target.closest("[data-act]")?.dataset.act;
  if (act === "connect"){
    openGcalSettings(() => { calList = null; if (gcalEnabled()) loadCalendars(); else render(); rerenderCalendar(); });
  } else if (act === "refresh-cals"){
    calList = null; render(); loadCalendars();
  } else if (act === "import-ics"){
    openIcsImport(() => { render(); rerenderCalendar(); });
  } else if (act === "update"){
    checkForUpdates();
  } else if (act === "reset-weather"){
    try { localStorage.removeItem("familyhub.weather"); } catch {}
    toast(t("wx.cleared"));
    location.reload();
  }
}

function onChange(e){
  const sel = e.target.closest("select[data-pref]");
  if (sel){
    setPref(sel.dataset.pref, sel.value);
    state.calView = sel.value;
    toast(t("common.saved"));
    rerenderCalendar();
    return;
  }
  const calCb = e.target.closest("input[data-cal]");
  if (calCb){
    const ids = [...panel.querySelectorAll("input[data-cal]:checked")].map(i => i.dataset.cal);
    setSelectedCals(ids);
    bustGcalCache();
    rerenderCalendar();
  }
}

function rerenderCalendar(){
  nudge();   // re-run every onStateChange subscriber (calendar re-renders)
}

async function checkForUpdates(){
  toast(t("set.updating"));
  try {
    if ("serviceWorker" in navigator){
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(r => r.update().catch(() => {})));
    }
    if (window.caches){
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
    }
  } catch {}
  setTimeout(() => location.reload(), 400);
}
