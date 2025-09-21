import React, { useEffect, useState } from 'react';
import { X, Loader } from 'lucide-react';

interface RealtimeTransformModalProps {
  isOpen: boolean;
  onClose: () => void;
  formData: FormData | null;
  onSuccess: (results: string[]) => void;
}

export const RealtimeTransformModal: React.FC<RealtimeTransformModalProps> = ({
  isOpen,
  onClose,
  formData,
  onSuccess,
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (isOpen && formData) {
      performRealtimeTransform();
    }
  }, [isOpen, formData]);

  const performRealtimeTransform = async () => {
    if (!formData) return;

    try {
      setIsProcessing(true);
      setProgress(0);

      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setProgress(prev => Math.min(prev + 10, 90));
      }, 500);

      const response = await fetch('/api/transform-realtime', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      clearInterval(progressInterval);

      if (!response.ok) {
        throw new Error('Transformation failed');
      }

      const result = await response.json();
      
      if (result.success) {
        setProgress(100);
        setTimeout(() => {
          onSuccess(result.transformedImages || [result.transformedImage]);
        }, 500);
      } else {
        throw new Error(result.error || 'Transformation failed');
      }
    } catch (error) {
      console.error('Real-time transformation failed:', error);
      alert('Real-time transformation failed. Please try again.');
      onClose();
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 border-2 border-black shadow-[8px_8px_0px_0px_#000000]">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-black">Real-time Preview</h3>
          <button
            onClick={onClose}
            disabled={isProcessing}
            className="text-gray-500 hover:text-gray-700 disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-center py-8">
            <Loader className="w-8 h-8 animate-spin text-purple-500" />
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Processing...</span>
              <span>{progress}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-purple-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          <p className="text-sm text-gray-600 text-center">
            Creating your real-time transformation preview...
          </p>
        </div>
      </div>
    </div>
  );
};