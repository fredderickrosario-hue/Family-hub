// Bump this on every deploy so devices pick up the new shell.
const CACHE_NAME = "family-hub-v6";

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
  "./calendar.js",
  "./weather.js",
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
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_FILES))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Only manage our own origin. Firestore / Google traffic must stay live.
  if (url.origin !== self.location.origin || event.request.method !== "GET") return;

  // Stale-while-revalidate: serve cache immediately, refresh in the background.
  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(event.request);
      const network = fetch(event.request)
        .then((res) => {
          if (res && res.ok) cache.put(event.request, res.clone());
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
