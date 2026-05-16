import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";
import path from "node:path";

export default defineConfig({
  plugins: [
    TanStackRouterVite({ target: "react", autoCodeSplitting: true }),
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      "~": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    outDir: path.resolve(__dirname, "../web"),
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:8080",
      "/s": "http://localhost:8080",
      "/docs": "http://localhost:8080",
    },
  },
});
