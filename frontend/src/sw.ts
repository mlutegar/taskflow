/// <reference lib="webworker" />
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { registerRoute, NavigationRoute } from 'workbox-routing';
import { CacheFirst, NetworkOnly } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import { clientsClaim } from 'workbox-core';

declare const self: ServiceWorkerGlobalScope;

// Atualização controlada (registerType: "prompt"): o novo SW aguarda em "waiting"
// até o usuário clicar em "Atualizar" no banner (UpdatePrompt), que envia esta
// mensagem. Assim evitamos recarregar a página no meio de uma sessão sem aviso.
self.addEventListener("message", (event) => {
  if ((event as ExtendableMessageEvent).data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
clientsClaim();

cleanupOutdatedCaches();

// Remove o cache privado criado por versões antigas (NetworkFirst). A rota
// atual é NetworkOnly, mas apagar os dados antigos também evita que informações
// autenticadas permaneçam no dispositivo depois de trocar de conta.
self.addEventListener("activate", (event) => {
  event.waitUntil(caches.delete("taskflow-api-cache"));
});

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

// ── API routes → NetworkOnly ──────────────────────────────────────────────────
// Dados de /api/ são por usuário e mudam a cada ação. Cachear (NetworkFirst)
// podia devolver uma lista antiga após lentidão de rede e, pior, compartilhar
// dados entre usuários no mesmo navegador. O cache da UI já é feito pelo
// React Query em memória; o SW nunca deve persistir respostas autenticadas.
registerRoute(
  ({ url }) => url.pathname.startsWith('/api/') || url.href.includes('/api/'),
  new NetworkOnly()
);
