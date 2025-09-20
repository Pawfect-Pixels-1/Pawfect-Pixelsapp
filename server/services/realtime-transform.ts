import { Request, Response } from "express";
import Replicate from "replicate";
import { storage, fileStorage } from "../storage";
import fetch from "node-fetch";
import RealtimeService from "../websocket";

if (!process.env.REPLICATE_API_TOKEN) {
  console.error("❌ REPLICATE_API_TOKEN is required but not set in environment");
  process.exit(1);
}

const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });

// Real-time service instance (will be injected)
let realtimeService: RealtimeService;

export function setRealtimeService(service: RealtimeService) {
  realtimeService = service;
}

/** --- Pin a known version for reproducibility (update as needed) --- */
const KONText_VERSION =
  "ed345b52dc59cd85bfbc3ef5dded68a06513bb33be3a359e773e345f55679c3b";

/**
 * Transform an image using Replicate with real-time preview updates
 * Returns immediately with operation ID, sends progress via WebSocket
 */
export async function realtimeTransformImageHandler(req: Request, res: Response) {
  try {
    const { image, style, options } = req.body as {
      image: string; // data URL or http(s) URL
      style?: string; // kept for UI telemetry
      options?: {
        seed?: number | null;
        style?: string;
        persona?: string;
        num_images?: number;
        input_image?: string;
        aspect_ratio?: string;
        output_format?: "png" | "jpg";
        preserve_outfit?: boolean;
        safety_tolerance?: 0 | 1 | 2;
        preserve_background?: boolean;
      };
    };

    // Ensure user is authenticated (should be guaranteed by requireAuth middleware)
    if (!req.user?.id) {
      return res.status(401).json({ success: false, error: "Authentication required" });
    }
    const userId = req.user.id;

    // Build input_image from either explicit options or the `image` field
    const input_image = options?.input_image ?? image;
    if (!input_image) {
      return res.status(400).json({ success: false, error: "No input_image provided" });
    }

    // Compose input per schema
    const input = {
      input_image,
      style: options?.style ?? "Random",
      persona: options?.persona ?? "None",
      num_images: clampInt(options?.num_images ?? 1, 1, 10),
      aspect_ratio: options?.aspect_ratio ?? "match_input_image",
      output_format: (options?.output_format === 'png' || options?.output_format === 'jpg') 
        ? options.output_format 
        : 'png',
      preserve_outfit: Boolean(options?.preserve_outfit ?? false),
      preserve_background: Boolean(options?.preserve_background ?? false),
      safety_tolerance:
        options?.safety_tolerance === 0 || options?.safety_tolerance === 1 || options?.safety_tolerance === 2
          ? options.safety_tolerance
          : 2,
      seed: typeof options?.seed === "number" ? options?.seed : undefined,
    };

    console.log("🎨 Real-time Kontext input:", { style, input });

    // Create prediction
    const prediction = await replicate.predictions.create({
      version: KONText_VERSION,
      input,
    });

    const operationId = prediction.id;

    // Store operation in real-time service
    realtimeService.setOperation(operationId, {
      id: operationId,
      type: "transform",
      status: "processing",
      progress: 0,
      createdAt: new Date(),
      input,
      userId,
    });

    // Send initial status
    realtimeService.updateStatus(operationId, userId, "starting", {
      message: "Transformation started",
      input: {
        style: input.style,
        persona: input.persona,
        num_images: input.num_images,
      }
    });

    // Start async processing
    processTransformationAsync(operationId, userId, req);

    // Return immediately with operation ID
    return res.json({
      success: true,
      operationId,
      message: "Transformation started. Connect to WebSocket for real-time updates."
    });

  } catch (error) {
    console.error("❌ Error in real-time transform handler:", error);
    return res.status(500).json({ success: false, error: "Internal server error during transformation" });
  }
}

/**
 * Process transformation asynchronously with real-time updates
 */
async function processTransformationAsync(operationId: string, userId: number, req: Request) {
  try {
    const operation = realtimeService.getOperation(operationId);
    if (!operation) {
      throw new Error("Operation not found");
    }

    const { input } = operation;

    // Simulate progress updates during processing
    let progress = 10;
    realtimeService.updateProgress(operationId, userId, progress, "Initializing AI model...");

    // Poll for completion with progress updates
    let finalPrediction = await replicate.predictions.get(operationId);
    const start = Date.now();
    const timeoutMs = 120_000; // 2 minutes

    while (finalPrediction.status === "starting" || finalPrediction.status === "processing") {
      if (Date.now() - start > timeoutMs) {
        realtimeService.sendError(operationId, userId, "Request timed out. Please try again.");
        return;
      }

      // Update progress based on elapsed time (simulated)
      const elapsed = Date.now() - start;
      const estimatedTotal = 60000; // Estimate 60 seconds total
      progress = Math.min(90, 10 + (elapsed / estimatedTotal) * 80);
      
      let message = "Processing image...";
      if (progress > 30) message = "Applying transformations...";
      if (progress > 60) message = "Generating variations...";
      if (progress > 80) message = "Finalizing results...";

      realtimeService.updateProgress(operationId, userId, Math.floor(progress), message);

      await sleep(2000);
      finalPrediction = await replicate.predictions.get(operationId);
      console.log("📊 Real-time prediction status:", finalPrediction.status);
    }

    if (finalPrediction.status !== "succeeded") {
      const error = (finalPrediction as any).error || "Transformation failed";
      console.error("❌ Real-time transformation failed:", error);
      realtimeService.sendError(operationId, userId, error);
      return;
    }

    realtimeService.updateProgress(operationId, userId, 95, "Saving results...");

    // Process results
    // Validate and safely extract output URLs
    let replicateUrls: string[];
    if (Array.isArray(finalPrediction.output)) {
      replicateUrls = finalPrediction.output.filter((url): url is string => typeof url === 'string');
    } else if (finalPrediction.output && typeof finalPrediction.output === 'string') {
      replicateUrls = [finalPrediction.output];
    } else {
      console.error('❌ Invalid prediction output format:', finalPrediction.output);
      realtimeService.sendError(operationId, userId, 'Invalid output format from AI service');
      return;
    }

    // Download & store all outputs locally
    const localUrls: string[] = [];
    for (let i = 0; i < replicateUrls.length; i++) {
      const url = replicateUrls[i];
      try {
        const resp = await fetch(url);
        const buf = Buffer.from(await resp.arrayBuffer());
        const stored = await fileStorage.saveFile(
          buf,
          `transformed_${operationId}_${i}.${input.output_format === "jpg" ? "jpg" : "png"}`,
          input.output_format === "jpg" ? "image/jpeg" : "image/png",
          userId
        );
        const protocol = req.protocol || 'http';
        const host = req.get('host') || 'localhost';
        const local = `${protocol}://${host}${stored.url}`;
        localUrls.push(local);

        // Send preview of each completed image
        realtimeService.sendPreview(operationId, userId, local, 95 + (i / replicateUrls.length) * 5);
      } catch (e) {
        console.warn("⚠️ Could not persist output, falling back to remote URL:", url, e);
        localUrls.push(url);
        realtimeService.sendPreview(operationId, userId, url, 95 + (i / replicateUrls.length) * 5);
      }
    }

    // Save transformation record to database
    try {
      // Save original input file to storage first if it's a data URL
      let originalFileUrl = input.input_image;
      let originalFileName = `original_${operationId}.png`;
      
      if (input.input_image.startsWith('data:')) {
        const base64Data = input.input_image.split(',')[1];
        const buffer = Buffer.from(base64Data, 'base64');
        const originalFile = await fileStorage.saveFile(
          buffer,
          originalFileName,
          'image/png',
          userId
        );
        const protocol = req.protocol || 'http';
        const host = req.get('host') || 'localhost';
        originalFileUrl = `${protocol}://${host}${originalFile.url}`;
      }
      
      await storage.createTransformation({
        userId,
        type: 'image',
        status: 'completed',
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
        resultFileUrls: localUrls,
      });
      console.log(`💾 Real-time transformation saved for user: ${userId}`);
    } catch (error) {
      console.error('Error saving transformation to database:', error);
      // Don't fail the whole operation if database save fails
    }

    // Send completion notification
    realtimeService.sendCompleted(operationId, userId, localUrls);

  } catch (error) {
    console.error("❌ Error in async transformation processing:", error);
    realtimeService.sendError(operationId, userId, "Internal server error during transformation");
  }
}

function clampInt(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.floor(n)));
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}