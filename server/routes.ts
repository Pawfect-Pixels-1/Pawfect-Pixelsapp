import type { Express } from "express";
import { createServer, type Server } from "http";
import { transformImageHandler, generateVideoHandler, getStatusHandler } from "./services/replicate";
import { uploadMiddleware } from "./middleware/upload";

export async function registerRoutes(app: Express): Promise<Server> {
  // Image transformation endpoint
  app.post("/api/transform", uploadMiddleware, transformImageHandler);
  
  // Video generation endpoint
  app.post("/api/generate-video", uploadMiddleware, generateVideoHandler);
  
  // Status polling endpoint for long-running operations
  app.get("/api/status/:operationId", getStatusHandler);
  
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
