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
    rollupOptions: {
      input: {
        popup: "src/popup/index.html",
      },
    },
    // Keep bundles reasonable for extension
    chunkSizeWarningLimit: 1500,
  },
  // viem uses Node builtins — polyfill for browser
  resolve: {
    alias: {
      // Prevent Node-only imports from breaking the browser build
    },
  },
  define: {
    global: "globalThis",
  },
});
