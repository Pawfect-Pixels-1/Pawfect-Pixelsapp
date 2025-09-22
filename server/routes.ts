import type { Express } from "express";
import { createServer, type Server } from "http";
import { webcrypto } from "node:crypto";
import { transformImageHandler, fluxKontextProHandler, generateVideoHandler, gen4AlephHandler, getStatusHandler } from "./services/replicate";
import { realtimeTransformImageHandler, setRealtimeService } from "./services/realtime-transform.js";
import { uploadMiddleware } from "./middleware/upload";
import { registerHandler, loginHandler, logoutHandler, getCurrentUserHandler, requireAuth, optionalAuth } from "./auth";
import { storage, fileStorage } from "./storage";
import RealtimeService from "./websocket";

export async function registerRoutes(app: Express): Promise<Server> {
  // Create HTTP server
  const httpServer = createServer(app);
  
  // Initialize real-time WebSocket service
  const sessionParser = app.get('sessionParser');
  const realtimeService = new RealtimeService(httpServer, sessionParser);
  setRealtimeService(realtimeService);
  
  // Authentication routes
  app.post("/api/auth/register", registerHandler);
  app.post("/api/auth/login", loginHandler);
  app.post("/api/auth/logout", logoutHandler);
  app.get("/api/auth/me", getCurrentUserHandler);
  
  // Image transformation endpoints (requires authentication)
  app.post("/api/transform", requireAuth, uploadMiddleware, transformImageHandler);
  
  // FLUX.1 Kontext Pro endpoint for text-guided transformations
  app.post("/api/transformations/flux-kontext-pro", requireAuth, uploadMiddleware, fluxKontextProHandler);
  app.post("/api/transform-realtime", requireAuth, uploadMiddleware, realtimeTransformImageHandler);
  
  // Video generation endpoint (requires authentication)
  app.post("/api/generate-video", requireAuth, uploadMiddleware, generateVideoHandler);
  
  // Gen4-Aleph video generation endpoint (requires authentication)
  app.post("/api/video/gen4-aleph", requireAuth, uploadMiddleware, gen4AlephHandler);
  
  // Status polling endpoint for long-running operations
  app.get("/api/status/:operationId", getStatusHandler);
  
  // User-specific routes (require authentication)
  app.get("/api/user/transformations", requireAuth, async (req, res) => {
    try {
      const transformations = await storage.getUserTransformations(req.user!.id);
      res.json({ success: true, transformations });
    } catch (error) {
      console.error('Get user transformations error:', error);
      res.status(500).json({ error: 'Failed to get transformations' });
    }
  });
  
  app.get("/api/user/files", requireAuth, async (req, res) => {
    try {
      const files = await fileStorage.getUserFiles(req.user!.id);
      res.json({ success: true, files });
    } catch (error) {
      console.error('Get user files error:', error);
      res.status(500).json({ error: 'Failed to get files' });
    }
  });
  
  // Share link generation endpoint (requires authentication)
  app.post("/api/share/create", requireAuth, async (req, res) => {
    try {
      const { contentUrl, contentType, title, description } = req.body;
      
      if (!contentUrl || !contentType) {
        return res.status(400).json({ error: 'Content URL and type are required' });
      }

      // Validate contentUrl is from allowed origins (same validation as share page)
      const isValidContentUrl = (url: string) => {
        try {
          const parsed = new URL(url);
          // Allow uploads and local content
          return parsed.pathname.startsWith('/uploads/') || 
                 parsed.pathname.startsWith('/api/files/') ||
                 parsed.hostname === 'localhost' ||
                 parsed.hostname.includes('replit.dev');
        } catch {
          return false;
        }
      };

      if (!isValidContentUrl(contentUrl)) {
        return res.status(400).json({ error: 'Invalid content URL. Only local content is allowed.' });
      }

      const shareId = webcrypto.randomUUID();
      
      // Store share data in database
      await storage.createShareLink({
        id: shareId,
        userId: req.user!.id,
        contentUrl,
        contentType,
        title: title || 'AI-generated content from Portrait Studio',
        description: description || 'Created with Portrait Studio',
        createdAt: new Date()
      });

      const shareUrl = `${req.protocol}://${req.get('host')}/share/${shareId}`;
      
      res.json({ 
        success: true, 
        shareId,
        shareUrl 
      });
    } catch (error) {
      console.error('Create share link error:', error);
      res.status(500).json({ error: 'Failed to create share link' });
    }
  });

  // Public share page endpoint (no auth required)
  app.get("/share/:shareId", async (req, res) => {
    try {
      const { shareId } = req.params;
      const shareData = await storage.getShareLink(shareId);
      
      if (!shareData) {
        return res.status(404).json({ error: 'Share not found' });
      }

      // Escape HTML to prevent XSS
      const escapeHtml = (unsafe: string) => {
        return unsafe
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&#039;");
      };

      // Validate contentUrl is from allowed origins
      const isValidContentUrl = (url: string) => {
        try {
          const parsed = new URL(url);
          // Allow uploads and local content
          return parsed.pathname.startsWith('/uploads/') || 
                 parsed.pathname.startsWith('/api/files/') ||
                 parsed.hostname === 'localhost' ||
                 parsed.hostname.includes('replit.dev');
        } catch {
          return false;
        }
      };

      if (!isValidContentUrl(shareData.contentUrl)) {
        return res.status(400).json({ error: 'Invalid content URL' });
      }

      const title = escapeHtml(shareData.title);
      const description = escapeHtml(shareData.description);
      const contentUrl = escapeHtml(shareData.contentUrl);

      // Return HTML page with Open Graph meta tags for social media previews
      const ogTags = `
        <meta property="og:title" content="${title}" />
        <meta property="og:description" content="${description}" />
        <meta property="og:url" content="${req.protocol}://${req.get('host')}/share/${shareId}" />
        <meta property="og:site_name" content="Portrait Studio" />
        ${shareData.contentType === 'image' 
          ? `<meta property="og:image" content="${contentUrl}" />
             <meta property="og:image:secure_url" content="${contentUrl}" />
             <meta property="og:image:type" content="image/jpeg" />
             <meta property="og:image:width" content="1200" />
             <meta property="og:image:height" content="1200" />`
          : `<meta property="og:video" content="${contentUrl}" />
             <meta property="og:video:secure_url" content="${contentUrl}" />
             <meta property="og:video:type" content="video/mp4" />
             <meta property="og:video:width" content="1200" />
             <meta property="og:video:height" content="1200" />`
        }
        <meta property="og:type" content="${shareData.contentType === 'video' ? 'video.other' : 'website'}" />
        <meta name="twitter:card" content="${shareData.contentType === 'video' ? 'player' : 'summary_large_image'}" />
        <meta name="twitter:title" content="${title}" />
        <meta name="twitter:description" content="${description}" />
        <meta name="twitter:site" content="@PortraitStudio" />
        ${shareData.contentType === 'image' 
          ? `<meta name="twitter:image" content="${contentUrl}" />`
          : `<meta name="twitter:player" content="${contentUrl}" />
             <meta name="twitter:player:width" content="1200" />
             <meta name="twitter:player:height" content="1200" />
             <meta name="twitter:player:stream" content="${contentUrl}" />
             <meta name="twitter:player:stream:content_type" content="video/mp4" />`
        }
      `;

      const html = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${title}</title>
          ${ogTags}
        </head>
        <body style="font-family: Arial, sans-serif; margin: 0; padding: 20px; background: #f5f5f5;">
          <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; padding: 20px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
            <h1 style="text-align: center; color: #333;">${title}</h1>
            <p style="text-align: center; color: #666; margin-bottom: 20px;">${description}</p>
            
            ${shareData.contentType === 'image' 
              ? `<img src="${contentUrl}" alt="Shared content" style="width: 100%; height: auto; border-radius: 8px;" />`
              : `<video controls style="width: 100%; height: auto; border-radius: 8px;">
                   <source src="${contentUrl}" type="video/mp4" />
                   Your browser does not support the video tag.
                 </video>`
            }
            
            <div style="text-align: center; margin-top: 20px;">
              <a href="/" style="background: #6c8b3a; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">
                Create Your Own with Portrait Studio
              </a>
            </div>
          </div>
        </body>
        </html>
      `;

      res.setHeader('Content-Type', 'text/html');
      res.send(html);
    } catch (error) {
      console.error('Get share page error:', error);
      res.status(500).json({ error: 'Failed to load share page' });
    }
  });

  // Analytics endpoints (requires authentication)
  app.post("/api/analytics/share", requireAuth, async (req, res) => {
    try {
      const { contentUrl, contentType, platform, title, description } = req.body;
      
      if (!contentUrl || !contentType || !platform) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      await storage.recordShareEvent({
        userId: req.user!.id,
        contentUrl,
        contentType,
        platform,
        title: title || '',
        description: description || '',
        timestamp: new Date()
      });

      res.json({ success: true });
    } catch (error) {
      console.error('Record share event error:', error);
      res.status(500).json({ error: 'Failed to record share event' });
    }
  });

  app.get("/api/analytics/shares", requireAuth, async (req, res) => {
    try {
      const analytics = await storage.getShareAnalytics(req.user!.id);
      res.json({ success: true, analytics });
    } catch (error) {
      console.error('Get share analytics error:', error);
      res.status(500).json({ error: 'Failed to get analytics' });
    }
  });

  // Health check endpoint
  app.get("/api/health", (req, res) => {
    const hasReplicateToken = !!process.env.REPLICATE_API_TOKEN;
    res.json({ 
      status: hasReplicateToken ? "ok" : "error", 
      timestamp: new Date().toISOString(),
      service: "portrait-studio",
      replicate_configured: hasReplicateToken,
      message: hasReplicateToken ? "All services ready" : "Replicate API token not configured"
    });
  });

  return httpServer;
}
