import { Request, Response } from "express";
import Replicate from "replicate";
import { storage, fileStorage } from "../storage";
import fetch from "node-fetch";

if (!process.env.REPLICATE_API_TOKEN) {
  console.error("❌ REPLICATE_API_TOKEN is required but not set in environment");
  process.exit(1);
}

const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });

// Tracks operation status/results across requests
const operationStore = new Map<string, any>();

/** --- Pin a known version for reproducibility (update as needed) --- */
// Example version hash from the model’s API page:
const KONText_VERSION =
  "ed345b52dc59cd85bfbc3ef5dded68a06513bb33be3a359e773e345f55679c3b"; // face-to-many-kontext@version
// You can also switch to replicate.run("flux-kontext-apps/face-to-many-kontext@<ver>", { input })
// instead of predictions.create({ version, input }) if you prefer blocking behavior. :contentReference[oaicite:2]{index=2}

/**
 * Transform an image using Replicate (Kontext)
 * Returns: { success, outputs: string[], transformedImage: string, operationId }
 */
export async function transformImageHandler(req: Request, res: Response) {
  try {
    const { image, style, options } = req.body as {
      image: string; // data URL or http(s) URL
      style?: string; // kept for UI telemetry
      options?: {
        seed?: number | null;
        style?: string;
        persona?: string;
        num_images?: number;
        input_image?: string; // if the client explicitly passes it, prefer over image
        aspect_ratio?: string;
        output_format?: "png" | "jpg";
        preserve_outfit?: boolean;
        safety_tolerance?: 0 | 1 | 2;
        preserve_background?: boolean;
      };
    };

    // Build input_image from either explicit options or the `image` field
    const input_image = options?.input_image ?? image;
    if (!input_image) {
      return res.status(400).json({ success: false, error: "No input_image provided" });
    }

    // Compose input per schema; apply safe defaults (matching your example)
    const input = {
      input_image, // URI: data: or http(s)
      style: options?.style ?? "Random",
      persona: options?.persona ?? "None",
      num_images: clampInt(options?.num_images ?? 1, 1, 10),
      aspect_ratio: options?.aspect_ratio ?? "match_input_image",
      output_format: (options?.output_format as "png" | "jpg") ?? "png",
      preserve_outfit: Boolean(options?.preserve_outfit ?? false),
      preserve_background: Boolean(options?.preserve_background ?? false),
      safety_tolerance:
        options?.safety_tolerance === 0 || options?.safety_tolerance === 1 || options?.safety_tolerance === 2
          ? options.safety_tolerance
          : 2,
      seed: typeof options?.seed === "number" ? options?.seed : undefined,
    };

    console.log("🎨 Kontext input:", { style, input });

    // Kick off prediction (Kontext returns an array of URLs)
    const prediction = await replicate.predictions.create({
      version: KONText_VERSION,
      input,
    });

    operationStore.set(prediction.id, {
      id: prediction.id,
      type: "transform",
      status: "processing",
      createdAt: new Date(),
      input,
      userId: req.user?.id, // Store user ID for later use
    });

    // Poll until done (max ~2 min)
    let finalPrediction = prediction;
    const start = Date.now();
    const timeoutMs = 120_000;

    while (finalPrediction.status === "starting" || finalPrediction.status === "processing") {
      if (Date.now() - start > timeoutMs) {
        return res.status(408).json({
          success: false,
          error: "Request timed out. Please try again.",
          operationId: prediction.id,
        });
      }
      await sleep(2000);
      finalPrediction = await replicate.predictions.get(prediction.id);
      console.log("📊 Prediction status:", finalPrediction.status);
    }

    if (finalPrediction.status !== "succeeded") {
      const error = (finalPrediction as any).error || "Transformation failed";
      console.error("❌ Transformation failed:", error);
      // Preserve existing operation data while updating status
      const existingOperation = operationStore.get(prediction.id);
      operationStore.set(prediction.id, {
        ...existingOperation,
        status: "failed",
        error,
        failedAt: new Date(),
      });
      return res.status(500).json({ success: false, error, operationId: prediction.id });
    }

    // Expect array<string> per schema (URIs). :contentReference[oaicite:3]{index=3}
    const replicateUrls: string[] = Array.isArray(finalPrediction.output)
      ? (finalPrediction.output as string[])
      : [String(finalPrediction.output)];

    // Download & store all outputs locally (prefer durable links)
    const localUrls: string[] = [];
    for (let i = 0; i < replicateUrls.length; i++) {
      const url = replicateUrls[i];
      try {
        const resp = await fetch(url);
        const buf = Buffer.from(await resp.arrayBuffer());
        const stored = await fileStorage.saveFile(
          buf,
          `transformed_${prediction.id}_${i}.${input.output_format === "jpg" ? "jpg" : "png"}`,
          input.output_format === "jpg" ? "image/jpeg" : "image/png",
          req.user?.id  // Pass user ID if authenticated
        );
        const local = `${req.protocol}://${req.get("host")}${stored.url}`;
        localUrls.push(local);
      } catch (e) {
        console.warn("⚠️ Could not persist output, falling back to remote URL:", url, e);
        localUrls.push(url);
      }
    }

    // Preserve existing operation data while updating status
    const existingOperation = operationStore.get(prediction.id);
    operationStore.set(prediction.id, {
      ...existingOperation,
      status: "completed",
      result: localUrls,
      completedAt: new Date(),
    });

    // Save transformation record to database if user is authenticated
    if (req.user && localUrls.length > 0) {
      try {
        // Save original input file to storage first if it's a data URL
        let originalFileUrl = input.input_image;
        let originalFileName = `original_${prediction.id}.png`;
        
        if (input.input_image.startsWith('data:')) {
          const base64Data = input.input_image.split(',')[1];
          const buffer = Buffer.from(base64Data, 'base64');
          const originalFile = await fileStorage.saveFile(
            buffer,
            originalFileName,
            'image/png',
            req.user.id
          );
          originalFileUrl = `${req.protocol}://${req.get("host")}${originalFile.url}`;
        }
        
        await storage.createTransformation({
          userId: req.user.id,
          type: 'image', // Must match schema enum
          status: 'completed', // Must match schema enum
          originalFileName,
          originalFileUrl,
          transformationOptions: JSON.stringify({
            style: input.style,
            persona: input.persona,
            num_images: input.num_images,
            aspect_ratio: input.aspect_ratio,
            output_format: input.output_format,
            preserve_outfit: input.preserve_outfit,
            preserve_background: input.preserve_background,
            safety_tolerance: input.safety_tolerance
          }),
          resultFileUrls: localUrls, // Array as expected by schema
        });
        console.log(`💾 Transformation saved for user: ${req.user.username}`);
      } catch (error) {
        console.error('Error saving transformation to database:', error);
        // Don't fail the whole operation if database save fails
      }
    }

    return res.json({
      success: true,
      outputs: localUrls,               // new (array)
      transformedImage: localUrls[0],   // backward compat
      operationId: prediction.id,
    });
  } catch (error) {
    console.error("❌ Error in transform handler:", error);
    return res.status(500).json({ success: false, error: "Internal server error during transformation" });
  }
}

/** Generate a video using video-capable model */
export async function generateVideoHandler(req: Request, res: Response) {
  try {
    const { image, style, options } = req.body as {
      image: string; // data URL or http(s) URL
      style?: string;
      options?: {
        duration?: number;
        fps?: number;
      };
    };

    if (!image) {
      return res.status(400).json({ success: false, error: "No input image provided" });
    }

    console.log("🎬 Video generation request:", { style, options });

    // For now, return a placeholder implementation since we don't have a specific video model
    // In a real implementation, you would:
    // 1. Call a video generation model like RunwayML or similar
    // 2. Follow the same async pattern as transformImageHandler
    // 3. Store the operation in operationStore with proper userId
    
    // Create a placeholder operation
    const operationId = `video_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    operationStore.set(operationId, {
      id: operationId,
      type: "video",
      status: "processing",
      createdAt: new Date(),
      input: { image, style, options },
      userId: req.user?.id,
    });

    // Simulate processing time and then mark as failed for now
    setTimeout(() => {
      const existingOperation = operationStore.get(operationId);
      operationStore.set(operationId, {
        ...existingOperation,
        status: "failed",
        error: "Video generation not yet implemented - placeholder functionality only",
        failedAt: new Date(),
      });
    }, 2000);

    return res.json({
      success: true,
      operationId,
      message: "Video generation started (placeholder implementation)"
    });

  } catch (error) {
    console.error("❌ Error in video generation handler:", error);
    return res.status(500).json({ success: false, error: "Internal server error during video generation" });
  }
}

/** Status endpoint returns arrays when available */
export async function getStatusHandler(req: Request, res: Response) {
  try {
    const { operationId } = req.params;
    const operation = operationStore.get(operationId);
    if (!operation) {
      return res.status(404).json({ success: false, error: "Operation not found" });
    }

    // Verify operation ownership - only the user who created the operation can check its status
    if (!operation.userId || !req.user || operation.userId !== req.user.id) {
      return res.status(404).json({ success: false, error: "Operation not found" });
    }

    if (operation.status === "processing") {
      try {
        const prediction = await replicate.predictions.get(operationId);
        if (prediction.status === "succeeded") {
          const outs: string[] = Array.isArray(prediction.output)
            ? (prediction.output as string[])
            : [String(prediction.output)];

          const stored: string[] = [];
          for (let i = 0; i < outs.length; i++) {
            try {
              const resp = await fetch(outs[i]);
              const buf = Buffer.from(await resp.arrayBuffer());
              const isVideo = operation.type === "video";
              const ext = isVideo ? ".mp4" : ".png"; // default if unknown
              const mime = isVideo ? "video/mp4" : "image/png";
              const file = await fileStorage.saveFile(buf, `${operation.type}_${operationId}_${i}${ext}`, mime, operation.userId);
              stored.push(`${req.protocol}://${req.get("host")}${file.url}`);
            } catch {
              stored.push(outs[i]);
            }
          }

          operation.status = "completed";
          operation.result = stored;
          operation.completedAt = new Date();
          operationStore.set(operationId, operation);
        } else if (prediction.status === "failed") {
          operation.status = "failed";
          operation.error = (prediction as any).error || "Operation failed";
          operation.failedAt = new Date();
          operationStore.set(operationId, operation);
        }
      } catch (e) {
        console.error("Error checking prediction status:", e);
      }
    }

    return res.json({ success: true, operation });
  } catch (error) {
    console.error("❌ Error in status handler:", error);
    return res.status(500).json({ success: false, error: "Internal server error" });
  }
}

function clampInt(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.floor(n)));
}
function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
