import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { crx } from "@crxjs/vite-plugin";
import manifest from "./manifest.json";

export default defineConfig({
  plugins: [
    react(),
    crx({ manifest }),
  ],
  build: {
    // crxjs manages all entry points via manifest.json — do NOT add rollupOptions.input
    chunkSizeWarningLimit: 1500,
  },
  resolve: {
    alias: {},
  },
  define: {
    global: "globalThis",
  },
});
