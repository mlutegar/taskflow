import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  base: "/taskflow/",
  server: {
    host: "0.0.0.0",
    port: 5175,
    strictPort: true,
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icon.svg"],
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
        icons: [
          { src: "icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any maskable" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,woff2}"],
        navigateFallback: "index.html",
      },
    }),
  ],
});
