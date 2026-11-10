// Service worker for offline support
const CACHE_NAME = "wishporter-v7";
const BASE = self.location.pathname.replace(/\/[^/]*$/, "/");

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  // Don't cache cross-origin requests (Paimon.moe data)
  if (url.origin !== self.location.origin) return;

  const isCode = url.pathname.endsWith(".js") || url.pathname.endsWith(".css") ||
    url.pathname.endsWith(".html") || url.pathname === BASE || url.pathname === BASE + "index.html";

  if (isCode) {
    // Network-first for code files: always try network, fall back to cache
    event.respondWith(
      fetch(event.request).then((response) => {
        if (response.ok && response.type === "basic") {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => caches.match(event.request))
    );
  } else {
    // Cache-first for assets (images, etc.)
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((response) => {
          if (response.ok && response.type === "basic") {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        });
      })
    );
  }
});
