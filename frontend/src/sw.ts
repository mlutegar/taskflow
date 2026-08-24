/// <reference lib="webworker" />
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { registerRoute, NavigationRoute } from 'workbox-routing';
import { CacheFirst, NetworkFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';

declare const self: ServiceWorkerGlobalScope;

cleanupOutdatedCaches();

// Precache all build assets (manifest injected by vite-plugin-pwa)
precacheAndRoute(self.__WB_MANIFEST);

// SPA navigation fallback
registerRoute(
  new NavigationRoute(
    async () => {
      const cache = await caches.open('taskflow-html');
      const response = await cache.match('/taskflow/index.html');
      return response ?? fetch('/taskflow/index.html');
    },
    { denylist: [/^\/api\//] }
  )
);

// ── Static assets (JS, CSS, fonts) → CacheFirst ──────────────────────────────
registerRoute(
  ({ request }) =>
    request.destination === 'script' ||
    request.destination === 'style' ||
    request.destination === 'font',
  new CacheFirst({
    cacheName: 'taskflow-assets',
    plugins: [
      new ExpirationPlugin({ maxEntries: 60, maxAgeSeconds: 30 * 24 * 60 * 60 }),
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
  })
);

// ── API routes → NetworkFirst ─────────────────────────────────────────────────
registerRoute(
  ({ url }) => url.pathname.startsWith('/api/') || url.href.includes('/api/'),
  new NetworkFirst({
    cacheName: 'taskflow-api-cache',
    networkTimeoutSeconds: 5,
    plugins: [
      new ExpirationPlugin({ maxEntries: 150, maxAgeSeconds: 24 * 60 * 60 }),
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
  })
);
