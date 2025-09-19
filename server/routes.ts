import type { Express } from "express";
import { createServer, type Server } from "http";
import { transformImageHandler, generateVideoHandler, getStatusHandler } from "./services/replicate";
import { uploadMiddleware } from "./middleware/upload";
import { registerHandler, loginHandler, logoutHandler, getCurrentUserHandler, requireAuth, optionalAuth } from "./auth";
import { storage, fileStorage } from "./storage";

export async function registerRoutes(app: Express): Promise<Server> {
  // Authentication routes
  app.post("/api/auth/register", registerHandler);
  app.post("/api/auth/login", loginHandler);
  app.post("/api/auth/logout", logoutHandler);
  app.get("/api/auth/me", getCurrentUserHandler);
  
  // Image transformation endpoint (requires authentication)
  app.post("/api/transform", requireAuth, uploadMiddleware, transformImageHandler);
  
  // Video generation endpoint (requires authentication)
  app.post("/api/generate-video", requireAuth, uploadMiddleware, generateVideoHandler);
  
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

  const httpServer = createServer(app);
  return httpServer;
}
