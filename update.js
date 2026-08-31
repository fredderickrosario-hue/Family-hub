/* ============================================================
   FAMILY HUB — app update controller
   A new service worker installs in the background and WAITS.
   We surface it (the nav bell / Settings) and only activate it
   when the user asks — then reload once it takes over.
   ============================================================ */
let reg = null;
let waiting = null;
let reloading = false;
const listeners = new Set();

export function onUpdateReady(fn){
  listeners.add(fn);
  if (waiting) fn();
}
function announce(){ listeners.forEach(f => { try { f(); } catch (e) { console.error(e); } }); }

export function isUpdateReady(){ return !!waiting; }

export function initUpdates(){
  if (!("serviceWorker" in navigator)) return;

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (reloading) return;
    reloading = true;
    location.reload();
  });

  navigator.serviceWorker.register("./service-worker.js").then((r) => {
    reg = r;

    if (r.waiting && navigator.serviceWorker.controller){
      waiting = r.waiting;
      announce();
    }

    r.addEventListener("updatefound", () => {
      const sw = r.installing;
      if (!sw) return;
      sw.addEventListener("statechange", () => {
        if (sw.state === "installed" && navigator.serviceWorker.controller){
          waiting = r.waiting || sw;
          announce();
        }
      });
    });

    // look for a new version periodically and whenever the app is refocused
    setInterval(() => r.update().catch(() => {}), 30 * 60 * 1000);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") r.update().catch(() => {});
    });
  }).catch(console.warn);
}

/** Apply a waiting update, or force a fresh check + reload. Returns
 *  true if an update was applied/pending, false if already current. */
export async function applyUpdate(){
  if (waiting){
    waiting.postMessage({ type: "SKIP_WAITING" });
    return true;                              // controllerchange -> reload
  }
  if (reg){
    try { await reg.update(); } catch {}
    if (reg.waiting){
      reg.waiting.postMessage({ type: "SKIP_WAITING" });
      return true;
    }
    return false;                            // nothing new
  }
  location.reload();
  return true;
}
