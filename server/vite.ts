import express, { type Express } from "express";
import fs from "fs";
import path, { dirname } from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer, createLogger, type ServerOptions } from "vite";
import { type Server } from "http";
import { nanoid } from "nanoid";
import viteConfig from "../vite.config";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const viteLogger = createLogger();

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}

export async function setupVite(app: Express, server: Server) {
  // Detect Replit env heuristically
  const isReplit = !!process.env.REPL_ID || !!process.env.REPLIT_DB_URL || !!process.env.REPL_SLUG;

  const serverOptions: ServerOptions = {
    middlewareMode: true,
    hmr: isReplit
      ? {
          server,          // reuse the existing HTTP server
          protocol: "wss", // Replit proxies WS over TLS
          clientPort: 443, // browsers can only reach 443 externally
          // host: process.env.PUBLIC_HOST, // uncomment if you want to force host
        }
      : { server },
    allowedHosts: true,
  };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: true,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      },
    },
    server: serverOptions,
    appType: "custom",
  });

  // Vite middlewares (transforms, HMR client, /@id/, etc.)
  app.use(vite.middlewares);

  // SPA fallback — but DO NOT swallow API routes
  app.use("*", async (req, res, next) => {
    if (req.originalUrl.startsWith("/api/")) return next();

    const url = req.originalUrl;
    try {
      const clientTemplate = path.resolve(__dirname, "..", "client", "index.html");

      // Always reload index.html from disk in dev
      let template = await fs.promises.readFile(clientTemplate, "utf-8");

      // Cache-bust the client entry
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );

      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

export function serveStatic(app: Express) {
  const distPath = path.resolve(__dirname, "public");

  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }

  app.use(express.static(distPath));

  // fall through to index.html if the file doesn't exist
  app.use("*", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
