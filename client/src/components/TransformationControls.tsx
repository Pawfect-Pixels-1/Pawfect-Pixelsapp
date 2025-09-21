import React, { useMemo, useState, useEffect } from 'react';
import { Wand2, Video, Sparkles, Palette, Zap, Clock } from 'lucide-react';

// Store + API
import { useTransformation } from '../lib/stores/useTransformation';
import { transformImage, generateVideo, pollOperationStatus } from '../lib/replicate';
import { RealtimeTransformModal } from './RealtimeTransformModal';
import { VideoPlayer } from './VideoPlayer';

// --- Exact enums from the model schema ---
// See: https://replicate.com/flux-kontext-apps/face-to-many-kontext (API/Schema)
const STYLE_ENUM = [
  'Anime',
  'Cartoon',
  'Clay',
  'Gothic',
  'Graphic Novel',
  'Lego',
  'Memoji',
  'Minecraft',
  'Minimalist',
  'Pixel Art',
  'Random',
  'Simpsons',
  'Sketch',
  'South Park',
  'Toy',
  'Watercolor',
] as const;

const PERSONA_ENUM = [
  'Angel',
  'Astronaut',
  'Demon',
  'Mage',
  'Ninja',
  "Navi",
  'None',
  'Random',
  'Robot',
  'Samurai',
  'Vampire',
  'Werewolf',
  'Zombie',
] as const;

type StyleEnum = (typeof STYLE_ENUM)[number];
type PersonaEnum = (typeof PERSONA_ENUM)[number];


const iconFor = (label: string) => {
  // keep your playful look using a couple of icons
  if (['Clay', 'Watercolor', 'Expression'].includes(label)) return Wand2;
  if (['Astronaut', 'Robot', 'Animation'].includes(label)) return Sparkles;
  return Palette;
};

const TransformationControls: React.FC = () => {
  const {
    uploadedImage,
    transformedImages,     // Add this to check if transformed images exist
    generatedVideo,        // Add this to check if video exists
    setTransformedImages,   // new array-based setter (kept in your store update)
    setGeneratedVideo,
    setIsProcessing,
    setCurrentOperation,
    isProcessing,
  } = useTransformation();

  // Selected options (schema-aligned)
  const [selectedStyle, setSelectedStyle] = useState<StyleEnum>('Random');
  const [selectedPersona, setSelectedPersona] = useState<PersonaEnum>('Random');

  // Video generation state
  const [videoPrompt, setVideoPrompt] = useState<string>('');
  const [imageSource, setImageSource] = useState<'uploaded' | 'transformed'>('uploaded');
  const [videoOperationId, setVideoOperationId] = useState<string | null>(null);
  const [showVideoPlayer, setShowVideoPlayer] = useState(false);
  
  // Real-time preview state
  const [showRealtimeModal, setShowRealtimeModal] = useState(false);
  const [realtimeFormData, setRealtimeFormData] = useState<FormData | null>(null);

  const styleOptions = useMemo(
    () => STYLE_ENUM.map((s) => ({ id: s, label: s, icon: iconFor(s) })),
    []
  );

  const personaOptions = useMemo(
    () => PERSONA_ENUM.map((p) => ({ id: p, label: p, icon: iconFor(p) })),
    []
  );

  const handleTransform = async () => {
    if (!uploadedImage || isProcessing) return;

    try {
      setIsProcessing(true);
      setCurrentOperation('transform');

      // Call our updated API wrapper - returns string[]
      const urls = await transformImage(
        uploadedImage,
        'ui', // telemetry tag; backend ignores or uses for logging
        {
          style: selectedStyle,
          persona: selectedPersona,
          // sensible defaults from schema (optional to send explicitly)
          num_images: 1,
          aspect_ratio: 'match_input_image',
          output_format: 'png',
          preserve_outfit: true,
          preserve_background: false,
          safety_tolerance: 2,
        }
      );

      setTransformedImages(urls); // store the full array (legacy first image stays in sync)
    } catch (error) {
      console.error('Transformation failed:', error);
      alert('Transformation failed. Please try again.');
    } finally {
      setIsProcessing(false);
      setCurrentOperation(null);
    }
  };

  const handleRealtimeTransform = async () => {
    if (!uploadedImage || isProcessing) return;

    try {
      // Create FormData for real-time transformation
      const formData = new FormData();
      
      // Convert data URL to blob
      const response = await fetch(uploadedImage);
      const blob = await response.blob();
      formData.append('image', blob, 'image.png');
      
      // Add transformation options
      formData.append('options', JSON.stringify({
        style: selectedStyle,
        persona: selectedPersona,
        num_images: 1,
        aspect_ratio: 'match_input_image',
        output_format: 'png',
        preserve_outfit: true,
        preserve_background: false,
        safety_tolerance: 2,
      }));

      setRealtimeFormData(formData);
      setShowRealtimeModal(true);
    } catch (error) {
      console.error('Failed to prepare real-time transformation:', error);
      alert('Failed to start real-time transformation. Please try again.');
    }
  };

  const handleRealtimeSuccess = (results: string[]) => {
    setTransformedImages(results);
    setShowRealtimeModal(false);
    setRealtimeFormData(null);
  };

  const handleGenerateVideo = async () => {
    if (!uploadedImage || !videoPrompt.trim() || isProcessing) return;
    
    // Check if transformed image is required but not available
    if (imageSource === 'transformed' && transformedImages.length === 0) {
      alert('Please transform an image first before generating a video from the transformed result.');
      return;
    }

    try {
      setIsProcessing(true);
      setCurrentOperation('video');

      // Use the appropriate image source
      const imageToUse = imageSource === 'transformed' ? transformedImages[0] : uploadedImage;
      
      const result = await generateVideo(imageToUse, videoPrompt.trim(), imageSource);
      setVideoOperationId(result.operationId);
      
      console.log('Video generation started with operation ID:', result.operationId);
      
      // Start polling for video generation results
      pollForVideoResult(result.operationId);
      
    } catch (error) {
      console.error('Video generation failed:', error);
      alert('Video generation failed. Please try again.');
      setIsProcessing(false);
      setCurrentOperation(null);
    }
  };

  const pollForVideoResult = async (operationId: string) => {
    try {
      console.log('Starting to poll for video result:', operationId);
      const operation = await pollOperationStatus(operationId);
      
      if (operation.status === 'completed' && operation.result) {
        console.log('Video generation completed!', operation.result);
        
        // Set the generated video URL
        const videoUrl = Array.isArray(operation.result) ? operation.result[0] : operation.result;
        setGeneratedVideo(videoUrl);
        setShowVideoPlayer(true);
        
        console.log('Video generation completed successfully!');
      } else if (operation.status === 'failed') {
        throw new Error(operation.error || 'Video generation failed');
      }
    } catch (error) {
      console.error('Video polling failed:', error);
      alert('Video generation failed. Please try again.');
    } finally {
      setIsProcessing(false);
      setCurrentOperation(null);
      setVideoOperationId(null);
    }
  };

  return (
    <div className="p-6 h-full flex flex-col">
      <h2 className="text-xl font-bold text-black mb-4" style={{ fontFamily: 'Wedges, Inter, sans-serif' }}>
        AI Transformations
      </h2>

      {!uploadedImage ? (
        <div className="flex-1 flex items-center justify-center border-2 border-dashed border-gray-300 rounded-lg">
          <div className="text-center">
            <Wand2 className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-600">Upload an image first</p>
          </div>
        </div>
      ) : (
        <div className="flex-1 space-y-6 overflow-y-auto">
          {/* Image Transformation Section */}
          <div className="space-y-3">
            <h3 className="font-semibold text-black flex items-center">
              <Sparkles className="w-4 h-4 mr-2" />
              Transform Image
            </h3>

            {/* Styles */}
            <div className="space-y-2">
              <div className="text-sm font-semibold">Style</div>
              <div className="grid grid-cols-1 gap-2">
                {styleOptions.map((option) => {
                  const Icon = option.icon;
                  return (
                    <button
                      key={option.id}
                      onClick={() => setSelectedStyle(option.id as StyleEnum)}
                      disabled={isProcessing}
                      className={`
                        p-3 rounded-lg border-2 text-left transition-all font-medium
                        ${selectedStyle === option.id
                          ? 'bg-[#c6c2e6] border-[#c6c2e6] text-black shadow-[4px_4px_0px_0px_#000000]'
                          : 'bg-white border-gray-300 text-black hover:border-[#c6c2e6] hover:bg-[#c6c2e6]/10'}
                        ${isProcessing ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                      `}
                    >
                      <div className="flex items-center">
                        <Icon className="w-4 h-4 mr-2" />
                        <span className="text-sm">{option.label}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Personas */}
            <div className="space-y-2">
              <div className="text-sm font-semibold">Persona</div>
              <div className="grid grid-cols-1 gap-2">
                {personaOptions.map((option) => {
                  const Icon = option.icon;
                  return (
                    <button
                      key={option.id}
                      onClick={() => setSelectedPersona(option.id as PersonaEnum)}
                      disabled={isProcessing}
                      className={`
                        p-3 rounded-lg border-2 text-left transition-all font-medium
                        ${selectedPersona === option.id
                          ? 'bg-[#c6c2e6] border-[#c6c2e6] text-black shadow-[4px_4px_0px_0px_#000000]'
                          : 'bg-white border-gray-300 text-black hover:border-[#c6c2e6] hover:bg-[#c6c2e6]/10'}
                        ${isProcessing ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                      `}
                    >
                      <div className="flex items-center">
                        <Icon className="w-4 h-4 mr-2" />
                        <span className="text-sm">{option.label}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Transform Buttons */}
            <div className="space-y-3">
              {/* Real-time Transform Button */}
              <button
                onClick={handleRealtimeTransform}
                disabled={isProcessing}
                className="w-full bg-gradient-to-r from-purple-500 to-blue-500 text-white py-3 px-4 rounded-lg font-semibold border-2 border-black shadow-[4px_4px_0px_0px_#000000] hover:shadow-[2px_2px_0px_0px_#000000] hover:translate-x-[2px] hover:translate-y-[2px] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-[4px_4px_0px_0px_#000000] disabled:hover:translate-x-0 disabled:hover:translate-y-0"
              >
                <div className="flex items-center justify-center">
                  <Zap className="w-4 h-4 mr-2" />
                  Real-time Preview
                </div>
              </button>

              {/* Regular Transform Button */}
              <button
                onClick={handleTransform}
                disabled={isProcessing}
                className="w-full bg-[#c6c2e6] text-black py-3 px-4 rounded-lg font-semibold border-2 border-black shadow-[4px_4px_0px_0px_#000000] hover:shadow-[2px_2px_0px_0px_#000000] hover:translate-x-[2px] hover:translate-y-[2px] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-[4px_4px_0px_0px_#000000] disabled:hover:translate-x-0 disabled:hover:translate-y-0"
              >
                <div className="flex items-center justify-center">
                  <Clock className="w-4 h-4 mr-2" />
                  Regular Transform
                </div>
              </button>
            </div>
          </div>

          {/* Video Generation Section - Kling v1.6 */}
          <div className="space-y-3">
            <h3 className="font-semibold text-black flex items-center">
              <Video className="w-4 h-4 mr-2" />
              Generate Video (Kling v1.6)
            </h3>

            {/* Image Source Selection */}
            <div className="space-y-2">
              <div className="text-sm font-semibold">Image Source</div>
              <div className="space-y-2">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="radio"
                    name="imageSource"
                    value="uploaded"
                    checked={imageSource === 'uploaded'}
                    onChange={(e) => setImageSource(e.target.value as 'uploaded' | 'transformed')}
                    disabled={isProcessing}
                    className="text-[#6c8b3a] focus:ring-[#6c8b3a] disabled:opacity-50"
                  />
                  <span className="text-sm text-black">Use uploaded image</span>
                </label>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="radio"
                    name="imageSource"
                    value="transformed"
                    checked={imageSource === 'transformed'}
                    onChange={(e) => setImageSource(e.target.value as 'uploaded' | 'transformed')}
                    disabled={isProcessing || transformedImages.length === 0}
                    className="text-[#6c8b3a] focus:ring-[#6c8b3a] disabled:opacity-50"
                  />
                  <span className={`text-sm ${transformedImages.length === 0 ? 'text-gray-400' : 'text-black'}`}>
                    Use transformed image {transformedImages.length === 0 ? '(transform an image first)' : ''}
                  </span>
                </label>
              </div>
            </div>

            {/* Video Prompt Input */}
            <div className="space-y-2">
              <div className="text-sm font-semibold">Video Description</div>
              <textarea
                value={videoPrompt}
                onChange={(e) => setVideoPrompt(e.target.value)}
                disabled={isProcessing}
                placeholder="Describe the video you want to create (e.g., 'a portrait photo of a person with flowing hair underwater')"
                className="w-full p-3 border-2 border-gray-300 rounded-lg resize-none h-20 text-sm disabled:opacity-50 disabled:cursor-not-allowed focus:border-[#6c8b3a] focus:outline-none"
                maxLength={200}
              />
              <div className="text-xs text-gray-500 text-right">
                {videoPrompt.length}/200 characters
              </div>
            </div>

            <button
              onClick={handleGenerateVideo}
              disabled={!videoPrompt.trim() || isProcessing || (imageSource === 'transformed' && transformedImages.length === 0)}
              className="w-full bg-[#6c8b3a] text-white py-3 px-4 rounded-lg font-semibold border-2 border-black shadow-[4px_4px_0px_0px_#000000] hover:shadow-[2px_2px_0px_0px_#000000] hover:translate-x-[2px] hover:translate-y-[2px] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-[4px_4px_0px_0px_#000000] disabled:hover:translate-x-0 disabled:hover:translate-y-0"
            >
              <div className="flex items-center justify-center">
                <Video className="w-4 h-4 mr-2" />
                {isProcessing && videoOperationId ? 'Generating Video...' : 'Generate Video'}
              </div>
            </button>
            
            {/* Video Generation Progress */}
            {isProcessing && videoOperationId && (
              <div className="mt-3 p-3 bg-yellow-50 border-2 border-yellow-300 rounded-lg">
                <div className="flex items-center space-x-2 mb-2">
                  <Clock className="w-4 h-4 text-yellow-600" />
                  <span className="text-sm font-medium text-yellow-800">
                    Video generation in progress...
                  </span>
                </div>
                <div className="text-xs text-yellow-700">
                  Operation ID: {videoOperationId}
                </div>
                <div className="text-xs text-yellow-600 mt-1">
                  This may take 2-5 minutes. Please wait...
                </div>
              </div>
            )}

            {/* Show Generated Video Button */}
            {generatedVideo && !isProcessing && (
              <button
                onClick={() => setShowVideoPlayer(true)}
                className="w-full bg-purple-500 text-white py-3 px-4 rounded-lg font-semibold border-2 border-black shadow-[4px_4px_0px_0px_#000000] hover:shadow-[2px_2px_0px_0px_#000000] hover:translate-x-[2px] hover:translate-y-[2px] transition-all mt-2"
              >
                <div className="flex items-center justify-center">
                  <Video className="w-4 h-4 mr-2" />
                  View Generated Video
                </div>
              </button>
            )}
          </div>
        </div>
      )}
      
      {/* Real-time Transform Modal */}
      <RealtimeTransformModal
        isOpen={showRealtimeModal}
        onClose={() => {
          setShowRealtimeModal(false);
          setRealtimeFormData(null);
        }}
        formData={realtimeFormData}
        onSuccess={handleRealtimeSuccess}
      />
      
      {/* Video Player Modal */}
      <VideoPlayer
        videoUrl={generatedVideo}
        isVisible={showVideoPlayer}
        onClose={() => setShowVideoPlayer(false)}
      />
    </div>
  );
};

export default TransformationControls;
