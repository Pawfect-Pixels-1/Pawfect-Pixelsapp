import { Request, Response } from "express";
import Replicate from "replicate";
import { storage, fileStorage } from "../storage";
import { OperationStatus, FluxKontextProOptions, Gen4AlephOptions } from "../../shared/types";
import { FluxKontextProRequestSchema, Gen4AlephRequestSchema } from "../../shared/schema";
import fetch from "node-fetch";

if (!process.env.REPLICATE_API_TOKEN) {
  console.error("❌ REPLICATE_API_TOKEN is required but not set in environment");
  process.exit(1);
}

const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });

// Tracks operation status/results across requests
const operationStore = new Map<string, OperationStatus>();

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
      operationStore.set(prediction.id, {
        id: prediction.id,
        type: "transform",
        status: "failed",
        error,
        createdAt: new Date(),
        failedAt: new Date(),
      });
      return res.status(500).json({ success: false, error, operationId: prediction.id });
    }

    // Validate and safely extract output URLs
    let replicateUrls: string[];
    if (Array.isArray(finalPrediction.output)) {
      replicateUrls = finalPrediction.output.filter((url): url is string => typeof url === 'string');
    } else if (finalPrediction.output && typeof finalPrediction.output === 'string') {
      replicateUrls = [finalPrediction.output];
    } else {
      console.error('❌ Invalid prediction output format:', finalPrediction.output);
      return res.status(500).json({ success: false, error: 'Invalid output format from AI service', operationId: prediction.id });
    }

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
        const protocol = req.protocol || 'http';
        const host = req.get('host') || 'localhost';
        const local = `${protocol}://${host}${stored.url}`;
        localUrls.push(local);
      } catch (e) {
        console.warn("⚠️ Could not persist output, falling back to remote URL:", url, e);
        localUrls.push(url);
      }
    }

    operationStore.set(prediction.id, {
      id: prediction.id,
      type: "transform",
      status: "completed",
      result: localUrls,
      createdAt: new Date(),
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
          const protocol = req.protocol || 'http';
          const host = req.get('host') || 'localhost';
          originalFileUrl = `${protocol}://${host}${originalFile.url}`;
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

/** 
 * Transform an image using FLUX.1 Kontext Pro for text-guided editing
 * Returns: { success, outputs: string[], transformedImage: string, operationId, model, meta }
 */
export async function fluxKontextProHandler(req: Request, res: Response) {
  try {
    console.log("🎨 Starting FLUX.1 Kontext Pro transformation");
    
    // Validate request body
    const validation = FluxKontextProRequestSchema.safeParse(req.body);
    if (!validation.success) {
      console.error("❌ Invalid request format:", validation.error.errors);
      return res.status(400).json({ 
        success: false, 
        error: `Invalid request: ${validation.error.errors.map(e => e.message).join(", ")}` 
      });
    }

    const { image, options } = validation.data;
    
    if (!options.prompt || options.prompt.trim().length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: "Prompt is required for FLUX.1 Kontext Pro" 
      });
    }

    // Prepare input for FLUX.1 Kontext Pro model
    const input = {
      prompt: options.prompt.trim(),
      input_image: image,
      aspect_ratio: options.aspect_ratio ?? "match_input_image",
      output_format: options.output_format ?? "jpg",
      safety_tolerance: options.safety_tolerance ?? 2,
      ...(options.seed && { seed: options.seed }),
      ...(options.finetune_id && { finetune_id: options.finetune_id }),
    };

    console.log("🎨 FLUX.1 Kontext Pro input:", { 
      prompt: input.prompt, 
      aspect_ratio: input.aspect_ratio,
      output_format: input.output_format,
      safety_tolerance: input.safety_tolerance,
      seed: input.seed,
      finetune_id: input.finetune_id
    });

    // Create prediction with FLUX.1 Kontext Pro model
    const prediction = await replicate.predictions.create({
      model: "black-forest-labs/flux-kontext-pro",
      input,
    });

    console.log(`🔄 FLUX.1 Kontext Pro prediction created: ${prediction.id}`);

    operationStore.set(prediction.id, {
      id: prediction.id,
      type: "transform",
      status: "processing",
      createdAt: new Date(),
      input,
      userId: req.user?.id,
      model: "flux-kontext-pro",
    });

    // Poll until done (max ~2 min, similar to existing handler)
    let finalPrediction = prediction;
    const start = Date.now();
    const timeoutMs = 120_000;

    while (finalPrediction.status === "starting" || finalPrediction.status === "processing") {
      if (Date.now() - start > timeoutMs) {
        return res.status(408).json({
          success: false,
          error: "Request timed out. Please try again.",
          operationId: prediction.id,
          model: "flux-kontext-pro",
        });
      }
      await sleep(2000);
      finalPrediction = await replicate.predictions.get(prediction.id);
      console.log("📊 FLUX.1 Kontext Pro prediction status:", finalPrediction.status);
    }

    if (finalPrediction.status !== "succeeded") {
      const error = (finalPrediction as any).error || "FLUX.1 Kontext Pro transformation failed";
      console.error("❌ FLUX.1 Kontext Pro transformation failed:", error);
      operationStore.set(prediction.id, {
        id: prediction.id,
        type: "transform",
        status: "failed",
        error,
        createdAt: new Date(),
        failedAt: new Date(),
        model: "flux-kontext-pro",
      });
      return res.status(500).json({ 
        success: false, 
        error, 
        operationId: prediction.id,
        model: "flux-kontext-pro"
      });
    }

    // Extract output URL (FLUX.1 Kontext Pro typically returns a single image)
    let replicateUrls: string[];
    if (Array.isArray(finalPrediction.output)) {
      replicateUrls = finalPrediction.output.filter((url): url is string => typeof url === 'string');
    } else if (finalPrediction.output && typeof finalPrediction.output === 'string') {
      replicateUrls = [finalPrediction.output];
    } else {
      console.error('❌ Invalid FLUX.1 Kontext Pro output format:', finalPrediction.output);
      return res.status(500).json({ 
        success: false, 
        error: 'Invalid output format from FLUX.1 Kontext Pro service', 
        operationId: prediction.id,
        model: "flux-kontext-pro"
      });
    }

    console.log(`✅ FLUX.1 Kontext Pro generated ${replicateUrls.length} image(s)`);

    // Download & store outputs locally
    const localUrls: string[] = [];
    for (let i = 0; i < replicateUrls.length; i++) {
      const url = replicateUrls[i];
      try {
        const resp = await fetch(url);
        const buf = Buffer.from(await resp.arrayBuffer());
        const fileExtension = input.output_format === "webp" ? "webp" : input.output_format === "png" ? "png" : "jpg";
        const mimeType = input.output_format === "webp" ? "image/webp" : input.output_format === "png" ? "image/png" : "image/jpeg";
        
        const stored = await fileStorage.saveFile(
          buf,
          `flux_transformed_${prediction.id}_${i}.${fileExtension}`,
          mimeType,
          req.user?.id
        );
        const protocol = req.protocol || 'http';
        const host = req.get('host') || 'localhost';
        const local = `${protocol}://${host}${stored.url}`;
        localUrls.push(local);
      } catch (e) {
        console.warn("⚠️ Could not persist FLUX.1 Kontext Pro output, falling back to remote URL:", url, e);
        localUrls.push(url);
      }
    }

    const completedAt = new Date();
    const predictTime = completedAt.getTime() - start;

    operationStore.set(prediction.id, {
      id: prediction.id,
      type: "transform",
      status: "completed",
      result: localUrls,
      createdAt: new Date(),
      completedAt,
      model: "flux-kontext-pro",
    });

    // Save transformation record to database if user is authenticated
    if (req.user && localUrls.length > 0) {
      try {
        // Save original input file to storage first if it's a data URL
        let originalFileUrl = image;
        let originalFileName = `flux_original_${prediction.id}.png`;
        
        if (image.startsWith('data:')) {
          const base64Data = image.split(',')[1];
          const buffer = Buffer.from(base64Data, 'base64');
          const originalFile = await fileStorage.saveFile(
            buffer,
            originalFileName,
            'image/png',
            req.user.id
          );
          const protocol = req.protocol || 'http';
          const host = req.get('host') || 'localhost';
          originalFileUrl = `${protocol}://${host}${originalFile.url}`;
        }
        
        await storage.createTransformation({
          userId: req.user.id,
          type: 'image',
          status: 'completed',
          originalFileName,
          originalFileUrl,
          transformationOptions: JSON.stringify({
            model: 'flux-kontext-pro',
            prompt: input.prompt,
            aspect_ratio: input.aspect_ratio,
            output_format: input.output_format,
            safety_tolerance: input.safety_tolerance,
            seed: input.seed,
            finetune_id: input.finetune_id,
          }),
          resultFileUrls: localUrls,
        });
        console.log(`💾 FLUX.1 Kontext Pro transformation saved for user: ${req.user.username}`);
      } catch (error) {
        console.error('Error saving FLUX.1 Kontext Pro transformation to database:', error);
      }
    }

    return res.json({
      success: true,
      outputs: localUrls,
      transformedImage: localUrls[0],
      operationId: prediction.id,
      model: "flux-kontext-pro",
      meta: {
        predictTime,
        imageCount: localUrls.length,
        version: "flux-kontext-pro",
      },
    });
  } catch (error) {
    console.error("❌ Error in FLUX.1 Kontext Pro handler:", error);
    return res.status(500).json({ 
      success: false, 
      error: "Internal server error during FLUX.1 Kontext Pro transformation",
      model: "flux-kontext-pro"
    });
  }
}

/** Generate a video using Kling v1.6 model */
export async function generateVideoHandler(req: Request, res: Response) {
  try {
    console.log('🎬 Starting video generation with Kling v1.6');
    
    if (!req.file && !req.body.image) {
      return res.status(400).json({ success: false, error: "No image provided" });
    }

    // Extract request data
    const { prompt, imageSource } = req.body;
    
    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ success: false, error: "Video prompt is required" });
    }

    // Handle image data - either from uploaded file or base64 data
    let imageBuffer: Buffer;
    let imageDataUrl: string;
    
    if (req.file) {
      imageBuffer = req.file.buffer;
      imageDataUrl = `data:${req.file.mimetype};base64,${imageBuffer.toString('base64')}`;
    } else if (req.body.image) {
      // Handle base64 image data
      const imageData = req.body.image.replace(/^data:image\/[^;]+;base64,/, '');
      imageBuffer = Buffer.from(imageData, 'base64');
      imageDataUrl = req.body.image;
    } else {
      return res.status(400).json({ success: false, error: "No valid image data provided" });
    }

    console.log(`📝 Video prompt: "${prompt}"`);
    console.log(`🖼️ Image source: ${imageSource || 'uploaded'}`);

    // Create prediction with Kling v1.6 model
    const prediction = await replicate.predictions.create({
      model: "kwaivgi/kling-v1.6-standard",
      input: {
        prompt: prompt.trim(),
        start_image: imageDataUrl,
      },
    });

    console.log(`🔄 Kling v1.6 prediction created: ${prediction.id}`);

    // Save original image to file storage first
    let originalFileName = 'uploaded_image.jpg';
    let originalFileUrl = '';
    
    if (req.user?.id) {
      try {
        // Save the original image that will be used for video generation
        const originalFile = await fileStorage.saveFile(
          imageBuffer,
          originalFileName,
          req.file?.mimetype || 'image/jpeg',
          req.user.id
        );
        const protocol = req.protocol || 'http';
        const host = req.get('host') || 'localhost';
        originalFileUrl = `${protocol}://${host}${originalFile.url}`;
        originalFileName = originalFile.originalName;
      } catch (error) {
        console.error('Error saving original image for video generation:', error);
      }
    }

    // Store operation details for polling
    const operation: OperationStatus = {
      status: 'processing',
      type: 'video',
      createdAt: new Date(),
      userId: req.user?.id,
      model: 'kling-v1.6-standard',
      originalFileName,
      originalFileUrl,
      input: {
        prompt,
        imageSource: imageSource || 'uploaded'
      }
    };
    
    operationStore.set(prediction.id, operation);

    // Return operation ID for status polling
    return res.json({
      success: true,
      operationId: prediction.id,
      status: 'processing',
      message: 'Video generation started. Use the operation ID to check status.'
    });

  } catch (error) {
    console.error("❌ Error in video generation handler:", error);
    return res.status(500).json({ 
      success: false, 
      error: "Internal server error during video generation" 
    });
  }
}

/** 
 * Generate video using Runway Gen4-Aleph model for in-context video editing
 * Returns: { success, outputUrl, operationId, model, meta }
 */
export async function gen4AlephHandler(req: Request, res: Response) {
  try {
    console.log("🎬 Starting Gen4-Aleph video generation");
    
    // Validate request body
    const validation = Gen4AlephRequestSchema.safeParse(req.body);
    if (!validation.success) {
      console.error("❌ Invalid Gen4-Aleph request format:", validation.error.errors);
      return res.status(400).json({ 
        success: false, 
        error: `Invalid request: ${validation.error.errors.map(e => e.message).join(", ")}` 
      });
    }

    const { video, options } = validation.data;
    
    if (!options.prompt || options.prompt.trim().length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: "Prompt is required for Gen4-Aleph video generation" 
      });
    }

    // Validate and enforce video duration limits (max 5 seconds)
    if (options.clipSeconds && options.clipSeconds > 5) {
      return res.status(400).json({ 
        success: false, 
        error: "Video duration cannot exceed 5 seconds for cost control" 
      });
    }

    // Convert video data URL to accessible URL if needed
    let videoUrl = video;
    let originalFileName = `gen4_input_${Date.now()}.mp4`;
    
    if (video.startsWith('data:')) {
      try {
        // Extract and save video data to storage for Replicate access
        const base64Data = video.split(',')[1];
        const buffer = Buffer.from(base64Data, 'base64');
        const savedFile = await fileStorage.saveFile(
          buffer,
          originalFileName,
          'video/mp4',
          req.user?.id
        );
        
        const protocol = req.protocol || 'http';
        const host = req.get('host') || 'localhost';
        videoUrl = `${protocol}://${host}${savedFile.url}`;
        
        console.log(`📼 Video saved to storage: ${videoUrl}`);
      } catch (error) {
        console.error('❌ Failed to save input video:', error);
        return res.status(500).json({ 
          success: false, 
          error: "Failed to process video input" 
        });
      }
    }

    // Prepare input for Gen4-Aleph model according to Runway's schema
    const input = {
      prompt: options.prompt.trim(),
      video: videoUrl, // Always use accessible URL
      aspect_ratio: options.aspectRatio ?? "16:9",
      ...(options.seed !== undefined && { seed: options.seed }),
      ...(options.referenceImage && { reference_image: options.referenceImage }),
      ...(options.clipSeconds && { duration: Math.min(options.clipSeconds, 5) }), // Enforce max 5s
    };

    console.log("🎬 Gen4-Aleph input:", { 
      prompt: input.prompt, 
      aspect_ratio: input.aspect_ratio,
      seed: input.seed,
      duration: input.duration,
      hasReferenceImage: !!input.reference_image,
      videoUrl: videoUrl
    });

    // Create prediction with pinned Gen4-Aleph model version
    const prediction = await replicate.predictions.create({
      model: "runwayml/gen4-aleph@latest", // Pin to latest stable version
      input,
    });

    console.log(`🔄 Gen4-Aleph prediction created: ${prediction.id}`);

    operationStore.set(prediction.id, {
      id: prediction.id,
      type: "video",
      status: "processing",
      createdAt: new Date(),
      input,
      userId: req.user?.id,
      model: "gen4-aleph",
    });

    // Poll until done (Gen4-Aleph can take 1-3 minutes)
    let finalPrediction = prediction;
    const start = Date.now();
    const timeoutMs = 300_000; // 5 minutes timeout

    while (finalPrediction.status === "starting" || finalPrediction.status === "processing") {
      if (Date.now() - start > timeoutMs) {
        return res.status(408).json({
          success: false,
          error: "Video generation timed out. Please try again.",
          operationId: prediction.id,
          model: "gen4-aleph",
        });
      }
      await sleep(3000); // Check every 3 seconds
      finalPrediction = await replicate.predictions.get(prediction.id);
      console.log("📊 Gen4-Aleph prediction status:", finalPrediction.status);
    }

    if (finalPrediction.status !== "succeeded") {
      const error = (finalPrediction as any).error || "Gen4-Aleph video generation failed";
      console.error("❌ Gen4-Aleph generation failed:", error);
      operationStore.set(prediction.id, {
        id: prediction.id,
        type: "video",
        status: "failed",
        error,
        createdAt: new Date(),
        failedAt: new Date(),
        model: "gen4-aleph",
      });
      return res.status(500).json({ 
        success: false, 
        error, 
        operationId: prediction.id,
        model: "gen4-aleph"
      });
    }

    // Extract output URL (Gen4-Aleph returns a single video URL)
    let outputVideoUrl: string;
    if (typeof finalPrediction.output === 'string') {
      outputVideoUrl = finalPrediction.output;
    } else if (Array.isArray(finalPrediction.output) && finalPrediction.output.length > 0) {
      outputVideoUrl = finalPrediction.output[0];
    } else {
      console.error('❌ Invalid Gen4-Aleph output format:', finalPrediction.output);
      return res.status(500).json({ 
        success: false, 
        error: 'Invalid output format from Gen4-Aleph service', 
        operationId: prediction.id,
        model: "gen4-aleph"
      });
    }

    console.log(`✅ Gen4-Aleph generated video: ${outputVideoUrl}`);

    // Download & store video locally for persistent access
    let localVideoUrl: string;
    try {
      const resp = await fetch(outputVideoUrl);
      if (!resp.ok) {
        throw new Error(`Failed to download video: ${resp.status} ${resp.statusText}`);
      }
      
      const buf = Buffer.from(await resp.arrayBuffer());
      
      const stored = await fileStorage.saveFile(
        buf,
        `gen4_video_${prediction.id}.mp4`,
        "video/mp4",
        req.user?.id
      );
      const protocol = req.protocol || 'http';
      const host = req.get('host') || 'localhost';
      localVideoUrl = `${protocol}://${host}${stored.url}`;
      
      console.log(`💾 Gen4-Aleph video persisted: ${localVideoUrl}`);
    } catch (e) {
      console.error("❌ Failed to persist Gen4-Aleph video:", e);
      return res.status(500).json({ 
        success: false, 
        error: "Failed to save generated video", 
        operationId: prediction.id,
        model: "gen4-aleph"
      });
    }

    const completedAt = new Date();
    const predictTime = completedAt.getTime() - start;

    operationStore.set(prediction.id, {
      id: prediction.id,
      type: "video",
      status: "completed",
      result: localVideoUrl,
      createdAt: new Date(),
      completedAt,
      model: "gen4-aleph",
    });

    // Save video generation record to database if user is authenticated
    if (req.user) {
      try {
        await storage.createTransformation({
          userId: req.user.id,
          type: 'video',
          status: 'completed',
          originalFileName,
          originalFileUrl: videoUrl, // Use the processed video URL
          transformationOptions: JSON.stringify({
            model: 'gen4-aleph',
            prompt: input.prompt,
            aspect_ratio: input.aspect_ratio,
            seed: input.seed,
            reference_image: input.reference_image,
            duration: input.duration,
          }),
          resultFileUrls: [localVideoUrl],
        });
        console.log(`💾 Gen4-Aleph video generation saved for user: ${req.user.username}`);
      } catch (error) {
        console.error('Error saving Gen4-Aleph generation to database:', error);
        // Don't fail the operation if database save fails
      }
    }

    // Return successful response with standardized format
    return res.json({
      success: true,
      outputUrl: localVideoUrl, // Ensure this matches client expectations
      operationId: prediction.id,
      model: "gen4-aleph",
      meta: {
        predictTime,
        version: "gen4-aleph@latest",
        duration: input.duration,
        originalInputUrl: videoUrl,
      },
    });
  } catch (error) {
    console.error("❌ Error in Gen4-Aleph handler:", error);
    return res.status(500).json({ 
      success: false, 
      error: "Internal server error during Gen4-Aleph video generation",
      model: "gen4-aleph"
    });
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

    if (operation.status === "processing") {
      try {
        const prediction = await replicate.predictions.get(operationId);
        if (prediction.status === "succeeded") {
          let outs: string[];
          if (Array.isArray(prediction.output)) {
            outs = prediction.output.filter((url): url is string => typeof url === 'string');
          } else if (prediction.output && typeof prediction.output === 'string') {
            outs = [prediction.output];
          } else {
            console.error('❌ Invalid prediction output format in status check:', prediction.output);
            operation.status = 'failed';
            operation.error = 'Invalid output format from AI service';
            operation.failedAt = new Date();
            operationStore.set(operationId, operation);
            return res.json({ success: true, operation });
          }

          const stored: string[] = [];
          for (let i = 0; i < outs.length; i++) {
            try {
              const resp = await fetch(outs[i]);
              const buf = Buffer.from(await resp.arrayBuffer());
              const isVideo = operation.type === "video";
              const ext = isVideo ? ".mp4" : ".png"; // default if unknown
              const mime = isVideo ? "video/mp4" : "image/png";
              // Only save with userId if it exists
              const file = await fileStorage.saveFile(buf, `${operation.type}_${operationId}_${i}${ext}`, mime, operation.userId || undefined);
              const protocol = req.protocol || 'http';
              const host = req.get('host') || 'localhost';
              stored.push(`${protocol}://${host}${file.url}`);
            } catch {
              stored.push(outs[i]);
            }
          }

          operation.status = "completed";
          operation.result = stored;
          operation.completedAt = new Date();
          operationStore.set(operationId, operation);

          // Save video generation to database
          if (operation.type === "video" && operation.userId) {
            try {
              await storage.createTransformation({
                userId: operation.userId,
                type: 'video',
                status: 'completed',
                originalFileName: operation.originalFileName || 'uploaded_image',
                originalFileUrl: operation.originalFileUrl || '',
                transformationOptions: JSON.stringify({
                  prompt: operation.input?.prompt || '',
                  imageSource: operation.input?.imageSource || 'uploaded',
                  model: operation.model || 'kling-v1.6-standard'
                }),
                resultFileUrls: stored,
              });
              console.log(`💾 Video generation saved to database for user: ${operation.userId}`);
            } catch (error) {
              console.error('Error saving video generation to database:', error);
              // Don't fail the whole operation if database save fails
            }
          }
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
