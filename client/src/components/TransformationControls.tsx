import React, { useState } from 'react';
import { useTransformation } from '../lib/stores/useTransformation';
import { Wand2, Video, Sparkles, Palette } from 'lucide-react';
import { transformImage, generateVideo } from '../lib/replicate';

const TransformationControls: React.FC = () => {
  const { 
    uploadedImage, 
    setTransformedImage, 
    setGeneratedVideo, 
    setIsProcessing, 
    setCurrentOperation,
    isProcessing 
  } = useTransformation();

  const [selectedTransform, setSelectedTransform] = useState<string>('');
  const [selectedVideoStyle, setSelectedVideoStyle] = useState<string>('');

  const transformOptions = [
    { id: 'Lego', label: 'Lego Portrait', icon: Palette },
    { id: '90s Cartoon', label: 'Cartoon Character from the 90s', icon: Sparkles },
    { id: 'Clay', label: 'Clay Character', icon: Wand2 },
    { id: 'Gothic', label: 'Gophic Character', icon: Palette },
    { id: 'Pixel Art', label: 'Pixel Character', icon: Palette },
    { id: 'Toy Doll', label: 'Toy Doll Character', icon: Sparkles },
    { id: 'Watercolor Cartoon', label: 'Cartoon Character in Watercolor', icon: Wand2 },
    { id: 'Random', label: 'Random Style', icon: Palette },
    { id: 'Angel', label: 'Angel Character Portrait', icon: Palette },
    { id: 'Astronaut', label: 'Astronaut in Space Character', icon: Sparkles },
    { id: 'Demon', label: 'Demon Character', icon: Wand2 },
    { id: 'Ninja', label: 'Ninja Character', icon: Palette },
    { id: 'Na vi Art', label: 'Na vi Character', icon: Palette },
    { id: 'Robot', label: 'Robot Style Character', icon: Sparkles },
    { id: 'Vampire', label: 'Vampire', icon: Wand2 }, 
    { id: 'Zombie', label: 'Zombie Character', icon: Wand2 },
    { id: 'Werewolf', label: 'Warewolf Character', icon: Palette },
  ];

  const videoOptions = [
    { id: 'talking', label: 'Talking Portrait', icon: Video },
    { id: 'animation', label: 'Character Animation', icon: Sparkles },
    { id: 'expression', label: 'Expression Change', icon: Wand2 },
  ];

  const handleTransform = async () => {
    if (!uploadedImage || !selectedTransform || isProcessing) return;

    try {
      setIsProcessing(true);
      setCurrentOperation('transform');
      
      const result = await transformImage(uploadedImage, selectedTransform);
      setTransformedImage(result);
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
            <p className="text-gray-600">
              Upload an image first
            </p>
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
            
            <div className="grid grid-cols-1 gap-2">
              {transformOptions.map((option) => {
                const Icon = option.icon;
                return (
                  <button
                    key={option.id}
                    onClick={() => setSelectedTransform(option.id)}
                    disabled={isProcessing}
                    className={`
                      p-3 rounded-lg border-2 text-left transition-all font-medium
                      ${selectedTransform === option.id
                        ? 'bg-[#c6c2e6] border-[#c6c2e6] text-black shadow-[4px_4px_0px_0px_#000000]'
                        : 'bg-white border-gray-300 text-black hover:border-[#c6c2e6] hover:bg-[#c6c2e6]/10'
                      }
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
              onClick={handleTransform}
              disabled={!selectedTransform || isProcessing}
              className="w-full bg-[#c6c2e6] text-black py-3 px-4 rounded-lg font-semibold border-2 border-black shadow-[4px_4px_0px_0px_#000000] hover:shadow-[2px_2px_0px_0px_#000000] hover:translate-x-[2px] hover:translate-y-[2px] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-[4px_4px_0px_0px_#000000] disabled:hover:translate-x-0 disabled:hover:translate-y-0"
            >
              <div className="flex items-center justify-center">
                <Wand2 className="w-4 h-4 mr-2" />
                Transform Image
              </div>
            </button>
          </div>

          {/* Video Generation Section */}
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
                        : 'bg-white border-gray-300 text-black hover:border-[#6c8b3a] hover:bg-[#6c8b3a]/10'
                      }
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
