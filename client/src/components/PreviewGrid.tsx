import React from 'react';
import { useTransformation } from '../lib/stores/useTransformation';
import { Eye, Download } from 'lucide-react';
import { ShareButton } from './ShareButton';

const PreviewGrid: React.FC = () => {
  const { 
    uploadedImage, 
    transformedImage, 
    generatedVideo, 
    isProcessing 
  } = useTransformation();

  const hasContent = uploadedImage || transformedImage || generatedVideo;
  
  console.log('🖼️ PreviewGrid state:', {
    hasUploadedImage: !!uploadedImage,
    hasTransformedImage: !!transformedImage,
    hasGeneratedVideo: !!generatedVideo,
    hasContent
  });

  return (
    <div className="p-6 h-full flex flex-col">
      <h2 className="text-xl font-bold text-black mb-4" style={{ fontFamily: 'Wedges, Inter, sans-serif' }}>
        Preview
      </h2>
      
      {!hasContent ? (
        <div className="flex-1 flex items-center justify-center border-2 border-dashed border-gray-300 rounded-lg">
          <div className="text-center">
            <Eye className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-600">
              Upload an image to see preview
            </p>
          </div>
        </div>
      ) : (
        <div className="flex-1 space-y-4 overflow-y-auto">
          
          {/* Original Preview */}
          {uploadedImage && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-black uppercase tracking-wide">
                Original
              </h3>
              <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden border-2 border-black">
                <img 
                  src={uploadedImage} 
                  alt="Original" 
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          )}

          {/* Transformed Preview */}
          {transformedImage && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-black uppercase tracking-wide">
                  Transformed
                </h3>
                <div className="flex items-center gap-2">
                  <ShareButton
                    contentUrl={transformedImage}
                    contentType="image"
                    title="Check out my AI-transformed portrait!"
                    description="Created with Portrait Studio's AI transformation"
                    onShare={(platform) => console.log(`Shared transformed image to ${platform}`)}
                  />
                  <button
                    onClick={() => {
                      const link = document.createElement('a');
                      link.href = transformedImage;
                      link.download = 'transformed-portrait.png';
                      link.click();
                    }}
                    className="p-1 bg-[#10B981] text-white rounded border border-black hover:bg-[#0D9488] transition-colors"
                    title="Download transformed image"
                  >
                    <Download className="w-3 h-3" />
                  </button>
                </div>
              </div>
              <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden border-2 border-black">
                <img 
                  src={transformedImage} 
                  alt="Transformed" 
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          )}

          {/* Video Preview */}
          {generatedVideo && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-black uppercase tracking-wide">
                  Video
                </h3>
                <div className="flex items-center gap-2">
                  <ShareButton
                    contentUrl={generatedVideo}
                    contentType="video"
                    title="Check out my AI-generated video!"
                    description="Created with Portrait Studio's AI video generation"
                    onShare={(platform) => console.log(`Shared generated video to ${platform}`)}
                  />
                  <button
                    onClick={() => {
                      const link = document.createElement('a');
                      link.href = generatedVideo;
                      link.download = 'generated-video.mp4';
                      link.click();
                    }}
                    className="p-1 bg-[#F59E0B] text-white rounded border border-black hover:bg-[#D97706] transition-colors"
                    title="Download generated video"
                  >
                    <Download className="w-3 h-3" />
                  </button>
                </div>
              </div>
              <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden border-2 border-black">
                <video 
                  src={generatedVideo} 
                  controls 
                  className="w-full h-full object-cover"
                  loop
                  muted
                />
              </div>
            </div>
          )}

          {/* Processing Indicator */}
          {isProcessing && (
            <div className="bg-[#6c8b3a]/10 border-2 border-[#6c8b3a] rounded-lg p-4">
              <div className="flex items-center">
                <div className="animate-spin w-4 h-4 border-2 border-[#6c8b3a] border-t-transparent rounded-full mr-3"></div>
                <span className="text-sm font-medium text-black">
                  Processing...
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default PreviewGrid;
