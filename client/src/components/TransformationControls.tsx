import React, { useMemo, useState } from 'react';
import { Wand2, Video, Sparkles, Palette } from 'lucide-react';

// Store + API
import { useTransformation } from '../lib/stores/useTransformation';
import { transformImage, generateVideo } from '../lib/replicate';

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

const videoOptions = [
  { id: 'talking', label: 'Talking Portrait', icon: Video },
  { id: 'animation', label: 'Character Animation', icon: Sparkles },
  { id: 'expression', label: 'Expression Change', icon: Wand2 },
];

const iconFor = (label: string) => {
  // keep your playful look using a couple of icons
  if (['Clay', 'Watercolor', 'Expression'].includes(label)) return Wand2;
  if (['Astronaut', 'Robot', 'Animation'].includes(label)) return Sparkles;
  return Palette;
};

const TransformationControls: React.FC = () => {
  const {
    uploadedImage,
    setTransformedImages,   // new array-based setter (kept in your store update)
    setGeneratedVideo,
    setIsProcessing,
    setCurrentOperation,
    isProcessing,
  } = useTransformation();

  // Selected options (schema-aligned)
  const [selectedStyle, setSelectedStyle] = useState<StyleEnum>('Random');
  const [selectedPersona, setSelectedPersona] = useState<PersonaEnum>('Random');

  // Video style selection (unchanged)
  const [selectedVideoStyle, setSelectedVideoStyle] = useState<string>('');

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

  const handleGenerateVideo = async () => {
    if (!uploadedImage || !selectedVideoStyle || isProcessing) return;

    try {
      setIsProcessing(true);
      setCurrentOperation('video');

      const result = await generateVideo(uploadedImage, selectedVideoStyle);
      setGeneratedVideo(result);
    } catch (error) {
      console.error('Video generation failed:', error);
      alert('Video generation failed. Please try again.');
    } finally {
      setIsProcessing(false);
      setCurrentOperation(null);
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

            <button
              onClick={handleTransform}
              disabled={isProcessing}
              className="w-full bg-[#c6c2e6] text-black py-3 px-4 rounded-lg font-semibold border-2 border-black shadow-[4px_4px_0px_0px_#000000] hover:shadow-[2px_2px_0px_0px_#000000] hover:translate-x-[2px] hover:translate-y-[2px] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-[4px_4px_0px_0px_#000000] disabled:hover:translate-x-0 disabled:hover:translate-y-0"
            >
              <div className="flex items-center justify-center">
                <Wand2 className="w-4 h-4 mr-2" />
                Transform Image
              </div>
            </button>
          </div>

          {/* Video Generation Section (unchanged) */}
          <div className="space-y-3">
            <h3 className="font-semibold text-black flex items-center">
              <Video className="w-4 h-4 mr-2" />
              Generate Video
            </h3>

            <div className="grid grid-cols-1 gap-2">
              {videoOptions.map((option) => {
                const Icon = option.icon;
                return (
                  <button
                    key={option.id}
                    onClick={() => setSelectedVideoStyle(option.id)}
                    disabled={isProcessing}
                    className={`
                      p-3 rounded-lg border-2 text-left transition-all font-medium
                      ${selectedVideoStyle === option.id
                        ? 'bg-[#6c8b3a] border-[#6c8b3a] text-white shadow-[4px_4px_0px_0px_#000000]'
                        : 'bg-white border-gray-300 text-black hover:border-[#6c8b3a] hover:bg-[#6c8b3a]/10'}
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

            <button
              onClick={handleGenerateVideo}
              disabled={!selectedVideoStyle || isProcessing}
              className="w-full bg-[#6c8b3a] text-white py-3 px-4 rounded-lg font-semibold border-2 border-black shadow-[4px_4px_0px_0px_#000000] hover:shadow-[2px_2px_0px_0px_#000000] hover:translate-x-[2px] hover:translate-y-[2px] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-[4px_4px_0px_0px_#000000] disabled:hover:translate-x-0 disabled:hover:translate-y-0"
            >
              <div className="flex items-center justify-center">
                <Video className="w-4 h-4 mr-2" />
                Generate Video
              </div>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default TransformationControls;
