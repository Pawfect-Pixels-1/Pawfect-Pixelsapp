// server/vite.ts
import express, { type Express } from "express";
import fs from "fs";
import path, { dirname } from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer, type ServerOptions } from "vite";
import { type Server } from "http";
import { nanoid } from "nanoid";
import viteConfig from "../vite.config";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export async function setupVite(app: Express, server: Server) {
  const isReplit = !!process.env.REPL_ID || !!process.env.REPLIT_DB_URL || !!process.env.REPL_SLUG;

  const serverOptions: ServerOptions = {
    middlewareMode: true,
    hmr: isReplit
      ? {
          server,              // let Vite attach upgrades to YOUR server
          protocol: "wss",     // browser is on https → must be wss
          clientPort: 443,     // Replit frontend is 443 only
          path: "/__vite_ws__",// custom path to dodge collisions
        }
      : { server },
  };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    server: serverOptions,
    appType: "custom",
  });

  // VERY IMPORTANT: mount Vite middlewares EARLY so it can handle WS upgrades
  app.use(vite.middlewares);

  // Dev SPA fallback (don’t swallow API and assets)
  app.use("*", async (req, res, next) => {
    if (
      req.originalUrl.startsWith("/api/") ||
      req.originalUrl.startsWith("/uploads/") ||
      req.originalUrl.startsWith("/assets/") ||
      /\.[a-z0-9]+$/i.test(req.originalUrl)
    ) return next();

    try {
      const clientIndex = path.resolve(__dirname, "..", "client", "index.html");
      let template = await fs.promises.readFile(clientIndex, "utf-8");
      template = template.replace(`src="/src/main.tsx"`, `src="/src/main.tsx?v=${nanoid()}"`);
      const html = await vite.transformIndexHtml(req.originalUrl, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(html);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}
