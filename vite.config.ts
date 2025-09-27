// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path, { dirname } from "path";
import { fileURLToPath } from "url";
// TEMP: Disable this while debugging HMR (it can hook early and mask errors)
// import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
import glsl from "vite-plugin-glsl";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const isReplit =
  !!process.env.REPL_ID || !!process.env.REPLIT_DB_URL || !!process.env.REPL_SLUG;

export default defineConfig({
  root: path.resolve(__dirname, "client"),
  plugins: [
    react(),
    // runtimeErrorOverlay(),
    glsl(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "client", "src"),
      "@shared": path.resolve(__dirname, "shared"),
    },
  },
  server: isReplit
    ? {
        host: true,
        port: 5173,
        strictPort: true,
        hmr: {
          protocol: "wss",
          clientPort: 443,
          path: "/__vite_ws__", // MUST match vite.ts
          // leave `host` undefined → uses window.location.hostname
        },
      }
    : {
        host: true,
        port: 5173,
        strictPort: true,
      },
  preview: {
    host: true,
    port: 5173,
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
  assetsInclude: ["**/*.gltf", "**/*.glb", "**/*.mp3", "**/*.ogg", "**/*.wav"],
});
