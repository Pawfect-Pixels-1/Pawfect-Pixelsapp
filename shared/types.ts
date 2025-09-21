// Shared types between frontend and backend
// These mirror the model schema for face-to-many-kontext.
// See: Replicate model API schema (inputs/outputs). Results are arrays of URLs. 

export type StyleEnum =
  | "Anime" | "Cartoon" | "Clay" | "Gothic" | "Graphic Novel" | "Lego"
  | "Memoji" | "Minecraft" | "Minimalist" | "Pixel Art" | "Random"
  | "Simpsons" | "Sketch" | "South Park" | "Toy" | "Watercolor";

export type PersonaEnum =
  | "Angel" | "Astronaut" | "Demon" | "Mage" | "Ninja" | "Na'vi" | "None"
  | "Random" | "Robot" | "Samurai" | "Vampire" | "Werewolf" | "Zombie";

export type AspectRatio =
  | "match_input_image" | "1:1" | "16:9" | "9:16" | "4:3" | "3:4"
  | "3:2" | "2:3" | "4:5" | "5:4" | "21:9" | "9:21" | "2:1" | "1:2";

export type OutputFormat = "jpg" | "png";

/** Matches our backend handler + model schema */
export interface TransformationRequest {
  /** data:image/...;base64,... or https://... */
  image: string;
  /** optional UI tag; not required by model */
  style?: string;
  options?: {
    seed?: number | null;
    style?: StyleEnum;
    persona?: PersonaEnum;
    num_images?: number;           // 1..10
    input_image?: string;          // optional override for `image`
    aspect_ratio?: AspectRatio;    // default 'match_input_image'
    output_format?: OutputFormat;  // 'png' | 'jpg'
    preserve_outfit?: boolean;
    safety_tolerance?: 0 | 1 | 2;
    preserve_background?: boolean;
  };
}

export interface VideoGenerationRequest {
  image: string; // data URL or https
  style: string;
  options?: {
    duration?: number;
    fps?: number;
  };
}

/** Transform response now returns ALL image URLs */
export interface TransformationResponse {
  success: boolean;
  outputs?: string[];            // array of URLs (preferred)
  transformedImage?: string;     // first URL (legacy compat)
  operationId?: string;
  error?: string;
}

export interface VideoGenerationResponse {
  success: boolean;
  videoUrl?: string;
  operationId?: string;
  error?: string;
}

/** Operation status now supports array results (images) */
export interface OperationStatus {
  id?: string;
  type: 'transform' | 'video';
  status: 'processing' | 'completed' | 'failed';
  /** images[] for transform, single URL for video */
  result?: string[] | string;
  error?: string;
  createdAt: Date;
  completedAt?: Date;
  failedAt?: Date;
  userId?: number;
  model?: string;
  input?: any;
}

export interface StatusResponse {
  success: boolean;
  operation?: OperationStatus;
  error?: string;
}

/** Available transformation enums (mirror model schema) */
export type TransformationStyle = StyleEnum;

/** Available video generation styles  */
export type VideoStyle = 'talking' | 'animation' | 'expression';

/** API endpoints */
export const API_ENDPOINTS = {
  TRANSFORM: '/api/transform',
  GENERATE_VIDEO: '/api/generate-video',
  STATUS: '/api/status',
  HEALTH: '/api/health',
} as const;

/** Replicate model configurations */
export interface ReplicateModelConfig {
  version: string;
  inputParams: Record<string, any>;
  /** images for transform array, video for mp4 */
  outputFormat: 'images' | 'video';
}

/** File upload constraints (per model: jpeg/png/gif/webp) */
export const UPLOAD_CONSTRAINTS = {
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  ALLOWED_FORMATS: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'],
  MAX_DIMENSION: 2048, // pixels (app-specific; adjust as desired)
} as const;

/** Processing timeouts */
export const PROCESSING_TIMEOUTS = {
  IMAGE_TRANSFORM: 120000, // 2 minutes
  VIDEO_GENERATION: 300000, // 5 minutes
  STATUS_POLL_INTERVAL: 2000, // 2 seconds
} as const;
