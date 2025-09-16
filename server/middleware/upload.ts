import multer from 'multer';
import { Request, Response, NextFunction } from 'express';

// Configure multer for memory storage
const storage = multer.memoryStorage();

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Allow image files only
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// Middleware that handles both file uploads and JSON data
export const uploadMiddleware = (req: Request, res: Response, next: NextFunction) => {
  // Check if request contains file upload
  const contentType = req.headers['content-type'] || '';
  
  if (contentType.startsWith('multipart/form-data')) {
    // Handle file upload
    upload.single('image')(req, res, (err) => {
      if (err) {
        console.error('❌ Upload error:', err.message);
        return res.status(400).json({
          success: false,
          error: err.message
        });
      }
      
      // Convert uploaded file to base64 for consistency
      if (req.file) {
        const base64 = req.file.buffer.toString('base64');
        req.body.image = `data:${req.file.mimetype};base64,${base64}`;
      }
      
      next();
    });
  } else {
    // Handle JSON data (base64 images)
    next();
  }
};

// Utility function to validate base64 image data
export function validateImageData(imageData: string): boolean {
  if (!imageData) return false;
  
  // Check if it's a valid data URL
  const dataUrlPattern = /^data:image\/(jpeg|jpg|png|gif|webp);base64,/;
  return dataUrlPattern.test(imageData);
}

// Utility function to extract image info from base64
export function getImageInfo(imageData: string): { mimeType: string; size: number } | null {
  if (!validateImageData(imageData)) return null;
  
  const matches = imageData.match(/^data:(image\/[a-z]+);base64,/);
  if (!matches) return null;
  
  const mimeType = matches[1];
  const base64Data = imageData.replace(/^data:image\/[a-z]+;base64,/, '');
  const size = Buffer.from(base64Data, 'base64').length;
  
  return { mimeType, size };
}

// Middleware to validate image data
export const validateImage = (req: Request, res: Response, next: NextFunction) => {
  const { image } = req.body;
  
  if (!image) {
    return res.status(400).json({
      success: false,
      error: 'No image data provided'
    });
  }
  
  if (!validateImageData(image)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid image data format'
    });
  }
  
  const imageInfo = getImageInfo(image);
  if (!imageInfo) {
    return res.status(400).json({
      success: false,
      error: 'Could not parse image data'
    });
  }
  
  // Check file size (10MB limit)
  const maxSize = 10 * 1024 * 1024;
  if (imageInfo.size > maxSize) {
    return res.status(400).json({
      success: false,
      error: 'Image file too large. Maximum size is 10MB.'
    });
  }
  
  console.log(`📷 Image validated: ${imageInfo.mimeType}, ${(imageInfo.size / 1024 / 1024).toFixed(2)}MB`);
  
  next();
};
