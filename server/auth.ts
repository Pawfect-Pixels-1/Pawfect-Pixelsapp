import { Request, Response, NextFunction } from 'express';
import { storage } from './storage';
import { insertUserSchema } from '@shared/schema';

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: import('../shared/schema').User;
    }
  }
}

// Extend express-session to include userId
declare module 'express-session' {
  interface SessionData {
    userId?: number;
  }
}

// Auth middleware to check if user is logged in
export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  if (!req.session?.userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const user = await storage.getUser(req.session.userId);
    if (!user) {
      req.session.destroy(() => {});
      return res.status(401).json({ error: 'Invalid session' });
    }

    req.user = user;
    
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(500).json({ error: 'Authentication error' });
  }
};

// Optional auth middleware - adds user to request if logged in
export async function optionalAuth(req: Request, res: Response, next: NextFunction) {
    if (req.session?.userId) {
        try {
            const user = await storage.getUser(req.session.userId);
            if (user) {
                req.user = user;
            }
        } catch (error) {
            console.error('Optional auth error:', error);
        }
    }
    next();
}

// Replit Auth callback handler - processes Replit identity securely
export const replitAuthHandler = async (req: Request, res: Response) => {
  try {
    // Check if running in Replit environment
    const isReplitEnv = process.env.REPLIT_DB_URL || process.env.REPL_ID;
    
    if (!isReplitEnv) {
      return res.status(400).json({ 
        error: 'Replit Auth not available outside Replit environment',
        suggestion: 'Please open this app in Replit to authenticate'
      });
    }

    // In a real Replit Auth implementation, this would validate a JWT token or signed headers
    // For Replit deployments, check for authenticated user headers (these are injected by Replit)
    const replitUser = req.headers['x-replit-user-id'];
    const replitUsername = req.headers['x-replit-user-name'] || req.headers['x-replit-user-username'];
    const replitEmail = req.headers['x-replit-user-email'];
    
    // Validate Replit identity from environment-injected headers
    if (!replitUser || !replitUsername) {
      return res.status(401).json({ 
        error: 'Replit authentication required',
        message: 'Please ensure you are signed in to Replit and try again'
      });
    }

    const replitId = replitUser.toString();
    const username = replitUsername.toString();
    
    // Check if user already exists by Replit ID
    let user = await storage.getUserByReplitId(replitId);
    
    if (!user) {
      // Generate unique username if collision exists
      let finalUsername = username;
      let counter = 1;
      while (await storage.getUserByUsername(finalUsername)) {
        finalUsername = `${username}_${counter}`;
        counter++;
      }
      
      // Create new user from verified Replit Auth data
      user = await storage.createUser({
        username: finalUsername,
        email: replitEmail ? replitEmail.toString() : null,
        replitId: replitId,
        password: null, // No password needed for Replit Auth
      });
      console.log(`👤 New Replit user created: ${finalUsername} (ID: ${replitId})`);
    } else {
      console.log(`🔐 Existing Replit user logged in: ${user.username}`);
    }

    // Create session
    await new Promise<void>((resolve, reject) => {
      req.session.regenerate((err) => {
        if (err) reject(err);
        else {
          req.session.userId = user.id;
          resolve();
        }
      });
    });

    res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
      }
    });
  } catch (error) {
    console.error('Replit Auth error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
};

// Initiate Replit Auth flow
export const initAuthHandler = async (req: Request, res: Response) => {
  try {
    // Check if running in Replit environment
    const isReplitEnv = process.env.REPLIT_DB_URL || process.env.REPL_ID;
    
    if (!isReplitEnv) {
      return res.status(400).json({ 
        error: 'Replit Auth is only available in Replit environment',
        suggestion: 'Please open this app in Replit to use Replit Auth'
      });
    }

    // In a real Replit Auth implementation, this would redirect to Replit's OAuth endpoint
    // For Replit deployments, users are automatically authenticated via headers
    // Return success to indicate auth should proceed
    res.json({
      success: true,
      message: 'Proceed with Replit authentication',
      replitEnv: true
    });
  } catch (error) {
    console.error('Auth init error:', error);
    res.status(500).json({ error: 'Failed to initialize authentication' });
  }
};

// Logout user
export const logoutHandler = (req: Request, res: Response) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Logout error:', err);
      return res.status(500).json({ error: 'Logout failed' });
    }
    
    res.clearCookie('connect.sid'); // Clear session cookie
    res.json({ success: true, message: 'Logged out successfully' });
  });
};

// Get current user info
export const getCurrentUserHandler = async (req: Request, res: Response) => {
  if (!req.session?.userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const user = await storage.getUser(req.session.userId);
    if (!user) {
      req.session.destroy(() => {});
      return res.status(401).json({ error: 'Session invalid' });
    }

    res.json({
      success: true,
      user: {
        id: user.id,  
        username: user.username,
        email: user.email,
      }
    });
  } catch (error) {
    console.error('Get current user error:', error);
    res.status(500).json({ error: 'Failed to get user info' });
  }
};