// Frontend API calls to our backend for Replicate operations
import { apiRequest } from './queryClient';

export interface TransformationOptions {
  style: string;
  strength?: number;
  prompt?: string;
}

export interface VideoOptions {
  style: string;
  duration?: number;
  fps?: number;
}

/**
 * Transform an uploaded image using Replicate AI models
 */
export async function transformImage(imageDataUrl: string, style: string): Promise<string> {
  try {
    console.log('🎨 Starting image transformation:', style);
    
    const response = await apiRequest('POST', '/api/transform', {
      image: imageDataUrl,
      style: style,
      options: {
        strength: 0.8,
        prompt: getStylePrompt(style)
      }
    });

    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || 'Transformation failed');
    }

    console.log('✅ Image transformation completed');
    return result.transformedImage;
    
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
        fps: 24
      }
    });

    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || 'Video generation failed');
    }

    console.log('✅ Video generation completed');
    return result.videoUrl;
    
  } catch (error) {
    console.error('❌ Video generation failed:', error);
    throw new Error('Failed to generate video. Please try again.');
  }
}

/**
 * Get the appropriate prompt for different transformation styles
 */
function getStylePrompt(style: string): string {
  const prompts: Record<string, string> = {
    'portrait': 'professional portrait photograph, high quality, studio lighting, sharp details',
    'artistic': 'artistic portrait painting, oil painting style, dramatic lighting, expressive brushstrokes',
    'anime': 'anime character portrait, cel shading, vibrant colors, manga style illustration',
    'vintage': 'vintage photograph, sepia tones, classic portrait style, film grain texture'
  };
  
  return prompts[style] || prompts['portrait'];
}

/**
 * Get the appropriate duration for different video styles
 */
function getVideoDuration(style: string): number {
  const durations: Record<string, number> = {
    'talking': 3,
    'animation': 5,
    'expression': 2
  };
  
  return durations[style] || 3;
}

/**
 * Poll for the status of a long-running operation
 */
export async function pollOperationStatus(operationId: string): Promise<any> {
  const maxAttempts = 60; // 5 minutes max (5 second intervals)
  let attempts = 0;
  
  while (attempts < maxAttempts) {
    try {
      const response = await apiRequest('GET', `/api/status/${operationId}`);
      const result = await response.json();
      
      if (result.status === 'completed') {
        return result;
      } else if (result.status === 'failed') {
        throw new Error(result.error || 'Operation failed');
      }
      
      // Wait 5 seconds before next poll
      await new Promise(resolve => setTimeout(resolve, 5000));
      attempts++;
      
    } catch (error) {
      console.error('Error polling operation status:', error);
      attempts++;
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
  
  throw new Error('Operation timed out');
}
