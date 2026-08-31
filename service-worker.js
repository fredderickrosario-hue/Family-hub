// Bump this on every deploy. A new version installs but WAITS —
// the app shows a bell and applies it only when the user taps.
const CACHE_NAME = "family-hub-v15";

const SHELL_FILES = [
  "./",
  "./index.html",
  "./styles.css",
  "./manifest.json",
  "./firebase-config.js",
  "./state.js",
  "./i18n.js",
  "./theme.js",
  "./ui.js",
  "./app.js",
  "./update.js",
  "./calendar.js",
  "./weather.js",
  "./ics.js",
  "./settings.js",
  "./chores.js",
  "./budget.js",
  "./meals.js",
  "./grocery.js",
  "./profiles.js",
  "./gcal.js",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      // {cache:"reload"} bypasses the HTTP cache so a version bump always
      // pulls genuinely fresh files (GitHub Pages sends max-age=600).
      cache.addAll(SHELL_FILES.map((u) => new Request(u, { cache: "reload" })))
    )
  );
  // NOTE: no skipWaiting() — the new worker waits for the user's OK.
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// The page posts this when the user taps the update bell.
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || event.request.method !== "GET") return;

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(event.request);
      const network = fetch(event.request, { cache: "no-cache" })
        .then((res) => {
          if (res && res.ok) cache.put(event.request, res.clone());
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
