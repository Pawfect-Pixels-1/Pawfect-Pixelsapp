import React from 'react';
import { TransformationProgress } from '../hooks/useRealtimeTransform';
import { Progress } from './ui/progress';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { AlertCircle, CheckCircle, Clock, Download, Eye, X } from 'lucide-react';

interface RealtimePreviewProps {
  transformation: TransformationProgress;
  onClose?: () => void;
  onDownload?: (url: string) => void;
  className?: string;
}

export function RealtimePreview({ 
  transformation, 
  onClose, 
  onDownload,
  className = ""
}: RealtimePreviewProps) {
  const getStatusIcon = () => {
    switch (transformation.status) {
      case 'starting':
      case 'processing':
        return <Clock className="h-4 w-4 animate-spin" />;
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  const getStatusColor = () => {
    switch (transformation.status) {
      case 'starting':
        return 'bg-blue-500';
      case 'processing':
        return 'bg-yellow-500';
      case 'completed':
        return 'bg-green-500';
      case 'failed':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getElapsedTime = () => {
    if (!transformation.startTime) return '';
    const elapsed = Math.floor((Date.now() - transformation.startTime) / 1000);
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;
    return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
  };

  const handleDownload = (url: string) => {
    if (onDownload) {
      onDownload(url);
    } else {
      // Default download behavior
      const link = document.createElement('a');
      link.href = url;
      link.download = `transformed_${transformation.operationId}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  return (
    <Card className={`w-full max-w-2xl bg-white/95 backdrop-blur-sm border-2 shadow-lg ${className}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {getStatusIcon()}
            <CardTitle className="text-lg">
              Real-time Preview
            </CardTitle>
            <Badge variant="outline" className={getStatusColor()}>
              {transformation.status}
            </Badge>
          </div>
          {onClose && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-8 w-8 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">
              {transformation.message || 'Processing...'}
            </span>
            <span className="text-gray-500">
              {Math.round(transformation.progress)}%
            </span>
          </div>
          <Progress 
            value={transformation.progress} 
            className="h-2"
            // Add animated stripes for processing state
            style={{
              background: transformation.status === 'processing' 
                ? 'linear-gradient(45deg, rgba(255,255,255,.15) 25%, transparent 25%, transparent 50%, rgba(255,255,255,.15) 50%, rgba(255,255,255,.15) 75%, transparent 75%, transparent)'
                : undefined
            }}
          />
        </div>

        {/* Elapsed Time */}
        {transformation.startTime && (
          <div className="text-sm text-gray-500">
            Elapsed: {getElapsedTime()}
          </div>
        )}

        {/* Preview Image */}
        {transformation.previewUrl && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Eye className="h-4 w-4" />
              <span className="text-sm font-medium">Live Preview</span>
            </div>
            <div className="relative rounded-lg overflow-hidden bg-gray-100">
              <img
                src={transformation.previewUrl}
                alt="Live preview"
                className="w-full h-auto max-h-96 object-contain"
                onError={(e) => {
                  console.error('Preview image failed to load:', transformation.previewUrl);
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
              {transformation.status === 'processing' && (
                <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                  <div className="bg-white/90 rounded-full px-3 py-1 text-sm font-medium">
                    {Math.round(transformation.progress)}%
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Results */}
        {transformation.results && transformation.results.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Final Results</span>
              <Badge variant="outline" className="bg-green-50 text-green-700">
                {transformation.results.length} image{transformation.results.length > 1 ? 's' : ''}
              </Badge>
            </div>
            
            <div className="grid grid-cols-1 gap-3">
              {transformation.results.map((url, index) => (
                <div key={index} className="relative group rounded-lg overflow-hidden bg-gray-100">
                  <img
                    src={url}
                    alt={`Result ${index + 1}`}
                    className="w-full h-auto max-h-64 object-contain"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all duration-200 flex items-center justify-center opacity-0 group-hover:opacity-100">
                    <Button
                      size="sm"
                      onClick={() => handleDownload(url)}
                      className="bg-white text-black hover:bg-gray-100"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Download
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Error State */}
        {transformation.error && (
          <div className="rounded-lg bg-red-50 border border-red-200 p-3">
            <div className="flex items-center gap-2 text-red-700">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm font-medium">Error</span>
            </div>
            <p className="text-sm text-red-600 mt-1">
              {transformation.error}
            </p>
          </div>
        )}

        {/* Operation Info */}
        <div className="text-xs text-gray-400 font-mono">
          ID: {transformation.operationId}
        </div>
      </CardContent>
    </Card>
  );
}