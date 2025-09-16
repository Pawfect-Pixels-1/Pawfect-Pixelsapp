import { Request, Response } from "express";
import Replicate from "replicate";
import { fileStorage } from "../storage";
import fetch from 'node-fetch';

// Initialize Replicate client
if (!process.env.REPLICATE_API_TOKEN) {
  console.error('❌ REPLICATE_API_TOKEN is required but not set in environment');
  process.exit(1);
}

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN
});

// Store for tracking operation status
const operationStore = new Map<string, any>();

/**
 * Transform an image using Replicate AI models
 */
export async function transformImageHandler(req: Request, res: Response) {
  try {
    const { image, style, options } = req.body;

    if (!image) {
      return res.status(400).json({
        success: false,
        error: "No image provided"
      });
    }

    console.log(`🎨 Starting image transformation with style: ${style}`);

    // Convert base64 to buffer for Replicate
    const base64Data = image.replace(/^data:image\/[a-z]+;base64,/, "");
    const imageBuffer = Buffer.from(base64Data, 'base64');

    // Select the appropriate model based on style
    const model = getTransformationModel(style);
    const prompt = options?.prompt || getStylePrompt(style);

    console.log(`📋 Using model: ${model} with prompt: ${prompt}`);

    // Create prediction
    const prediction = await replicate.predictions.create({
      version: model,
      input: {
        image: `data:image/jpeg;base64,${base64Data}`,
        prompt: prompt,
        strength: options?.strength || 0.8,
        guidance_scale: 7.5,
        num_inference_steps: 25
      }
    });

    console.log(`🔄 Prediction created: ${prediction.id}`);

    // Store prediction for status polling
    operationStore.set(prediction.id, {
      id: prediction.id,
      type: 'transform',
      status: 'processing',
      createdAt: new Date()
    });

    // Wait for completion (with timeout)
    let finalPrediction = prediction;
    const maxWaitTime = 120000; // 2 minutes
    const startTime = Date.now();

    while (finalPrediction.status === "starting" || finalPrediction.status === "processing") {
      if (Date.now() - startTime > maxWaitTime) {
        return res.status(408).json({
          success: false,
          error: "Request timed out. Please try again.",
          operationId: prediction.id
        });
      }

      await new Promise(resolve => setTimeout(resolve, 2000));
      finalPrediction = await replicate.predictions.get(prediction.id);
      
      console.log(`📊 Prediction status: ${finalPrediction.status}`);
    }

    if (finalPrediction.status === "succeeded") {
      const replicateImageUrl = Array.isArray(finalPrediction.output) 
        ? finalPrediction.output[0] 
        : finalPrediction.output;

      try {
        // Download and store the transformed image
        console.log(`📥 Downloading transformed image from: ${replicateImageUrl}`);
        const imageResponse = await fetch(replicateImageUrl);
        const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
        
        const storedFile = await fileStorage.saveFile(
          imageBuffer, 
          `transformed_${prediction.id}.jpg`,
          'image/jpeg'
        );

        const localImageUrl = `${req.protocol}://${req.get('host')}${storedFile.url}`;

        // Update operation store
        operationStore.set(prediction.id, {
          id: prediction.id,
          type: 'transform',
          status: 'completed',
          result: localImageUrl,
          completedAt: new Date()
        });

        console.log(`✅ Image transformation completed and stored: ${localImageUrl}`);

        return res.json({
          success: true,
          transformedImage: localImageUrl,
          operationId: prediction.id
        });
      } catch (downloadError) {
        console.error('❌ Error downloading/storing image:', downloadError);
        // Fall back to original URL if storage fails
        const transformedImageUrl = replicateImageUrl;
        
        operationStore.set(prediction.id, {
          id: prediction.id,
          type: 'transform',
          status: 'completed',
          result: transformedImageUrl,
          completedAt: new Date()
        });

        return res.json({
          success: true,
          transformedImage: transformedImageUrl,
          operationId: prediction.id
        });
      }
    } else {
      const error = finalPrediction.error || "Transformation failed";
      console.error(`❌ Transformation failed: ${error}`);

      operationStore.set(prediction.id, {
        id: prediction.id,
        type: 'transform',
        status: 'failed',
        error: error,
        failedAt: new Date()
      });

      return res.status(500).json({
        success: false,
        error: error,
        operationId: prediction.id
      });
    }

  } catch (error) {
    console.error("❌ Error in transform handler:", error);
    return res.status(500).json({
      success: false,
      error: "Internal server error during transformation"
    });
  }
}

/**
 * Generate a video from an image using Replicate AI models
 */
export async function generateVideoHandler(req: Request, res: Response) {
  try {
    const { image, style, options } = req.body;

    if (!image) {
      return res.status(400).json({
        success: false,
        error: "No image provided"
      });
    }

    console.log(`🎬 Starting video generation with style: ${style}`);

    // Convert base64 to buffer
    const base64Data = image.replace(/^data:image\/[a-z]+;base64,/, "");

    // Select the appropriate model for video generation
    const model = getVideoModel(style);
    const duration = options?.duration || 3;

    console.log(`📋 Using video model: ${model} for ${duration}s duration`);

    // Create prediction for video generation
    const prediction = await replicate.predictions.create({
      version: model,
      input: {
        image: `data:image/jpeg;base64,${base64Data}`,
        motion_strength: getMotionStrength(style),
        fps: options?.fps || 24,
        duration: duration
      }
    });

    console.log(`🔄 Video prediction created: ${prediction.id}`);

    // Store prediction for status polling
    operationStore.set(prediction.id, {
      id: prediction.id,
      type: 'video',
      status: 'processing',
      createdAt: new Date()
    });

    // Wait for completion (videos take longer)
    let finalPrediction = prediction;
    const maxWaitTime = 300000; // 5 minutes for video
    const startTime = Date.now();

    while (finalPrediction.status === "starting" || finalPrediction.status === "processing") {
      if (Date.now() - startTime > maxWaitTime) {
        return res.status(408).json({
          success: false,
          error: "Video generation timed out. Please try again.",
          operationId: prediction.id
        });
      }

      await new Promise(resolve => setTimeout(resolve, 5000)); // Longer intervals for video
      finalPrediction = await replicate.predictions.get(prediction.id);
      
      console.log(`📊 Video prediction status: ${finalPrediction.status}`);
    }

    if (finalPrediction.status === "succeeded") {
      const replicateVideoUrl = Array.isArray(finalPrediction.output) 
        ? finalPrediction.output[0] 
        : finalPrediction.output;

      try {
        // Download and store the generated video
        console.log(`📥 Downloading generated video from: ${replicateVideoUrl}`);
        const videoResponse = await fetch(replicateVideoUrl);
        const videoBuffer = Buffer.from(await videoResponse.arrayBuffer());
        
        const storedFile = await fileStorage.saveFile(
          videoBuffer, 
          `video_${prediction.id}.mp4`,
          'video/mp4'
        );

        const localVideoUrl = `${req.protocol}://${req.get('host')}${storedFile.url}`;

        // Update operation store
        operationStore.set(prediction.id, {
          id: prediction.id,
          type: 'video',
          status: 'completed',
          result: localVideoUrl,
          completedAt: new Date()
        });

        console.log(`✅ Video generation completed and stored: ${localVideoUrl}`);

        return res.json({
          success: true,
          videoUrl: localVideoUrl,
          operationId: prediction.id
        });
      } catch (downloadError) {
        console.error('❌ Error downloading/storing video:', downloadError);
        // Fall back to original URL if storage fails
        const videoUrl = replicateVideoUrl;
        
        operationStore.set(prediction.id, {
          id: prediction.id,
          type: 'video',
          status: 'completed',
          result: videoUrl,
          completedAt: new Date()
        });

        return res.json({
          success: true,
          videoUrl: videoUrl,
          operationId: prediction.id
        });
      }
    } else {
      const error = finalPrediction.error || "Video generation failed";
      console.error(`❌ Video generation failed: ${error}`);

      operationStore.set(prediction.id, {
        id: prediction.id,
        type: 'video',
        status: 'failed',
        error: error,
        failedAt: new Date()
      });

      return res.status(500).json({
        success: false,
        error: error,
        operationId: prediction.id
      });
    }

  } catch (error) {
    console.error("❌ Error in video generation handler:", error);
    return res.status(500).json({
      success: false,
      error: "Internal server error during video generation"
    });
  }
}

/**
 * Get the status of a long-running operation
 */
export async function getStatusHandler(req: Request, res: Response) {
  try {
    const { operationId } = req.params;
    
    const operation = operationStore.get(operationId);
    if (!operation) {
      return res.status(404).json({
        success: false,
        error: "Operation not found"
      });
    }

    // If still processing, check Replicate for updates
    if (operation.status === 'processing') {
      try {
        const prediction = await replicate.predictions.get(operationId);
        
        if (prediction.status === "succeeded") {
          const replicateUrl = Array.isArray(prediction.output) 
            ? prediction.output[0] 
            : prediction.output;
          
          try {
            // Download and store the result locally
            console.log(`📥 Downloading ${operation.type} result from: ${replicateUrl}`);
            const response = await fetch(replicateUrl);
            const buffer = Buffer.from(await response.arrayBuffer());
            
            const fileExtension = operation.type === 'video' ? '.mp4' : '.jpg';
            const mimeType = operation.type === 'video' ? 'video/mp4' : 'image/jpeg';
            
            const storedFile = await fileStorage.saveFile(
              buffer, 
              `${operation.type}_${operationId}${fileExtension}`,
              mimeType
            );

            const localUrl = `${req.protocol}://${req.get('host')}${storedFile.url}`;
            
            operation.status = 'completed';
            operation.result = localUrl;
            operation.completedAt = new Date();
            operationStore.set(operationId, operation);
          } catch (downloadError) {
            console.error('❌ Error downloading/storing result in status handler:', downloadError);
            // Fall back to original URL if storage fails
            operation.status = 'completed';
            operation.result = replicateUrl;
            operation.completedAt = new Date();
            operationStore.set(operationId, operation);
          }
        } else if (prediction.status === "failed") {
          operation.status = 'failed';
          operation.error = prediction.error || "Operation failed";
          operation.failedAt = new Date();
          operationStore.set(operationId, operation);
        }
      } catch (error) {
        console.error("Error checking prediction status:", error);
      }
    }

    return res.json({
      success: true,
      operation: operation
    });

  } catch (error) {
    console.error("❌ Error in status handler:", error);
    return res.status(500).json({
      success: false,
      error: "Internal server error"
    });
  }
}

/**
 * Get the appropriate Replicate model for image transformation
 */
function getTransformationModel(style: string): string {
  const models: Record<string, string> = {
    'portrait': "stability-ai/stable-diffusion:ac732df83cea7fff18b8472768c88ad041fa750ff7682a21affe81863cbe77e45",
    'artistic': "stability-ai/stable-diffusion:ac732df83cea7fff18b8472768c88ad041fa750ff7682a21affe81863cbe77e45", 
    'anime': "cjwbw/anything-v3.0:09a5805203f4c12da649ec1923bb7729517ca25fcac790e640eaa9ed66573b65",
    'vintage': "stability-ai/stable-diffusion:ac732df83cea7fff18b8472768c88ad041fa750ff7682a21affe81863cbe77e45"
  };
  
  return models[style] || models['portrait'];
}

/**
 * Get the appropriate Replicate model for video generation
 */
function getVideoModel(style: string): string {
  const models: Record<string, string> = {
    'talking': "cjwbw/sadtalker:3aa3dac9353cc4d6bd62a8f95957bd844003b401ca4e4a9b33baa574c549d376",
    'animation': "ali-vilab/i2vgen-xl:5821a338d00033abaaba89080a17eb8783d9a17ed710a6b4246a18e0900ccad4",
    'expression': "cjwbw/sadtalker:3aa3dac9353cc4d6bd62a8f95957bd844003b401ca4e4a9b33baa574c549d376"
  };
  
  return models[style] || models['talking'];
}

/**
 * Get style-specific prompts
 */
function getStylePrompt(style: string): string {
  const prompts: Record<string, string> = {
    'portrait': 'professional portrait photograph, high quality, studio lighting, sharp details, photorealistic',
    'artistic': 'artistic portrait painting, oil painting style, dramatic lighting, expressive brushstrokes, fine art',
    'anime': 'anime character portrait, cel shading, vibrant colors, manga style illustration, detailed',
    'vintage': 'vintage photograph, sepia tones, classic portrait style, film grain texture, nostalgic'
  };
  
  return prompts[style] || prompts['portrait'];
}

/**
 * Get motion strength for video generation
 */
function getMotionStrength(style: string): number {
  const strengths: Record<string, number> = {
    'talking': 1.0,
    'animation': 1.5,
    'expression': 0.8
  };
  
  return strengths[style] || 1.0;
}

// Clean up old operations periodically
setInterval(() => {
  const now = Date.now();
  const maxAge = 24 * 60 * 60 * 1000; // 24 hours
  
  operationStore.forEach((operation, id) => {
    const createdAt = new Date(operation.createdAt).getTime();
    if (now - createdAt > maxAge) {
      operationStore.delete(id);
      console.log(`🧹 Cleaned up old operation: ${id}`);
    }
  });
}, 60 * 60 * 1000); // Run every hour
