// Shared types between frontend and backend

export interface TransformationRequest {
  image: string; // base64 encoded image
  style: string;
  options?: {
    strength?: number;
    prompt?: string;
  };
}

export interface VideoGenerationRequest {
  image: string; // base64 encoded image
  style: string;
  options?: {
    duration?: number;
    fps?: number;
  };
}

export interface TransformationResponse {
  success: boolean;
  transformedImage?: string;
  operationId?: string;
  error?: string;
}

export interface VideoGenerationResponse {
  success: boolean;
  videoUrl?: string;
  operationId?: string;
  error?: string;
}

export interface OperationStatus {
  id: string;
  type: 'transform' | 'video';
  status: 'processing' | 'completed' | 'failed';
  result?: string;
  error?: string;
  createdAt: Date;
  completedAt?: Date;
  failedAt?: Date;
}

export interface StatusResponse {
  success: boolean;
  operation?: OperationStatus;
  error?: string;
}

// Available transformation styles
export type TransformationStyle = 'portrait' | 'artistic' | 'anime' | 'vintage';

// Available video generation styles  
export type VideoStyle = 'talking' | 'animation' | 'expression';

// API endpoints
export const API_ENDPOINTS = {
  TRANSFORM: '/api/transform',
  GENERATE_VIDEO: '/api/generate-video',
  STATUS: '/api/status',
  HEALTH: '/api/health'
} as const;

// Replicate model configurations
export interface ReplicateModelConfig {
  version: string;
  inputParams: Record<string, any>;
  outputFormat: 'image' | 'video';
}

// File upload constraints
export const UPLOAD_CONSTRAINTS = {
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  ALLOWED_FORMATS: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
  MAX_DIMENSION: 2048 // pixels
} as const;

// Processing timeouts
export const PROCESSING_TIMEOUTS = {
  IMAGE_TRANSFORM: 120000, // 2 minutes
  VIDEO_GENERATION: 300000, // 5 minutes
  STATUS_POLL_INTERVAL: 2000 // 2 seconds
} as const;
