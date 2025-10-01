// server/services/fileStorage.ts
import { Client as ReplitStorageClient } from "@replit/object-storage";
import { Readable } from "stream";
import path from "path";
import fs from "fs/promises";
import fsSync from "fs";
import crypto from "crypto";
import type { Request, Response } from "express";

// ===== Types you already use =====
export interface StoredFile {
  id: string;               // use the storage key as id
  filename: string;         // basename (for display)
  originalName: string;
  mimeType: string;
  size: number;
  url: string;              // server route that serves this file
  uploadedAt: Date;
  userId: number;
}

type SaveOpts = {
  userId: number;
  buffer: Buffer;
  originalName: string;
  mimeType?: string;        // optional; we’ll default if missing
  kind?: "upload" | "result" | "thumb"; // for nicer key prefixes
};

// ===== Internal state =====
let storageClient: ReplitStorageClient | null = null;
let storageReady = false;

/** Detect if we’re running in a Replit Deployment with App Storage available */
function shouldUseAppStorage(): boolean {
  return Boolean(process.env.REPLIT_DEPLOYMENT_ID && process.env.REPL_SLUG);
}

/** Initialize once, non-blocking */
export async function initFileStorage(): Promise<void> {
  if (storageReady) return;
  try {
    if (shouldUseAppStorage()) {
      storageClient = new ReplitStorageClient();
      console.log("☁️  App Storage enabled (Replit Object Storage)");
    } else {
      console.log("📁 Using local file storage (App Storage not configured)");
    }
  } catch (err: any) {
    console.log("📁 Using local file storage (App Storage unavailable):", err?.message || err);
    storageClient = null;
  } finally {
    storageReady = true;
  }
}

/** Create a stable-ish key: users/{id}/{kind}/{yyyymm}/{hash}{ext} */
function makeKey(userId: number, originalName: string, kind: NonNullable<SaveOpts["kind"]> = "upload") {
  const ext = path.extname(originalName) || "";
  const yyyymm = new Date().toISOString().slice(0, 7).replace("-", "");
  const hash = crypto
    .createHash("sha256")
    .update(`${userId}:${Date.now()}:${originalName}:${crypto.randomUUID()}`)
    .digest("hex")
    .slice(0, 16);

  return `users/${userId}/${kind}/${yyyymm}/${hash}${ext}`;
}

/** Local uploads/ dir for dev */
const LOCAL_DIR = path.join(process.cwd(), "uploads");

/** Save a buffer and return metadata; does NOT write to DB (keep DB concerns outside) */
export async function saveFile({ userId, buffer, originalName, mimeType, kind = "upload" }: SaveOpts): Promise<StoredFile> {
  await initFileStorage();

  const key = makeKey(userId, originalName, kind);
  let url = `/api/files/${encodeURIComponent(key)}`;
  const detectedMime = mimeType || guessMime(originalName) || "application/octet-stream";

  if (storageClient) {
    const stream = Readable.from(buffer);
    await storageClient.uploadFromStream(key, stream, { compress: true });
    console.log(`💾 App Storage: ${originalName} -> ${key} (${(buffer.length / 1024 / 1024).toFixed(2)} MB)`);
  } else {
    await fs.mkdir(LOCAL_DIR, { recursive: true });
    const localPath = path.join(LOCAL_DIR, path.basename(key));
    await fs.writeFile(localPath, buffer);
    url = `/uploads/${encodeURIComponent(path.basename(key))}`; // direct static mount in dev
    console.log(`📁 Local FS: ${originalName} -> ${localPath}`);
  }

  const meta: StoredFile = {
    id: key,
    filename: path.basename(key),
    originalName,
    mimeType: detectedMime,
    size: buffer.length,
    url,
    uploadedAt: new Date(),
    userId,
  };

  return meta;
}

/** Stream a file by key to the response. You can plug this directly into an Express route. */
export async function streamFileByKey(key: string, res: Response, opts?: { cache?: boolean; downloadName?: string }) {
  await initFileStorage();

  // Basic caching headers (tweak as you wish)
  if (opts?.cache !== false) {
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
  } else {
    res.setHeader("Cache-Control", "no-store");
  }
  if (opts?.downloadName) {
    res.setHeader("Content-Disposition", `inline; filename*=UTF-8''${encodeRFC5987ValueChars(opts.downloadName)}`);
  }

  try {
    if (storageClient) {
      // Minimalistic stream pipe; some SDKs return a { body, contentType, size } object
      const obj = await (storageClient as any).get?.(key);
      if (obj?.contentType) res.setHeader("Content-Type", obj.contentType);
      if (obj?.size) res.setHeader("Content-Length", String(obj.size));

      // If SDK returns a stream directly:
      if (obj?.body && typeof obj.body.pipe === "function") {
        obj.body.pipe(res);
        return;
      }

      // Fallback to downloadToStream if available:
      if ((storageClient as any).downloadToStream) {
        const dlStream = await (storageClient as any).downloadToStream(key);
        dlStream.pipe(res);
        return;
      }

      // Last resort: read into memory (not ideal for big files)
      const buf = await (storageClient as any).download?.(key);
      if (Buffer.isBuffer(buf)) {
        res.end(buf);
        return;
      }

      throw new Error("Unsupported object-storage streaming method; check SDK methods");
    } else {
      const localPath = path.join(LOCAL_DIR, path.basename(key));
      if (!fsSync.existsSync(localPath)) {
        res.status(404).json({ error: "File not found" });
        return;
      }

      // Try to set a basic content-type from extension
      res.setHeader("Content-Type", guessMime(localPath) || "application/octet-stream");

      // (Optional) Range support for videos; simple implementation
      const stat = fsSync.statSync(localPath);
      const range = (res.req.headers.range as string | undefined);
      if (range) {
        const [startStr, endStr] = range.replace(/bytes=/, "").split("-");
        const start = parseInt(startStr, 10);
        const end = endStr ? parseInt(endStr, 10) : stat.size - 1;
        const chunkSize = end - start + 1;

        res.writeHead(206, {
          "Content-Range": `bytes ${start}-${end}/${stat.size}`,
          "Accept-Ranges": "bytes",
          "Content-Length": chunkSize,
          "Content-Type": res.getHeader("Content-Type") || "application/octet-stream",
        });

        fsSync.createReadStream(localPath, { start, end }).pipe(res);
      } else {
        res.setHeader("Content-Length", String(stat.size));
        fsSync.createReadStream(localPath).pipe(res);
      }
    }
  } catch (err) {
    console.error("streamFileByKey error:", err);
    if (!res.headersSent) res.status(404).json({ error: "File not found" });
  }
}

/** Delete by key (does not remove DB row; do that in your service layer) */
export async function deleteFileByKey(key: string): Promise<void> {
  await initFileStorage();
  if (storageClient) {
    await (storageClient as any).delete?.(key);
  } else {
    const localPath = path.join(LOCAL_DIR, path.basename(key));
    await fs.rm(localPath, { force: true });
  }
}

// ===== Helpers =====
function guessMime(name: string): string | undefined {
  const ext = path.extname(name).toLowerCase();
  // keep it tiny; expand if you like
  const MAP: Record<string, string> = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".mp4": "video/mp4",
    ".mov": "video/quicktime",
    ".mkv": "video/x-matroska",
  };
  return MAP[ext];
}

function encodeRFC5987ValueChars(str: string) {
  return encodeURIComponent(str)
    .replace(/['()]/g, escape)
    .replace(/\*/g, "%2A")
    .replace(/%(7C|60|5E)/g, "%25$1");
}