import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const apiHost = "sako.knnect.lk:8000";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": { target: `http://${apiHost}`, changeOrigin: true },
      "/ws": { target: `ws://${apiHost}`, ws: true, changeOrigin: true },
    },
  },
});
