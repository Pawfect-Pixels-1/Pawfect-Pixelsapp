import React, { useState, useCallback, useMemo, useRef, useEffect } from "react";
import Cropper, { Area, MediaSize } from "react-easy-crop";
import "react-easy-crop/react-easy-crop.css";
import { RotateCw, Check, X, Crop, FlipHorizontal, FlipVertical, Image as ImageIcon } from "lucide-react";
import { Card } from "./ui/card";

/** ────────────────────────────────────────────────────────────────────────────
 * Props & types
 * ────────────────────────────────────────────────────────────────────────────*/
interface ImageEditorProps {
  image: string;                           // data URL or remote URL
  onSave: (editedImage: string) => void;   // returns a data URL
  onCancel: () => void;

  /** Optional tunables (all have sensible defaults) */
  initialZoom?: number;
  initialRotation?: number;                // in degrees
  aspect?: number | "free";                // e.g., 1, 4/5, 16/9, "free"
  outputMime?: "image/jpeg" | "image/png" | "image/webp";
  outputQuality?: number;                  // 0..1 (for lossy mimes)
  maxOutputWidth?: number;                 // clamp final width
  maxOutputHeight?: number;                // clamp final height
}

/** Utility: load image with CORS safe settings */
async function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/** Utility: crop+rotate+flip, returns dataURL */
async function cropImage(options: {
  src: string;
  crop: Area;               // pixels
  rotationDeg: number;      // degrees
  flipX: boolean;
  flipY: boolean;
  mime: ImageEditorProps["outputMime"];
  quality: number;
  maxW?: number;
  maxH?: number;
}): Promise<string> {
  const { src, crop, rotationDeg, flipX, flipY, mime = "image/jpeg", quality = 0.9, maxW, maxH } = options;
  const img = await loadImage(src);

  // Create a large safe canvas to rotate without clipping
  const maxSide = Math.max(img.width, img.height);
  const safeSize = Math.ceil(2 * (maxSide / 2) * Math.sqrt(2));

  const safeCanvas = document.createElement("canvas");
  const sctx = safeCanvas.getContext("2d");
  if (!sctx) throw new Error("Canvas context unavailable");

  safeCanvas.width = safeSize;
  safeCanvas.height = safeSize;

  sctx.translate(safeSize / 2, safeSize / 2);
  sctx.rotate((rotationDeg * Math.PI) / 180);
  sctx.scale(flipX ? -1 : 1, flipY ? -1 : 1);
  sctx.drawImage(img, -img.width / 2, -img.height / 2);

  // Now extract the crop region from the rotated/flipped canvas
  const outCanvas = document.createElement("canvas");
  const octx = outCanvas.getContext("2d");
  if (!octx) throw new Error("Canvas context unavailable (out)");

  outCanvas.width = Math.max(1, Math.round(crop.width));
  outCanvas.height = Math.max(1, Math.round(crop.height));

  // The top-left of the crop window on the safe canvas:
  // Need to translate by how the original image ended up centered in the safe canvas.
  const offsetX = safeSize / 2 - img.width / 2;
  const offsetY = safeSize / 2 - img.height / 2;

  octx.drawImage(
    safeCanvas,
    Math.round(offsetX + crop.x),
    Math.round(offsetY + crop.y),
    Math.round(crop.width),
    Math.round(crop.height),
    0,
    0,
    Math.round(crop.width),
    Math.round(crop.height)
  );

  // Optional downscale to fit within maxW/maxH (keeps aspect)
  if ((maxW && outCanvas.width > maxW) || (maxH && outCanvas.height > maxH)) {
    const scale = Math.min(
      maxW ? maxW / outCanvas.width : 1,
      maxH ? maxH / outCanvas.height : 1
    );
    const resized = document.createElement("canvas");
    resized.width = Math.max(1, Math.round(outCanvas.width * scale));
    resized.height = Math.max(1, Math.round(outCanvas.height * scale));
    const rctx = resized.getContext("2d");
    if (!rctx) throw new Error("Canvas context unavailable (resize)");
    rctx.imageSmoothingQuality = "high";
    rctx.drawImage(outCanvas, 0, 0, resized.width, resized.height);
    return resized.toDataURL(mime, quality);
  }

  return outCanvas.toDataURL(mime, quality);
}

/** Aspect presets used in the UI */
const ASPECT_PRESETS: Array<{ label: string; value: number | "free" }> = [
  { label: "Free", value: "free" },
  { label: "1:1", value: 1 },
  { label: "4:5", value: 4 / 5 },
  { label: "3:2", value: 3 / 2 },
  { label: "16:9", value: 16 / 9 },
  { label: "9:16", value: 9 / 16 },
];

export function ImageEditor({
  image,
  onSave,
  onCancel,
  initialZoom = 1,
  initialRotation = 0,
  aspect = "free",
  outputMime = "image/jpeg",
  outputQuality = 0.9,
  maxOutputWidth,
  maxOutputHeight,
}: ImageEditorProps) {
  const [crop, setCrop] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState<number>(initialZoom);
  const [rotation, setRotation] = useState<number>(initialRotation);
  const [flipX, setFlipX] = useState(false);
  const [flipY, setFlipY] = useState(false);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentAspect, setCurrentAspect] = useState<number | "free">(aspect);
  const [livePreview, setLivePreview] = useState<string | null>(null);

  const editorRef = useRef<HTMLDivElement>(null);

  // Enable wheel zoom (nice UX)
  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return; // pinch-to-zoom style (hold Ctrl/Cmd)
      e.preventDefault();
      setZoom((z) => {
        const next = e.deltaY > 0 ? z - 0.1 : z + 0.1;
        return Math.min(3, Math.max(1, parseFloat(next.toFixed(2))));
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
      if (e.key.toLowerCase() === "r") setRotation((r) => (r + 90) % 360);
      if (e.key === "Enter") void handleSave();
      if (e.key === "ArrowUp") setCrop((c) => ({ ...c, y: c.y - 5 }));
      if (e.key === "ArrowDown") setCrop((c) => ({ ...c, y: c.y + 5 }));
      if (e.key === "ArrowLeft") setCrop((c) => ({ ...c, x: c.x - 5 }));
      if (e.key === "ArrowRight") setCrop((c) => ({ ...c, x: c.x + 5 }));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  const onCropComplete = useCallback((_a: Area, pixels: Area) => {
    setCroppedAreaPixels(pixels);
  }, []);

  const onMediaLoaded = useCallback((mediaSize: MediaSize) => {
    // Default to "full image" crop so save is enabled
    setCroppedAreaPixels({
      x: 0,
      y: 0,
      width: mediaSize.naturalWidth,
      height: mediaSize.naturalHeight,
    });
  }, []);

  const handleReset = () => {
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setRotation(0);
    setFlipX(false);
    setFlipY(false);
    setCurrentAspect(aspect);
  };

  const handleRotate = () => setRotation((prev) => (prev + 90) % 360);

  const effectiveAspect = useMemo(() => (currentAspect === "free" ? undefined : currentAspect), [currentAspect]);

  const handleSave = useCallback(async () => {
    if (!croppedAreaPixels) return;
    try {
      setIsProcessing(true);
      const dataUrl = await cropImage({
        src: image,
        crop: croppedAreaPixels,
        rotationDeg: rotation,
        flipX,
        flipY,
        mime: outputMime,
        quality: outputQuality,
        maxW: maxOutputWidth,
        maxH: maxOutputHeight,
      });
      onSave(dataUrl);
    } catch (err) {
      console.error(err);
      alert("Failed to process image. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  }, [croppedAreaPixels, flipX, flipY, image, maxOutputHeight, maxOutputWidth, onSave, outputMime, outputQuality, rotation]);

  // Live preview thumbnail (updates when crop params change)
  useEffect(() => {
    let aborted = false;
    (async () => {
      if (!croppedAreaPixels) return;
      try {
        const preview = await cropImage({
          src: image,
          crop: croppedAreaPixels,
          rotationDeg: rotation,
          flipX,
          flipY,
          mime: "image/jpeg",
          quality: 0.7,
          maxW: 240,
          maxH: 240,
        });
        if (!aborted) setLivePreview(preview);
      } catch {
        /* ignore preview errors */
      }
    })();
    return () => {
      aborted = true;
    };
  }, [image, croppedAreaPixels, rotation, flipX, flipY]);

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-5xl h-full max-h-[92vh] flex flex-col border-2 border-black shadow-[8px_8px_0px_0px_#000]">
        {/* Header */}
        <div className="p-4 border-b-2 border-black bg-[#c6c2e6]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Crop className="w-5 h-5" />
              <h2 className="font-title text-lg font-bold text-black">
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
        <div ref={editorRef} className="flex-1 relative bg-gray-900">
          <Cropper
            image={image}
            crop={crop}
            zoom={zoom}
            rotation={rotation}
            aspect={effectiveAspect}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onRotationChange={setRotation}
            onCropComplete={onCropComplete}
            onMediaLoaded={onMediaLoaded}
            restrictPosition={true}
            showGrid={true}
            objectFit="contain"
            zoomWithScroll={false} // we implement ctrl/cmd + wheel ourselves
            style={{
              containerStyle: {
                width: "100%",
                height: "100%",
                position: "relative",
              },
            }}
          />
          {(flipX || flipY) && (
            <div className="absolute left-3 top-3 px-2 py-1 text-xs font-semibold bg-black/60 text-white rounded">
              {flipX ? "Flipped H" : null} {flipX && flipY ? "•" : ""} {flipY ? "Flipped V" : null}
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="p-4 border-t-2 border-black bg-[#fffdf5]">
          <div className="flex flex-col gap-4">

            {/* Row: Aspect + Rotation + Flips */}
            <div className="flex flex-wrap items-center gap-3">
              <label className="text-sm font-medium text-black">Aspect:</label>
              <select
                className="px-2 py-1 border border-black rounded bg-white text-sm"
                value={String(currentAspect)}
                onChange={(e) => {
                  const v = e.target.value;
                  setCurrentAspect(v === "free" ? "free" : Number(v));
                }}
              >
                {ASPECT_PRESETS.map((p) => (
                  <option key={p.label} value={String(p.value)}>
                    {p.label}
                  </option>
                ))}
              </select>

              <div className="h-6 w-px bg-black/20 mx-1" />

              <button
                onClick={handleRotate}
                className="flex items-center gap-2 px-3 py-1 bg-amber-400 text-black rounded-lg font-semibold border-2 border-black shadow-[3px_3px_0px_0px_#000] hover:shadow-[1px_1px_0px_0px_#000] hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
                title="Rotate 90° (R)"
              >
                <RotateCw className="w-4 h-4" />
                Rotate
              </button>

              <button
                onClick={() => setFlipX((v) => !v)}
                className="flex items-center gap-2 px-3 py-1 bg-white text-black rounded-lg font-semibold border-2 border-black shadow-[3px_3px_0px_0px_#000] hover:shadow-[1px_1px_0px_0px_#000] hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
                title="Flip horizontally"
              >
                <FlipHorizontal className="w-4 h-4" />
                Flip H
              </button>

              <button
                onClick={() => setFlipY((v) => !v)}
                className="flex items-center gap-2 px-3 py-1 bg-white text-black rounded-lg font-semibold border-2 border-black shadow-[3px_3px_0px_0px_#000] hover:shadow-[1px_1px_0px_0px_#000] hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
                title="Flip vertically"
              >
                <FlipVertical className="w-4 h-4" />
                Flip V
              </button>

              <div className="h-6 w-px bg-black/20 mx-1" />

              <div className="flex items-center gap-2 text-sm">
                <span className="font-medium text-black">Rotation:</span>
                <span className="text-gray-700 w-10 text-right">{rotation}°</span>
                <input
                  type="range"
                  min={0}
                  max={359}
                  step={1}
                  value={rotation}
                  onChange={(e) => setRotation(parseInt(e.target.value, 10))}
                  className="w-44 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                />
              </div>
            </div>

            {/* Row: Zoom + Output settings + Preview */}
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              {/* Zoom */}
              <div className="flex items-center gap-3 md:flex-1">
                <span className="text-sm font-medium text-black min-w-[60px]">Zoom:</span>
                <input
                  type="range"
                  value={zoom}
                  min={1}
                  max={3}
                  step={0.1}
                  onChange={(e) => setZoom(Number(e.target.value))}
                  className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                />
                <span className="text-sm text-gray-700 min-w-[40px]">{zoom.toFixed(1)}x</span>
              </div>

              {/* Output settings */}
              <div className="flex items-center gap-3 md:flex-[1.2]">
                <ImageIcon className="w-4 h-4 text-gray-700" />
                <select
                  value={outputMime}
                  onChange={() => {}}
                  disabled
                  className="px-2 py-1 border border-black rounded bg-gray-100 text-sm"
                  title="Change via props (outputMime)"
                >
                  <option value="image/jpeg">JPEG</option>
                  <option value="image/png">PNG</option>
                  <option value="image/webp">WEBP</option>
                </select>
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-medium text-black">Quality:</span>
                  <span className="text-gray-700 w-10 text-right">{Math.round(outputQuality * 100)}%</span>
                  <input
                    type="range"
                    min={0.1}
                    max={1}
                    step={0.05}
                    value={outputQuality}
                    onChange={() => {}}
                    disabled
                    className="w-44 h-2 bg-gray-200 rounded-lg appearance-none cursor-not-allowed"
                    title="Change via props (outputQuality)"
                  />
                </div>
              </div>

              {/* Live preview */}
              <div className="flex items-center gap-3 md:justify-end">
                <div className="text-xs text-gray-600 mr-1">Preview</div>
                <div className="w-16 h-16 border border-black rounded overflow-hidden bg-white">
                  {livePreview ? (
                    <img src={livePreview} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full grid place-items-center text-[10px] text-gray-500">—</div>
                  )}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between">
              <div className="text-xs text-gray-600">
                Tips: Hold <kbd className="px-1 border">⌘/Ctrl</kbd> while scrolling to zoom. Press <kbd className="px-1 border">R</kbd> to rotate, <kbd className="px-1 border">⏎</kbd> to apply, <kbd className="px-1 border">Esc</kbd> to cancel.
              </div>

              <div className="flex gap-2">
                <button
                  onClick={onCancel}
                  className="flex items-center gap-2 px-6 py-2 bg-gray-200 text-black rounded-lg font-semibold border-2 border-black shadow-[4px_4px_0px_0px_#000] hover:shadow-[2px_2px_0px_0px_#000] hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
                >
                  <X className="w-4 h-4" />
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={isProcessing || !croppedAreaPixels}
                  className="flex items-center gap-2 px-6 py-2 bg-[#10B981] text-white rounded-lg font-semibold border-2 border-black shadow-[4px_4px_0px_0px_#000] hover:shadow-[2px_2px_0px_0px_#000] hover:translate-x-[2px] hover:translate-y-[2px] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-[4px_4px_0px_0px_#000] disabled:hover:translate-x-0 disabled:hover:translate-y-0"
                >
                  <Check className="w-4 h-4" />
                  {isProcessing ? "Processing..." : "Apply Changes"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
