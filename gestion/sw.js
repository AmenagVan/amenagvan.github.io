/* Service worker : l'appli fonctionne même sans réseau (atelier, garage…).
   Stratégie « réseau d'abord » : en ligne on a toujours la dernière version,
   hors ligne on reprend la copie gardée en cache. */
const CACHE = "gestion-av-v3";
const FICHIERS = [
  "./",
  "./index.html",
  "./app.css",
  "./app.js",
  "./script-google.js",
  "./manifest.webmanifest",
  "./icone-192.png",
  "./icone-512.png",
  "./icone-180.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FICHIERS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((cles) => Promise.all(cles.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    fetch(req)
      .then((rep) => {
        if (rep.ok) {
          const copie = rep.clone();
          caches.open(CACHE).then((c) => c.put(req, copie));
        }
        return rep;
      })
      .catch(() => caches.match(req, { ignoreSearch: true }))
  );
});
