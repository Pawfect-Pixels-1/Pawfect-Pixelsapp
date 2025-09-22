import React, { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import 'react-easy-crop/react-easy-crop.css';
import { RotateCw, Check, X, Crop } from 'lucide-react';
import { Card } from './ui/card';

interface ImageEditorProps {
  image: string;
  onSave: (editedImage: string) => void;
  onCancel: () => void;
}

interface CropArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function ImageEditor({ image, onSave, onCancel }: ImageEditorProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<CropArea | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const onCropComplete = useCallback(
    (croppedArea: any, croppedAreaPixels: CropArea) => {
      setCroppedAreaPixels(croppedAreaPixels);
    },
    []
  );

  const onMediaLoaded = useCallback((mediaSize: any) => {
    // Initialize with full image crop to enable save button immediately
    setCroppedAreaPixels({
      x: 0,
      y: 0,
      width: mediaSize.naturalWidth,
      height: mediaSize.naturalHeight
    });
  }, []);

  const createImage = (url: string): Promise<HTMLImageElement> =>
    new Promise((resolve, reject) => {
      const image = new Image();
      image.addEventListener('load', () => resolve(image));
      image.addEventListener('error', (error) => reject(error));
      image.setAttribute('crossOrigin', 'anonymous');
      image.src = url;
    });

  const getCroppedImg = async (
    imageSrc: string,
    pixelCrop: CropArea,
    rotation = 0
  ): Promise<string> => {
    const image = await createImage(imageSrc);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      throw new Error('Could not get canvas context');
    }

    const maxSize = Math.max(image.width, image.height);
    const safeArea = 2 * ((maxSize / 2) * Math.sqrt(2));

    canvas.width = safeArea;
    canvas.height = safeArea;

    ctx.translate(safeArea / 2, safeArea / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.translate(-safeArea / 2, -safeArea / 2);

    ctx.drawImage(
      image,
      safeArea / 2 - image.width * 0.5,
      safeArea / 2 - image.height * 0.5
    );

    const data = ctx.getImageData(0, 0, safeArea, safeArea);

    canvas.width = pixelCrop.width;
    canvas.height = pixelCrop.height;

    ctx.putImageData(
      data,
      Math.round(0 - safeArea / 2 + image.width * 0.5 - pixelCrop.x),
      Math.round(0 - safeArea / 2 + image.height * 0.5 - pixelCrop.y)
    );

    return canvas.toDataURL('image/jpeg', 0.9);
  };

  const handleSave = async () => {
    if (!croppedAreaPixels) return;

    try {
      setIsProcessing(true);
      const croppedImage = await getCroppedImg(image, croppedAreaPixels, rotation);
      onSave(croppedImage);
    } catch (error) {
      console.error('Error creating cropped image:', error);
      alert('Failed to process image. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  const handleReset = () => {
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setRotation(0);
  };

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-4xl h-full max-h-[90vh] flex flex-col border-2 border-black shadow-[8px_8px_0px_0px_#000000]">
        {/* Header */}
        <div className="p-4 border-b-2 border-black bg-[#c6c2e6]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Crop className="w-5 h-5" />
              <h2 className="text-lg font-bold text-black" style={{ fontFamily: 'Wedges, Inter, sans-serif' }}>
                Edit Image
              </h2>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleReset}
                className="px-3 py-1 text-sm bg-gray-200 text-black rounded border border-black hover:bg-gray-300 transition-colors"
              >
                Reset
              </button>
            </div>
          </div>
        </div>

        {/* Editor Area */}
        <div className="flex-1 relative bg-gray-900">
          <Cropper
            image={image}
            crop={crop}
            zoom={zoom}
            rotation={rotation}
            aspect={undefined}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
            onMediaLoaded={onMediaLoaded}
            style={{
              containerStyle: {
                width: '100%',
                height: '100%',
                position: 'relative',
              },
            }}
          />
        </div>

        {/* Controls */}
        <div className="p-4 border-t-2 border-black bg-[#fffdf5]">
          <div className="flex flex-col gap-4">
            {/* Zoom Control */}
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-black min-w-[60px]">Zoom:</span>
              <input
                type="range"
                value={zoom}
                min={1}
                max={3}
                step={0.1}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
              />
              <span className="text-sm text-gray-600 min-w-[40px]">{zoom.toFixed(1)}x</span>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-between">
              <div className="flex gap-2">
                <button
                  onClick={handleRotate}
                  className="flex items-center gap-2 px-4 py-2 bg-[#F59E0B] text-black rounded-lg font-semibold border-2 border-black shadow-[4px_4px_0px_0px_#000000] hover:shadow-[2px_2px_0px_0px_#000000] hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
                >
                  <RotateCw className="w-4 h-4" />
                  Rotate
                </button>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={onCancel}
                  className="flex items-center gap-2 px-6 py-2 bg-gray-200 text-black rounded-lg font-semibold border-2 border-black shadow-[4px_4px_0px_0px_#000000] hover:shadow-[2px_2px_0px_0px_#000000] hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
                >
                  <X className="w-4 h-4" />
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={isProcessing || !croppedAreaPixels}
                  className="flex items-center gap-2 px-6 py-2 bg-[#10B981] text-white rounded-lg font-semibold border-2 border-black shadow-[4px_4px_0px_0px_#000000] hover:shadow-[2px_2px_0px_0px_#000000] hover:translate-x-[2px] hover:translate-y-[2px] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-[4px_4px_0px_0px_#000000] disabled:hover:translate-x-0 disabled:hover:translate-y-0"
                >
                  <Check className="w-4 h-4" />
                  {isProcessing ? 'Processing...' : 'Apply Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}