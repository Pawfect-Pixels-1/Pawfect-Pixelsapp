// Frontend API calls for Gen4-Aleph video generation
import { useState } from 'react';
import { apiRequest } from './queryClient';
import type { Gen4AlephOptions } from '../../shared/types';

export interface Gen4AlephVideoOptions extends Omit<Gen4AlephOptions, 'prompt'> {
  // All options except prompt, since prompt is passed separately
}

/**
 * Generate video using Runway Gen4-Aleph model for in-context video editing
 * Returns the generated video URL
 */
export async function generateVideoWithGen4Aleph(
  videoDataUrlOrHttp: string,
  prompt: string,
  options?: Partial<Gen4AlephVideoOptions>
): Promise<{
  outputUrl: string;
  operationId: string;
  model: string;
  meta?: {
    predictTime?: number;
    version?: string;
    duration?: number;
  };
}> {
  try {
    console.log('🎬 Starting Gen4-Aleph video generation:', { prompt, options });

    const response = await apiRequest('POST', '/api/video/gen4-aleph', {
      video: videoDataUrlOrHttp,
      options: {
        prompt,
        aspectRatio: options?.aspectRatio ?? "16:9",
        ...(options?.seed !== undefined && { seed: options.seed }),
        ...(options?.referenceImage && { referenceImage: options.referenceImage }),
        ...(options?.clipSeconds && { clipSeconds: options.clipSeconds }),
      },
    });

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || 'Gen4-Aleph video generation failed');
    }

    if (!result.outputUrl) {
      throw new Error('No video output URL received from Gen4-Aleph');
    }

    console.log('✅ Gen4-Aleph video generation completed:', result.outputUrl);
    return {
      outputUrl: result.outputUrl,
      operationId: result.operationId,
      model: result.model || 'gen4-aleph',
      meta: result.meta,
    };
  } catch (error) {
    console.error('❌ Gen4-Aleph video generation failed:', error);
    throw new Error('Failed to generate video with Gen4-Aleph. Please try again.');
  }
}

/**
 * Hook for using Gen4-Aleph video generation with state management
 */
export function useGen4Aleph() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateVideo = async (
    video: string | File,
    prompt: string,
    options?: Partial<Gen4AlephVideoOptions>
  ) => {
    setIsGenerating(true);
    setError(null);

    try {
      let videoDataUrl: string;

      if (video instanceof File) {
        // Convert file to data URL
        const reader = new FileReader();
        videoDataUrl = await new Promise((resolve, reject) => {
          reader.onload = (e) => resolve(e.target?.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(video);
        });
      } else {
        videoDataUrl = video;
      }

      const result = await generateVideoWithGen4Aleph(videoDataUrl, prompt, options);
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      throw err;
    } finally {
      setIsGenerating(false);
    }
  };

  return {
    generateVideo,
    isGenerating,
    error,
  };
}