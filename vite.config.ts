import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path, { dirname } from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
import { fileURLToPath } from "url";
import glsl from "vite-plugin-glsl";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
  plugins: [
    react(),
    runtimeErrorOverlay(),
    glsl(), // Add GLSL shader support
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "client", "src"),
      "@shared": path.resolve(__dirname, "shared"),
    },
  },
  root: path.resolve(__dirname, "client"),
  build: {
    outDir: path.resolve(__dirname, "dist/public"),
    emptyOutDir: true,
  },
  // Add support for large models and audio files
  assetsInclude: ["**/*.gltf", "**/*.glb", "**/*.mp3", "**/*.ogg", "**/*.wav"],

  // 🔧 Replit-only dev server & HMR fixes
  server: {
    host: true,                                // listen on 0.0.0.0 so the Replit proxy can reach Vite
    port: Number(process.env.PORT) || 5173,    // use Replit's assigned PORT if present
    strictPort: true,                          // don't hop ports (would break the proxy)
    hmr: {
      protocol: "wss",                         // your page is HTTPS → use secure websockets
      clientPort: 443,                         // Replit exposes only 443 to browsers
      // host: undefined                       // leave unset → Vite uses window.location.host (your spock URL)
    },
  },
});
