// Service worker: lets the dashboard install as an app and open offline.
// The page, its scripts and styles are fetched network-first, so a new Netlify deploy shows up the next
// time you open it (and the page and its scripts always come from the same deploy when online).
// Bump VERSION when the list below changes.
const VERSION = 'v5';
const CACHE = 'dashboard-' + VERSION;
const SHELL = [
  './',
  './index.html',
  './css/styles.css',
  './js/store.js',
  './js/core.js',
  './js/nutrition.js',
  './js/mealplan.js',
  './js/training.js',
  './js/journals.js',
  './js/overview.js',
  './js/finance.js',
  './js/peptides.js',
  './js/privacy.js',
  './js/app.js',
  './wallpaper.jpg',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon-32.png'
];

self.addEventListener('install', event => {
  // Cache each file on its own, so one missing file (e.g. an icon) doesn't stop the app working offline.
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => Promise.all(SHELL.map(url => cache.add(url).catch(err => console.warn('Not cached:', url, err)))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('dashboard-') && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Network first, falling back to the cached copy when offline.
function networkFirst(req, cacheKey) {
  return fetch(req)
    .then(res => {
      if (res.ok) {
        const copy = res.clone();
        caches.open(CACHE).then(cache => cache.put(cacheKey || req, copy));
      }
      return res;
    })
    .catch(() => caches.match(cacheKey || req).then(hit => hit || (cacheKey ? caches.match('./') : undefined)));
}

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // APIs (Anthropic, USDA, Google Apps Script, Open Food Facts) always go straight to the network.
  if (url.origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    event.respondWith(networkFirst(req, './index.html'));
    return;
  }
  if (url.search) return;

  // The app's code and styles: network first, so they always match the page.
  if (/\.(js|css)$/i.test(url.pathname)) {
    event.respondWith(networkFirst(req));
    return;
  }

  // Only the app's own static files (icons, wallpaper, manifest) are cached; anything else passes through.
  if (!/\.(png|jpe?g|webp|gif|svg|ico|webmanifest)$/i.test(url.pathname)) return;

  // Images, icons, manifest: cache first, refresh in the background.
  event.respondWith(
    caches.match(req).then(hit => {
      const network = fetch(req)
        .then(res => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then(cache => cache.put(req, copy));
          }
          return res;
        })
        .catch(() => hit);
      return hit || network;
    })
  );
});
