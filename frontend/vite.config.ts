import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

const apiHost = process.env.VITE_API_HOST || "sako.home.knnect.lk:8000";

export default defineConfig({
  plugins: [react(), VitePWA({
    registerType: "prompt",
    injectRegister: false,
    devOptions: { enabled: false },
    includeManifestIcons: false, // All icon variants are already included by globPatterns.
    manifest: {
      id: "/",
      name: "Sako Energy",
      short_name: "Sako Energy",
      description: "Local solar inverter monitoring and control",
      start_url: "/overview",
      scope: "/",
      display: "standalone",
      theme_color: "#101b22",
      background_color: "#101b22",
      icons: [
        { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
        { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
        { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      ],
    },
    workbox: {
      globPatterns: ["**/*.{js,css,html,png,svg,ico}"],
      navigateFallback: "/index.html",
      navigateFallbackDenylist: [/^\/api(?:[/?]|$)/, /^\/ws(?:[/?]|$)/],
      runtimeCaching: [],
      cleanupOutdatedCaches: true,
      clientsClaim: true,
      skipWaiting: false,
    },
  })],
  server: {
    proxy: {
      "/api": { target: `http://${apiHost}`, changeOrigin: true },
      "/ws": { target: `ws://${apiHost}`, ws: true, changeOrigin: true },
    },
  },
});
