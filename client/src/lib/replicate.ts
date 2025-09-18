// Frontend API calls to our backend for Replicate operations
import { apiRequest } from './queryClient';

// --- Schema enums ---
export type StyleEnum =
  | "Anime" | "Cartoon" | "Clay" | "Gothic" | "Graphic Novel" | "Lego"
  | "Memoji" | "Minecraft" | "Minimalist" | "Pixel Art" | "Random"
  | "Simpsons" | "Sketch" | "South Park" | "Toy" | "Watercolor";

export type PersonaEnum =
  | "Angel" | "Astronaut" | "Demon" | "Mage" | "Ninja" | "Navi" | "Random"
  | "Random" | "Robot" | "Samurai" | "Vampire" | "Werewolf" | "Zombie";

export type AspectRatio =
  | "match_input_image" | "1:1" | "16:9" | "9:16" | "4:3" | "3:4"
  | "3:2" | "2:3" | "4:5" | "5:4" | "21:9" | "9:21" | "2:1" | "1:2";

export type OutputFormat = "jpg" | "png";

export interface TransformationOptions {
  seed?: number | null;
  style?: StyleEnum;                 // default "Random"
  persona?: PersonaEnum;             // default "None"
  num_images?: number;               // 1..10, default 1
  input_image?: string;              // optional override; backend uses `image` when omitted
  aspect_ratio?: AspectRatio;        // default "match_input_image"
  output_format?: OutputFormat;      // default "png"
  preserve_outfit?: boolean;         // default false
  safety_tolerance?: 0 | 1 | 2;      // default 2
  preserve_background?: boolean;     // default false
}

export interface VideoOptions {
  style: string;
  duration?: number;
  fps?: number;
}

/**
 * Transform an uploaded image using Replicate (Kontext)
 * Returns ALL output URLs (array)
 */
export async function transformImage(
  imageDataUrlOrHttp: string,
  style: string,
  options?: Partial<TransformationOptions>
): Promise<string[]> {
  try {
    console.log('🎨 Starting image transformation (Kontext):', { style, options });

    const response = await apiRequest('POST', '/api/transform', {
      image: imageDataUrlOrHttp,  // server will use as `input_image` if options.input_image absent
      style,                      // telemetry / optional mapping
      options: sanitizeOptions(options),
    });

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || 'Transformation failed');
    }

    // New shape: outputs[]; support legacy transformedImage
    const outputs: string[] = Array.isArray(result.outputs)
      ? result.outputs
      : (result.transformedImage ? [result.transformedImage] : []);

    console.log(`✅ Image transformation completed (${outputs.length} images)`);
    return outputs;
  } catch (error) {
    console.error('❌ Image transformation failed:', error);
    throw new Error('Failed to transform image. Please try again.');
  }
}

/**
 * Generate a video from an uploaded image using Replicate AI models
 */
export async function generateVideo(imageDataUrl: string, style: string): Promise<string> {
  try {
    console.log('🎬 Starting video generation:', style);

    const response = await apiRequest('POST', '/api/generate-video', {
      image: imageDataUrl,
      style: style,
      options: {
        duration: getVideoDuration(style),
        fps: 24,
      },
    });

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error || 'Video generation failed');
    }

    console.log('✅ Video generation completed');
    return result.videoUrl as string;
  } catch (error) {
    console.error('❌ Video generation failed:', error);
    throw new Error('Failed to generate video. Please try again.');
  }
}

/**
 * Poll for the status of a long-running operation
 * Backend returns { success, operation: { status, result?: string[] } }
 */
export async function pollOperationStatus(operationId: string): Promise<any> {
  const maxAttempts = 60;
  let attempts = 0;

  while (attempts < maxAttempts) {
    try {
      const response = await apiRequest('GET', `/api/status/${operationId}`);
      const result = await response.json();

      const op = result?.operation;
      if (op?.status === 'completed') {
        return op; // includes op.result (array)
      } else if (op?.status === 'failed') {
        throw new Error(op.error || 'Operation failed');
      }

      await new Promise((r) => setTimeout(r, 5000));
      attempts++;
    } catch (e) {
      console.error('Error polling operation status:', e);
      attempts++;
      await new Promise((r) => setTimeout(r, 5000));
    }
  }

  throw new Error('Operation timed out');
}

/* Helpers */

function sanitizeOptions(options?: Partial<TransformationOptions>): Partial<TransformationOptions> {
  if (!options) return {};
  const copy = { ...options };

  // Clamp & enforce enum expectations where we can on the client
  if (typeof copy.num_images === 'number') {
    copy.num_images = Math.max(1, Math.min(10, Math.floor(copy.num_images)));
  }
  if (copy.safety_tolerance !== 0 && copy.safety_tolerance !== 1 && copy.safety_tolerance !== 2) {
    delete copy.safety_tolerance;
  }
  if (copy.output_format && !['png', 'jpg'].includes(copy.output_format)) {
    delete copy.output_format;
  }
  return copy;
}

function getVideoDuration(style: string): number {
  const durations: Record<string, number> = { talking: 3, animation: 5, expression: 2 };
  return durations[style] || 3;
}
