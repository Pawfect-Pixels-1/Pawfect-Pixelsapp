import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import ConnectPgSimple from "connect-pg-simple";
import rateLimit from "express-rate-limit";
import cors from "cors";
import helmet from "helmet";
import path from "path";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { cronJobService } from "./services/cronJobs";

const app = express();

// Trust proxy for rate limiting in hosted environments
// Set to 1 for Replit which uses one layer of reverse proxy
app.set('trust proxy', 1);

// Stripe webhook endpoint needs raw body - must be before express.json()
app.use('/api/billing/webhook', express.raw({type: 'application/json'}));

// Security middleware - Helmet for various HTTP headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: process.env.NODE_ENV === 'production' 
        ? ["'self'", "https://fonts.googleapis.com"]
        : ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      scriptSrc: process.env.NODE_ENV === 'production'
        ? ["'self'"]
        : ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "blob:", "https:"],
      connectSrc: ["'self'", "ws:", "wss:", "https://api.replicate.com"],
      mediaSrc: ["'self'", "blob:"],
      frameAncestors: ["'none'"], // Prevent clickjacking
      upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null,
    },
  },
  crossOriginEmbedderPolicy: false, // Allow file uploads and external resources
}));

// CORS configuration
const corsOptions = {
  origin: function (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    
    // In development, be more permissive
    if (process.env.NODE_ENV === 'development') {
      // Allow any localhost or replit domain in development
      if (origin.includes('localhost') || 
          origin.includes('replit.') || 
          origin.includes('repl.co') ||
          origin.includes('.replit.app') ||
          origin.includes('127.0.0.1')) {
        return callback(null, true);
      }
    }
    
    // In production, be stricter with allowed origins
    const allowedOrigins = [
      process.env.FRONTEND_URL,
      /\.replit\.app$/,
      /\.repl\.co$/,
      // Add your production domain here
      'https://your-production-domain.com',
    ].filter(Boolean); // Remove undefined values
    
    const isAllowed = allowedOrigins.some(allowedOrigin => {
      if (!allowedOrigin) return false;
      if (typeof allowedOrigin === 'string') {
        return origin === allowedOrigin;
      }
      return allowedOrigin.test(origin);
    });
    
    if (isAllowed) {
      callback(null, true);
    } else {
      // In development, log the rejected origin for debugging
      if (process.env.NODE_ENV === 'development') {
        console.log(`🚫 CORS blocked origin: ${origin}`);
      }
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true, // Allow cookies to be sent
  optionsSuccessStatus: 200,
};

app.use(cors(corsOptions));

// Rate limiting - More permissive for development
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 100 : 1000, // Much higher limit in development
  message: {
    error: 'Too many requests from this IP, please try again later.',
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  // Skip rate limiting for certain paths in development
  skip: (req) => {
    if (process.env.NODE_ENV === 'development') {
      // In development, skip rate limiting for static assets and common paths
      return req.path === '/api/health' || 
             req.path.startsWith('/src/') ||
             req.path.startsWith('/node_modules/') ||
             req.path.includes('vite') ||
             req.path.includes('.js') ||
             req.path.includes('.css') ||
             req.path.includes('.ts') ||
             req.path.includes('.tsx');
    }
    return req.path === '/api/health';
  },
});

// Strict rate limiting for authentication endpoints  
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 5 : 50, // More permissive in development
  message: {
    error: 'Too many authentication attempts, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply general rate limiting to all requests
app.use(limiter);

// Apply stricter rate limiting to auth routes
app.use('/api/auth', authLimiter);

// Session configuration
const PgSession = ConnectPgSimple(session);
const sessionParser = session({
  store: new PgSession({
    conString: process.env.DATABASE_URL,
    tableName: 'user_sessions',
    createTableIfMissing: true,
  }),
  secret: process.env.SESSION_SECRET || 'dev-secret-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    secure: process.env.NODE_ENV === 'production', // HTTPS only in production
    httpOnly: true, // Prevent XSS attacks
    sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax', // CSRF protection
    domain: process.env.NODE_ENV === 'production' ? process.env.COOKIE_DOMAIN : undefined,
  },
});

app.use(sessionParser);
// Store the session parser for WebSocket use
app.set('sessionParser', sessionParser);

// Increase payload limits for base64 image uploads (50MB limit)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: false, limit: '50mb' }));

// Serve uploaded files statically
const uploadsDir = path.join(process.cwd(), 'uploads');
app.use('/uploads', express.static(uploadsDir));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    // Log error with context for debugging
    console.error('❌ Server error:', {
      error: err.message,
      stack: err.stack,
      url: req.url,
      method: req.method,
      status
    });

    // Only send response if not already sent
    if (!res.headersSent) {
      res.status(status).json({ message });
    }
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on port 5000
  // this serves both the API and the client
  const port = 5000;
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
    
    // Start cron jobs for automated exports
    try {
      cronJobService.start();
    } catch (error) {
      console.error('❌ Failed to start cron jobs:', error);
    }
  });
})();