import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.js'],
  },
  base: "/taskflow/",
  define: {
    __BUILD_DATE__: JSON.stringify(new Date().toISOString()),
  },
  server: {
    host: "0.0.0.0",
    port: 5175,
    strictPort: true,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          "vendor-react":    ["react", "react-dom"],
          "vendor-recharts": ["recharts"],
        },
      },
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icon.svg", "icon-192.png", "icon-512.png"],
      manifest: {
        name: "TaskFlow",
        short_name: "TaskFlow",
        description: "Gerenciador de tarefas com modos de execução gamificados",
        lang: "pt-BR",
        theme_color: "#0f0f13",
        background_color: "#0f0f13",
        display: "standalone",
        scope: "/taskflow/",
        start_url: "/taskflow/",
        categories: ["productivity", "utilities"],
        icons: [
          { src: "icon.svg",     sizes: "any", type: "image/svg+xml" },
          { src: "icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,woff2}"],
        navigateFallback: "index.html",
        runtimeCaching: [
          // ── Assets estáticos com hash (JS, CSS, fontes) → CacheFirst ──────
          {
            urlPattern: /\.(?:js|css|woff2?)(\?.*)?$/,
            handler: "CacheFirst",
            options: {
              cacheName: "taskflow-assets",
              expiration: {
                maxEntries: 60,
                maxAgeSeconds: 30 * 24 * 60 * 60, // 30 dias
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // ── Rotas de API (NetworkFirst: tenta rede, cai no cache) ─────────
          {
            urlPattern: ({ url }) =>
              url.pathname.startsWith("/api/") ||
              url.href.includes("/api/"),
            handler: "NetworkFirst",
            options: {
              cacheName: "taskflow-api-cache",
              networkTimeoutSeconds: 5,
              expiration: {
                maxEntries: 150,
                maxAgeSeconds: 24 * 60 * 60, // 24h
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
});
