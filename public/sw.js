// Cabinet Juridique - Service Worker V4 (EXT-02, EXT-03)
// Strictly sovereign, zero external tracking, network-first for data integrity

const CACHE_NAME = "cabinet-static-v1";
const STATIC_ASSETS = [
  "/icons/icon-192.svg",
  "/icons/icon-512.svg",
  "/icons/icon-maskable.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Network-first strategy for dynamic legal matters, fallback to static cache
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Ignore non-GET and chrome-extension requests
  if (event.request.method !== "GET" || !url.protocol.startsWith("http")) {
    return;
  }

  // Never cache sensitive API routes or auth endpoints directly in HTTP cache
  if (url.pathname.startsWith("/api/auth") || url.pathname.startsWith("/api/health")) {
    return;
  }

  // Static assets: Stale-While-Revalidate
  if (
    url.pathname.startsWith("/icons/") ||
    url.pathname.startsWith("/fonts/") ||
    url.pathname.includes("_next/static")
  ) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        const fetchPromise = fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseToCache));
          }
          return networkResponse;
        }).catch(() => cachedResponse);

        return cachedResponse || fetchPromise;
      })
    );
    return;
  }

  // Application pages: Network-first with network error handling
  event.respondWith(
    fetch(event.request).catch(async () => {
      const cached = await caches.match(event.request);
      if (cached) return cached;
      return new Response(
        "<html><body style='font-family:sans-serif;padding:2rem;text-align:center;'><h2>Mode Hors-Ligne</h2><p>Le serveur du cabinet est inaccessible. Vos données locales sécurisées restent consultables dans la section Mobile / Offline.</p></body></html>",
        { headers: { "Content-Type": "text/html; charset=utf-8" } }
      );
    })
  );
});

// Handle remote wipe / device revocation message
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "REMOTE_WIPE") {
    // Clear all caches
    caches.keys().then((keys) => {
      return Promise.all(keys.map((k) => caches.delete(k)));
    });
  }
});
