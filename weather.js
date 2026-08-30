/* ============================================================
   FAMILY HUB — weather widget (header)
   Open-Meteo: free, no API key, CORS-friendly. GPS once with a
   manual city fallback. Location + unit stored per device.
   ============================================================ */
import { openModal, toast } from "./ui.js";
import { t, getLang } from "./i18n.js";

const LS = "familyhub.weather";
const cfg  = () => { try { return JSON.parse(localStorage.getItem(LS) || "null"); } catch { return null; } };
const save = (c) => { try { localStorage.setItem(LS, JSON.stringify(c)); } catch {} };
const wipe = () => { try { localStorage.removeItem(LS); } catch {} };

const ICON = {
  0: "☀️", 1: "🌤️", 2: "⛅", 3: "☁️",
  45: "🌫️", 48: "🌫️",
  51: "🌦️", 53: "🌦️", 55: "🌧️", 56: "🌧️", 57: "🌧️",
  61: "🌧️", 63: "🌧️", 65: "🌧️", 66: "🌧️", 67: "🌧️",
  71: "🌨️", 73: "🌨️", 75: "❄️", 77: "🌨️",
  80: "🌦️", 81: "🌧️", 82: "⛈️",
  85: "🌨️", 86: "❄️",
  95: "⛈️", 96: "⛈️", 99: "⛈️"
};

let slot;

export function initWeather(){
  slot = document.getElementById("weatherBtn");
  if (!slot) return;
  slot.addEventListener("click", openWeatherSettings);

  const c = cfg();
  if (c && c.lat != null){ paint(c); refresh(); }
  else { slot.innerHTML = `<span class="wx-ico">🌡️</span>`; tryGeolocate(); }

  setInterval(refresh, 30 * 60 * 1000);
}

function tryGeolocate(){
  if (!navigator.geolocation) return;
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const c = {
        lat: Number(pos.coords.latitude.toFixed(3)),
        lon: Number(pos.coords.longitude.toFixed(3)),
        name: "",
        unit: cfg()?.unit || "c"
      };
      save(c);
      refresh();
    },
    () => { /* denied — the 🌡️ icon stays; tap it to set a city */ },
    { timeout: 8000, maximumAge: 3600000 }
  );
}

async function refresh(){
  const c = cfg();
  if (!c || c.lat == null) return;
  const unit = c.unit === "f" ? "fahrenheit" : "celsius";
  try {
    const r = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${c.lat}&longitude=${c.lon}` +
      `&current=temperature_2m,weather_code&temperature_unit=${unit}`
    );
    const d = await r.json();
    if (!d.current) throw new Error("no data");
    c._temp = Math.round(d.current.temperature_2m);
    c._code = d.current.weather_code;
    c._at = Date.now();
    save(c);
    paint(c);
  } catch (e){
    console.warn("weather:", e.message);
  }
}

function paint(c){
  if (!slot) return;
  const ico = ICON[c._code] ?? "🌡️";
  const t = c._temp != null ? `${c._temp}°${(c.unit || "c").toUpperCase()}` : "";
  slot.innerHTML = `<span class="wx-ico">${ico}</span>${t ? `<span class="wx-t">${t}</span>` : ""}`;
  slot.title = c.name ? `Weather · ${c.name} (tap to change)` : "Tap to set weather location";
}

function openWeatherSettings(){
  const c = cfg() || {};
  openModal({
    title: t("wx.title"),
    submitLabel: t("wx.search"),
    deleteLabel: t("common.clear"),
    fields: [
      { name: "q", label: t("wx.city"), type: "text", required: true, value: c.name || "",
        placeholder: "Montréal" },
      { name: "unit", label: t("wx.units"), type: "select", value: c.unit || "c",
        options: [{ value: "c", label: t("wx.celsius") }, { value: "f", label: t("wx.fahrenheit") }] }
    ],
    onDelete: (c.lat != null) ? async () => {
      wipe();
      slot.innerHTML = `<span class="wx-ico">🌡️</span>`;
      slot.title = "";
      toast(t("wx.cleared"));
    } : null,
    onSubmit: async (d) => {
      const r = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(d.q)}&count=1&language=${getLang()}&format=json`
      );
      const j = await r.json();
      if (!j.results || !j.results.length) throw new Error(t("wx.not_found"));
      const g = j.results[0];
      const nc = {
        lat: Number(g.latitude.toFixed(3)),
        lon: Number(g.longitude.toFixed(3)),
        name: [g.name, g.admin1, g.country_code].filter(Boolean).join(", "),
        unit: d.unit
      };
      save(nc);
      await refresh();
      toast(t("wx.set", { city: g.name }));
    }
  });
}
