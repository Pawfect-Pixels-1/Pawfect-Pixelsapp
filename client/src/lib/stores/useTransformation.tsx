import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

export type OperationType = 'transform' | 'video' | null;

interface TransformationState {
  // Image data
  uploadedImage: string | null;
  originalImage: string | null; // Store original before editing
  transformedImage: string | null;
  transformedImages: string[];
  generatedVideo: string | null;
  
  // Processing state
  isProcessing: boolean;
  currentOperation: OperationType;
  progress: number;
  
  // Editor state
  showImageEditor: boolean;
  
  // Actions
  setUploadedImage: (image: string | null) => void;
  setOriginalImage: (image: string | null) => void;
  setTransformedImage: (image: string | null) => void;
  setTransformedImages: (images: string[]) => void;
  setGeneratedVideo: (video: string | null) => void;
  setIsProcessing: (processing: boolean) => void;
  setCurrentOperation: (operation: OperationType) => void;
  setProgress: (progress: number) => void;
  setShowImageEditor: (show: boolean) => void;
  clearResults: () => void;
  reset: () => void;
}

export const useTransformation = create<TransformationState>()(
  subscribeWithSelector((set, get) => ({
    // Initial state
    uploadedImage: null,
    originalImage: null,
    transformedImage: null,
    transformedImages: [],
    generatedVideo: null,
    isProcessing: false,
    currentOperation: null,
    progress: 0,
    showImageEditor: false,
    
    // Actions
    setUploadedImage: (image) => {
      set({ uploadedImage: image });
    },
    
    setOriginalImage: (image) => {
      set({ originalImage: image });
    },
    
    setTransformedImage: (image) => {
      set({ transformedImage: image });
    },
    
    setTransformedImages: (images) => {
      set({ 
        transformedImages: images,
        transformedImage: images.length > 0 ? images[0] : null
      });
    },
    
    setGeneratedVideo: (video) => {
      set({ generatedVideo: video });
    },
    
    setIsProcessing: (processing) => {
      set({ isProcessing: processing });
      if (!processing) {
        set({ progress: 0 });
      }
    },
    
    setCurrentOperation: (operation) => {
      set({ currentOperation: operation });
    },
    
    setProgress: (progress) => {
      set({ progress: Math.min(100, Math.max(0, progress)) });
    },
    
    setShowImageEditor: (show) => {
      set({ showImageEditor: show });
    },
    
    clearResults: () => {
      set({
        transformedImage: null,
        transformedImages: [],
        generatedVideo: null,
        isProcessing: false,
        currentOperation: null,
        progress: 0
      });
    },
    
    reset: () => {
      set({
        uploadedImage: null,
        originalImage: null,
        transformedImage: null,
        transformedImages: [],
        generatedVideo: null,
        isProcessing: false,
        currentOperation: null,
        progress: 0,
        showImageEditor: false
      });
    }
  }))
);

// Subscribe to processing state changes for logging
useTransformation.subscribe(
  (state) => state.isProcessing,
  (isProcessing, previousProcessing) => {
    if (isProcessing && !previousProcessing) {
      console.log('🚀 AI processing started');
    } else if (!isProcessing && previousProcessing) {
      console.log('✅ AI processing completed');
    }
  }
);

// Subscribe to operation changes
useTransformation.subscribe(
  (state) => state.currentOperation,
  (operation) => {
    if (operation) {
      console.log(`🎯 Starting ${operation} operation`);
    }
  }
);
