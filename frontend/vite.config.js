import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

// Versão do app = versão do package.json + hash curto do commit (quando disponível).
// Usado para diagnosticar "estou vendo build antigo?" em segundos.
const pkgVersion = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf-8")).version;
// Preferência: env APP_COMMIT (injetada no build Docker, onde não há .git no contexto);
// senão tenta o git local; senão "nogit".
let gitCommit = process.env.APP_COMMIT || "";
if (!gitCommit) {
  try {
    gitCommit = execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  } catch {
    gitCommit = "nogit";
  }
}
const appVersion = `${pkgVersion}+${gitCommit}`;

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.js'],
  },
  base: "/taskflow/",
  define: {
    __BUILD_DATE__: JSON.stringify(new Date().toISOString()),
    __APP_VERSION__: JSON.stringify(appVersion),
  },
  server: {
    host: "0.0.0.0",
    port: 5175,
    strictPort: true,
    proxy: {
      "/api": {
        target: process.env.API_PROXY_TARGET || `http://localhost:${process.env.API_PORT || 3001}`,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
  resolve: {
    // Garante uma única cópia (recharts v3 importa `react-is`).
    dedupe: ["react", "react-dom", "react-is"],
  },
  build: {
    sourcemap: true, // erros minificados (ex.: React #310) apontam o arquivo/linha real
    rollupOptions: {
      output: {
        manualChunks: {
          "vendor-react":    ["react", "react-dom"],
          "vendor-recharts": ["recharts", "react-is"],
        },
      },
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "prompt",
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.ts",
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
      injectManifest: {
        globPatterns: ["**/*.{js,css,html,svg,woff2}"],
      },
    }),
  ],
});
