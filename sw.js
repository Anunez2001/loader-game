const VERSION = "f217e4db63a4";
const PRECACHE = ["./","index.html","manifest.webmanifest","icon.svg","icon-180.png","icon-192.png","icon-512.png","icon-maskable-512.png","assets/index-BHCyMdli.js","assets/bot-i-SXeAuA.js","assets/tutorial-J8LlS3AN.js","assets/index-CuOy2VBT.css"];
// Service worker: makes the game work offline once it has been opened.
// VERSION and PRECACHE are filled in at build time (see vite.config.ts); a new deploy gets a
// new VERSION, so the browser installs the new worker and drops the old cache.
/* global self, caches, fetch, Response, URL */
const CACHE = `loader-${VERSION}`;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('loader-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Servers often send "Vary: Origin" (or Accept-Encoding), and the game's module scripts are
// requested with an Origin header the install step didn't send, so matching must ignore Vary.
const MATCH = { ignoreVary: true };

/** Resolves with the network response, or rejects after `ms` (a slow connection counts as offline). */
function networkWithin(request, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms);
    fetch(request).then(
      (res) => (clearTimeout(timer), resolve(res)),
      (err) => (clearTimeout(timer), reject(err)),
    );
  });
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    // The page: try the network first so updates arrive, fall back to the cached copy offline.
    event.respondWith(
      networkWithin(request, 3000)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put('./', copy));
          return res;
        })
        .catch(() => caches.match('./', MATCH).then((hit) => hit || caches.match('index.html', MATCH)).then((hit) => hit || Response.error())),
    );
    return;
  }

  // Everything else (scripts, styles, icons) has a unique name per build: cache first.
  event.respondWith(
    caches.match(request, MATCH).then(
      (hit) =>
        hit ||
        fetch(request).then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return res;
        }),
    ),
  );
});
