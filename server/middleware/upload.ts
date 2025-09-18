import multer from 'multer';
import { Request, Response, NextFunction } from 'express';

const ACCEPTED_MIME = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
]);

const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req, file, cb) => {
    if (ACCEPTED_MIME.has(file.mimetype)) cb(null, true);
    else cb(new Error('Only JPEG, PNG, GIF, or WEBP images are allowed'));
  },
});

/**
 * Accepts:
 * - multipart/form-data with <input name="image" type="file" />
 *   -> Converts to data URL on req.body.image
 * - application/json with { image: "data:image/...;base64,..." } OR { image: "https://..." }
 */
export const uploadMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const contentType = (req.headers['content-type'] || '').toLowerCase();

  if (contentType.startsWith('multipart/form-data')) {
    upload.single('image')(req, res, (err) => {
      if (err) {
        console.error('❌ Upload error:', err.message);
        return res.status(400).json({ success: false, error: err.message });
      }
      if (req.file) {
        if (!ACCEPTED_MIME.has(req.file.mimetype)) {
          return res.status(400).json({
            success: false,
            error: 'Unsupported image format. Use JPEG, PNG, GIF, or WEBP.',
          });
        }
        const base64 = req.file.buffer.toString('base64');
        req.body.image = `data:${req.file.mimetype};base64,${base64}`;
      }
      next();
    });
  } else {
    next();
  }
};

// Accepts image as data URL or http(s) URL
export function validateImageData(imageData: string): boolean {
  if (!imageData) return false;
  const isData = /^data:image\/(jpeg|jpg|png|gif|webp);base64,/i.test(imageData);
  const isHttp = /^https?:\/\/.+/i.test(imageData);
  return isData || isHttp;
}

export function getImageInfo(imageData: string): { mimeType?: string; size?: number } | null {
  // For http(s) URLs we can’t know size/mime without fetching — allow pass-through.
  if (/^https?:\/\//i.test(imageData)) {
    return { mimeType: undefined, size: undefined };
  }
  if (!validateImageData(imageData)) return null;

  const matches = imageData.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,/);
  if (!matches) return null;

  const mimeType = matches[1].toLowerCase();
  const base64Data = imageData.replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, '');
  const size = Buffer.from(base64Data, 'base64').length;

  return { mimeType, size };
}

export const validateImage = (req: Request, res: Response, next: NextFunction) => {
  const { image } = req.body;

  if (!image) {
    return res.status(400).json({ success: false, error: 'No image data provided' });
  }

  if (!validateImageData(image)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid image. Provide a data URL (image/*) or an http(s) URL.',
    });
  }

  const info = getImageInfo(image);
  if (!info) {
    return res.status(400).json({ success: false, error: 'Could not parse image data' });
  }

  // Enforce size limit only for base64 (we can’t pre-check remote URLs without fetching)
  if (typeof info.size === 'number') {
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (info.size > maxSize) {
      return res.status(400).json({
        success: false,
        error: 'Image file too large. Maximum size is 10MB.',
      });
    }
  }

  // Enforce allowed MIME only for base64 path (multipart or inline data); http(s) is validated by Replicate side
  if (info.mimeType && !ACCEPTED_MIME.has(info.mimeType)) {
    return res.status(400).json({
      success: false,
      error: 'Unsupported image format. Use JPEG, PNG, GIF, or WEBP.',
    });
  }

  console.log(
    `📷 Image validated: ${info.mimeType ?? 'remote URL'}, ${
      info.size ? (info.size / 1024 / 1024).toFixed(2) + 'MB' : 'unknown size'
    }`
  );

  next();
};
