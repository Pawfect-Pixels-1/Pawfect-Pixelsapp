import React, { useState, useEffect } from 'react';
import { useRealtimeTransform, TransformationProgress } from '../hooks/useRealtimeTransform';
import { RealtimePreview } from './RealtimePreview';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { AlertCircle, Wifi, WifiOff, X } from 'lucide-react';
import { Alert, AlertDescription } from './ui/alert';

interface RealtimeTransformModalProps {
  isOpen: boolean;
  onClose: () => void;
  formData: FormData | null;
  onSuccess?: (results: string[]) => void;
}

export function RealtimeTransformModal({
  isOpen,
  onClose,
  formData,
  onSuccess
}: RealtimeTransformModalProps) {
  const {
    isConnected,
    connectionError,
    transformations,
    startTransformation,
    getTransformation,
    clearTransformation
  } = useRealtimeTransform();

  const [currentOperationId, setCurrentOperationId] = useState<string | null>(null);
  const [hasStarted, setHasStarted] = useState(false);

  const currentTransformation = currentOperationId ? getTransformation(currentOperationId) : null;

  // Start transformation when modal opens and formData is available
  useEffect(() => {
    if (isOpen && formData && !hasStarted && isConnected) {
      setHasStarted(true);
      startTransformation(formData)
        .then((result) => {
          if (result.success) {
            setCurrentOperationId(result.operationId);
          }
        })
        .catch((error) => {
          console.error('Failed to start transformation:', error);
          // We'll handle this in the connection error display
        });
    }
  }, [isOpen, formData, hasStarted, isConnected, startTransformation]);

  // Handle transformation completion
  useEffect(() => {
    if (currentTransformation?.status === 'completed' && currentTransformation.results) {
      if (onSuccess) {
        onSuccess(currentTransformation.results);
      }
    }
  }, [currentTransformation, onSuccess]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setHasStarted(false);
      if (currentOperationId) {
        clearTransformation(currentOperationId);
        setCurrentOperationId(null);
      }
    }
  }, [isOpen, currentOperationId, clearTransformation]);

  const handleClose = () => {
    if (currentOperationId) {
      clearTransformation(currentOperationId);
    }
    setCurrentOperationId(null);
    setHasStarted(false);
    onClose();
  };

  const handleDownload = (url: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = `portrait_transformation_${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              Real-time Portrait Transformation
              <Badge variant="outline" className="flex items-center gap-1">
                {isConnected ? (
                  <>
                    <Wifi className="h-3 w-3 text-green-500" />
                    Connected
                  </>
                ) : (
                  <>
                    <WifiOff className="h-3 w-3 text-red-500" />
                    Disconnected
                  </>
                )}
              </Badge>
            </DialogTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClose}
              className="h-8 w-8 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          {/* Connection Error */}
          {connectionError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {connectionError}
              </AlertDescription>
            </Alert>
          )}

          {/* Not Connected Warning */}
          {!isConnected && !connectionError && (
            <Alert>
              <WifiOff className="h-4 w-4" />
              <AlertDescription>
                Connecting to real-time service...
              </AlertDescription>
            </Alert>
          )}

          {/* Waiting to Start */}
          {isConnected && !hasStarted && (
            <div className="text-center py-8 text-gray-500">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
              Preparing transformation...
            </div>
          )}

          {/* Current Transformation */}
          {currentTransformation && (
            <RealtimePreview
              transformation={currentTransformation}
              onDownload={handleDownload}
              className="border-0 shadow-none bg-transparent"
            />
          )}

          {/* No Active Transformation */}
          {hasStarted && !currentTransformation && isConnected && (
            <div className="text-center py-8 text-gray-500">
              <AlertCircle className="h-8 w-8 mx-auto mb-2 text-yellow-500" />
              <p>Transformation failed to start. Please try again.</p>
              <Button 
                variant="outline" 
                onClick={handleClose}
                className="mt-4"
              >
                Close and Retry
              </Button>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end gap-2 pt-4 border-t">
            {currentTransformation?.status === 'completed' ? (
              <Button onClick={handleClose} className="bg-green-600 hover:bg-green-700">
                Done
              </Button>
            ) : (
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}