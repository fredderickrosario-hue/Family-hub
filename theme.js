/* ============================================================
   FAMILY HUB — theme (light / dark / system)
   Sets data-theme on <html>; a tiny inline script in index.html
   applies it before first paint to avoid a flash.
   ============================================================ */
const LS = "familyhub.theme";
const MQ = window.matchMedia("(prefers-color-scheme: dark)");

export function getTheme(){
  try { return localStorage.getItem(LS) || "system"; } catch { return "system"; }
}

export function applyTheme(mode){
  const m = mode || getTheme();
  const root = document.documentElement;
  if (m === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", m);

  const dark = m === "dark" || (m === "system" && MQ.matches);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", dark ? "#15171B" : "#FAFAF9");
}

export function setTheme(mode){
  try { localStorage.setItem(LS, mode); } catch {}
  applyTheme(mode);
}

export function initTheme(){
  applyTheme();
  MQ.addEventListener("change", () => { if (getTheme() === "system") applyTheme(); });
}
