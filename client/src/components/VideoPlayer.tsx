import React from 'react';
import { Download, X } from 'lucide-react';

interface VideoPlayerProps {
  videoUrl: string | null;
  onClose: () => void;
  isVisible: boolean;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  videoUrl,
  onClose,
  isVisible,
}) => {
  const handleDownload = () => {
    if (videoUrl) {
      const link = document.createElement('a');
      link.href = videoUrl;
      link.download = `generated-video-${Date.now()}.mp4`;
      link.click();
    }
  };

  if (!isVisible || !videoUrl) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-4xl w-full mx-4 border-2 border-black shadow-[8px_8px_0px_0px_#000000]">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-black">Generated Video Preview</h3>
          <div className="flex space-x-2">
            <button
              onClick={handleDownload}
              className="bg-[#6c8b3a] text-white p-2 rounded-lg hover:bg-[#5a7832] transition-colors border-2 border-black shadow-[2px_2px_0px_0px_#000000]"
              title="Download Video"
            >
              <Download className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 p-2"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="space-y-4">
          <video
            src={videoUrl}
            controls
            autoPlay
            muted
            className="w-full max-h-[70vh] rounded-lg border-2 border-gray-300"
            style={{ aspectRatio: '16/9' }}
          >
            <source src={videoUrl} type="video/mp4" />
            Your browser does not support the video tag.
          </video>

          <div className="flex justify-center space-x-4">
            <button
              onClick={handleDownload}
              className="bg-[#6c8b3a] text-white py-2 px-4 rounded-lg font-semibold border-2 border-black shadow-[4px_4px_0px_0px_#000000] hover:shadow-[2px_2px_0px_0px_#000000] hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
            >
              <div className="flex items-center">
                <Download className="w-4 h-4 mr-2" />
                Download Video
              </div>
            </button>
            <button
              onClick={onClose}
              className="bg-gray-300 text-black py-2 px-4 rounded-lg font-semibold border-2 border-black shadow-[4px_4px_0px_0px_#000000] hover:shadow-[2px_2px_0px_0px_#000000] hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};