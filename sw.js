/* sw.js — minimal, reliable PWA cache for GitHub Pages at /Todo/ */

const CACHE_VERSION = 'v1';
const CACHE_NAME = `todo-${CACHE_VERSION}`;

/**
 * List the files you want available offline at first load.
 * Add any additional JS modules your app imports at startup.
 * Paths must include the /Todo/ base since the site is hosted under that subpath.
 */
const PRECACHE_URLS = [
  '/Todo/',                    // alias for index
  '/Todo/index.html',
  '/Todo/styles.css',
  '/Todo/main.js',
  '/Todo/manifest.webmanifest',
  // '/Todo/your-other-file.js',  // add more boot-critical files as needed
  // '/Todo/icons/icon-192.png',  // optional: icons, fonts, etc.
  // '/Todo/icons/icon-512.png',
  // '/Todo/icons/apple-touch-icon-180.png',
];

/** Convenience: clean up old caches on activate */
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
	const keys = await caches.keys();
	await Promise.all(keys.map((key) => {
	  if (key !== CACHE_NAME) {
		return caches.delete(key);
	  }
	}));
	// Control already-open pages without requiring a reload
	await self.clients.claim();
  })());
});

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
	const cache = await caches.open(CACHE_NAME);
	await cache.addAll(PRECACHE_URLS);
	// Activate new SW immediately (no "waiting" state)
	await self.skipWaiting();
  })());
});

/**
 * Strategy:
 * - HTML navigations: serve index.html from cache as an app-shell (works offline).
 * - Static assets: Cache-first with background refresh (stale-while-revalidate feel).
 * - Everything else: network-first, fallback to cache if available.
 */
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Only handle GET
  if (request.method !== 'GET') return;

  // Handle navigations (SPA) — serve the app shell
  const isNavigationRequest =
	request.mode === 'navigate' ||
	(request.headers.get('accept') || '').includes('text/html');

  if (isNavigationRequest) {
	event.respondWith((async () => {
	  const cache = await caches.open(CACHE_NAME);
	  // Try network first so you get fresh index when online
	  try {
		const fresh = await fetch(request);
		// Put a clone of the new index in cache (best-effort)
		cache.put('/Todo/index.html', fresh.clone());
		return fresh;
	  } catch {
		// Offline: fall back to cached index
		const cached = await cache.match('/Todo/index.html');
		return cached || new Response('Offline', { status: 503, statusText: 'Offline' });
	  }
	})());
	return;
  }

  // For same-origin static assets, use cache-first with background refresh
  const url = new URL(request.url);
  const isSameOrigin = url.origin === self.location.origin;

  if (isSameOrigin && url.pathname.startsWith('/Todo/')) {
	event.respondWith((async () => {
	  const cache = await caches.open(CACHE_NAME);
	  const cached = await cache.match(request, { ignoreSearch: true });
	  const networkPromise = fetch(request).then((response) => {
		// cache successful basic responses
		if (response && response.status === 200 && response.type === 'basic') {
		  cache.put(request, response.clone());
		}
		return response;
	  }).catch(() => cached);

	  // Return fast if cached, otherwise wait for network
	  return cached || networkPromise;
	})());
	return;
  }

  // Fallback: network-first
  event.respondWith((async () => {
	try {
	  return await fetch(request);
	} catch {
	  const cache = await caches.open(CACHE_NAME);
	  const cached = await cache.match(request, { ignoreSearch: true });
	  return cached || new Response('Offline', { status: 503, statusText: 'Offline' });
	}
  })());
});
