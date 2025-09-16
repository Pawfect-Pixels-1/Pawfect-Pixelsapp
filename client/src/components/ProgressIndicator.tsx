import React from 'react';
import { CheckCircle, Clock, AlertCircle } from 'lucide-react';

interface ProgressIndicatorProps {
  status: 'idle' | 'processing' | 'completed' | 'error';
  progress?: number;
  message?: string;
  operation?: string;
}

const ProgressIndicator: React.FC<ProgressIndicatorProps> = ({
  status,
  progress = 0,
  message,
  operation = 'Processing'
}) => {
  const getStatusIcon = () => {
    switch (status) {
      case 'processing':
        return <div className="animate-spin w-6 h-6 border-3 border-[#c6c2e6] border-t-transparent rounded-full" />;
      case 'completed':
        return <CheckCircle className="w-6 h-6 text-[#10B981]" />;
      case 'error':
        return <AlertCircle className="w-6 h-6 text-red-500" />;
      default:
        return <Clock className="w-6 h-6 text-gray-400" />;
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'processing':
        return 'border-[#c6c2e6] bg-[#c6c2e6]/10';
      case 'completed':
        return 'border-[#10B981] bg-[#10B981]/10';
      case 'error':
        return 'border-red-500 bg-red-50';
      default:
        return 'border-gray-300 bg-gray-50';
    }
  };

  if (status === 'idle') return null;

  return (
    <div className={`p-4 rounded-lg border-2 ${getStatusColor()} shadow-[4px_4px_0px_0px_#000000]`}>
      <div className="flex items-center space-x-3">
        {getStatusIcon()}
        <div className="flex-1">
          <p className="font-semibold text-black">
            {status === 'processing' && `${operation}...`}
            {status === 'completed' && 'Completed!'}
            {status === 'error' && 'Error occurred'}
          </p>
          {message && (
            <p className="text-sm text-gray-600 mt-1">{message}</p>
          )}
        </div>
      </div>
      
      {status === 'processing' && progress > 0 && (
        <div className="mt-3">
          <div className="w-full bg-gray-200 rounded-full h-2 border border-black">
            <div 
              className="bg-[#c6c2e6] h-full rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs text-gray-600 mt-1 text-right">{progress}%</p>
        </div>
      )}
    </div>
  );
};

export default ProgressIndicator;
