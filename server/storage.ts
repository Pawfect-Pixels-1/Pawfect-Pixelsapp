import { users, transformations, userFiles, shareLinks, shareEvents, type User, type InsertUser, type Transformation, type UserFile, type InsertTransformation, type InsertUserFile, type ShareLink, type InsertShareLink, type ShareEvent, type InsertShareEvent } from "@shared/schema";
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { eq, like } from "drizzle-orm";
import { Client } from "@replit/object-storage";
import fs from 'fs/promises';
import path from 'path';
import { createHash } from 'crypto';
import { Readable } from 'stream';

// Initialize database connection
const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql, { schema: { users, transformations, userFiles, shareLinks, shareEvents } });

// App Storage client - enable Replit Object Storage
let storageClient: Client | null = null;

// Initialize App Storage if available (deferred to avoid blocking startup)
function initializeAppStorage() {
  // Run asynchronously to avoid blocking server startup
  setTimeout(async () => {
    try {
      // Only try to initialize if we detect proper Replit app storage environment
      if (process.env.REPLIT_DEPLOYMENT_ID && process.env.REPL_SLUG) {
        storageClient = new Client();
        console.log('☁️ App Storage enabled (Replit Object Storage)');
      } else {
        console.log('📁 Using local file storage (App Storage not configured)');
      }
    } catch (error: any) {
      console.log('📁 Using local file storage (App Storage unavailable):', error?.message || 'Unknown error');
      storageClient = null;
    }
  }, 1000); // Delay initialization to not block server startup
}

// Initialize storage with delay
initializeAppStorage();

// File storage interface
export interface StoredFile {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
  uploadedAt: Date;
}

// User storage interface
export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  // Transformation methods
  createTransformation(transformation: InsertTransformation): Promise<Transformation>;
  getUserTransformations(userId: number): Promise<Transformation[]>;
  updateTransformationStatus(id: number, status: string, result?: any): Promise<void>;
  // File methods
  createUserFile(file: InsertUserFile): Promise<UserFile>;
  getUserFiles(userId: number): Promise<UserFile[]>;
  deleteUserFile(id: number): Promise<boolean>;
  // Share link methods
  createShareLink(shareLink: InsertShareLink): Promise<ShareLink>;
  getShareLink(id: string): Promise<ShareLink | undefined>;
  // Share analytics methods
  recordShareEvent(event: InsertShareEvent): Promise<ShareEvent>;
  getShareAnalytics(userId: number): Promise<{
    totalShares: number;
    sharesByPlatform: Record<string, number>;
    sharesByContentType: Record<string, number>;
  }>;
}

// File storage interface for App Storage
export interface IFileStorage {
  saveFile(buffer: Buffer, originalName: string, mimeType: string, userId?: number): Promise<StoredFile>;
  saveFileFromUrl(url: string, originalName: string, mimeType: string, userId?: number): Promise<StoredFile>;
  getFile(id: string): Promise<StoredFile | undefined>;
  deleteFile(id: string): Promise<boolean>;
  getFileUrl(id: string): Promise<string>;
  getUserFiles(userId: number): Promise<StoredFile[]>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: number): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return result[0];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.username, username)).limit(1);
    return result[0];
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const result = await db.insert(users).values(insertUser).returning();
    return result[0];
  }

  async createTransformation(transformation: InsertTransformation): Promise<Transformation> {
    const result = await db.insert(transformations).values(transformation).returning();
    return result[0];
  }

  async getUserTransformations(userId: number): Promise<Transformation[]> {
    return await db.select().from(transformations).where(eq(transformations.userId, userId));
  }

  async updateTransformationStatus(id: number, status: string, result?: any): Promise<void> {
    const updateData: any = { status };
    if (status === 'completed') {
      updateData.completedAt = new Date();
      updateData.resultFileUrls = result;
    } else if (status === 'failed' && result) {
      updateData.errorMessage = result;
    }
    
    await db.update(transformations).set(updateData).where(eq(transformations.id, id));
  }

  async createUserFile(file: InsertUserFile): Promise<UserFile> {
    const result = await db.insert(userFiles).values(file).returning();
    return result[0];
  }

  async getUserFiles(userId: number): Promise<UserFile[]> {
    return await db.select().from(userFiles).where(eq(userFiles.userId, userId));
  }

  async deleteUserFile(id: number): Promise<boolean> {
    try {
      await db.delete(userFiles).where(eq(userFiles.id, id));
      return true;
    } catch (error) {
      console.error(`❌ Failed to delete user file from database: ${error}`);
      throw new Error(`Failed to delete user file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Share link methods
  async createShareLink(shareLink: InsertShareLink): Promise<ShareLink> {
    const result = await db.insert(shareLinks).values(shareLink).returning();
    return result[0];
  }

  async getShareLink(id: string): Promise<ShareLink | undefined> {
    const result = await db.select().from(shareLinks).where(eq(shareLinks.id, id)).limit(1);
    return result[0];
  }

  // Share analytics methods
  async recordShareEvent(event: InsertShareEvent): Promise<ShareEvent> {
    const result = await db.insert(shareEvents).values(event).returning();
    return result[0];
  }

  async getShareAnalytics(userId: number): Promise<{
    totalShares: number;
    sharesByPlatform: Record<string, number>;
    sharesByContentType: Record<string, number>;
  }> {
    const events = await db.select().from(shareEvents).where(eq(shareEvents.userId, userId));
    
    const sharesByPlatform: Record<string, number> = {};
    const sharesByContentType: Record<string, number> = {};
    
    for (const event of events) {
      sharesByPlatform[event.platform] = (sharesByPlatform[event.platform] || 0) + 1;
      sharesByContentType[event.contentType] = (sharesByContentType[event.contentType] || 0) + 1;
    }
    
    return {
      totalShares: events.length,
      sharesByPlatform,
      sharesByContentType,
    };
  }
}

// Hybrid file storage - use App Storage when available, fallback to local
export class HybridFileStorage implements IFileStorage {
  private storagePrefix: string = 'portrait-studio';

  async saveFile(buffer: Buffer, originalName: string, mimeType: string, userId?: number): Promise<StoredFile> {
    // Generate unique file ID
    const hash = createHash('md5').update(buffer).digest('hex');
    const timestamp = Date.now();
    const id = `${timestamp}_${hash.substring(0, 8)}`;
    
    // Determine file extension
    const extension = path.extname(originalName) || this.getExtensionFromMimeType(mimeType);
    const filename = `${id}${extension}`;
    const storageKey = `${this.storagePrefix}/${userId || 'anonymous'}/${filename}`;
    
    let fileUrl: string;
    let storedFile: StoredFile;

    try {
      // Try to upload to App Storage first
      if (storageClient) {
        const stream = Readable.from(buffer);
        await storageClient.uploadFromStream(storageKey, stream);
        fileUrl = `/api/files/${storageKey}`;
        console.log(`💾 Saved file to App Storage: ${originalName} (${(buffer.length / 1024 / 1024).toFixed(2)}MB)`);
      } else {
        throw new Error('App Storage not configured');
      }
    } catch (error) {
      // Fallback to local storage
      const localPath = path.join(process.cwd(), 'uploads', filename);
      await fs.mkdir(path.dirname(localPath), { recursive: true });
      await fs.writeFile(localPath, buffer);
      fileUrl = `/uploads/${filename}`;
      console.log(`📁 Saved file locally: ${originalName} (${(buffer.length / 1024 / 1024).toFixed(2)}MB)`);
    }

    storedFile = {
      id,
      filename,
      originalName,
      mimeType,
      size: buffer.length,
      url: fileUrl,
      uploadedAt: new Date()
    };
    
    // If userId provided, save file metadata to database
    if (userId) {
      try {
        await db.insert(userFiles).values({
          userId,
          fileName: filename,
          originalFileName: originalName,
          fileUrl,
          fileType: mimeType,
          fileSize: buffer.length,
        });
      } catch (error) {
        console.error(`❌ Failed to save file metadata to database: ${error}`);
        throw new Error(`Failed to save file metadata: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
    
    return storedFile;
  }

  async saveFileFromUrl(url: string, originalName: string, mimeType: string, userId?: number): Promise<StoredFile> {
    try {
      // Fetch the file from URL
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch file: ${response.statusText}`);
      }
      
      const buffer = Buffer.from(await response.arrayBuffer());
      return await this.saveFile(buffer, originalName, mimeType, userId);
    } catch (error) {
      console.error(`❌ Failed to save file from URL: ${error}`);
      throw new Error(`Failed to save file from URL: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getFile(id: string): Promise<StoredFile | undefined> {
    try {
      // Validate and sanitize ID to prevent wildcard abuse
      const sanitizedId = this.validateAndSanitizeId(id);
      
      // First try exact filename match
      let result = await db.select().from(userFiles)
        .where(eq(userFiles.fileName, sanitizedId))
        .limit(1);
      
      // If not found, try prefix match (id without extension)
      if (!result[0] && this.isValidIdPattern(sanitizedId)) {
        const results = await db.select().from(userFiles)
          .where(like(userFiles.fileName, `${sanitizedId}.%`))
          .limit(1);
        result = results;
      }
      
      if (result[0]) {
        return {
          id: this.extractIdFromFilename(result[0].fileName),
          filename: result[0].fileName,
          originalName: result[0].originalFileName,
          mimeType: result[0].fileType,
          size: result[0].fileSize || 0,
          url: result[0].fileUrl,
          uploadedAt: result[0].createdAt
        };
      }
    } catch (error) {
      console.error(`❌ Error getting file metadata: ${error}`);
      throw new Error(`Failed to get file metadata: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    return undefined;
  }

  async deleteFile(id: string): Promise<boolean> {
    try {
      // Validate and sanitize ID to prevent wildcard abuse
      const sanitizedId = this.validateAndSanitizeId(id);
      
      // First try exact filename match
      let result = await db.select().from(userFiles)
        .where(eq(userFiles.fileName, sanitizedId))
        .limit(1);
      
      // If not found, try prefix match (id without extension)
      if (!result[0] && this.isValidIdPattern(sanitizedId)) {
        const results = await db.select().from(userFiles)
          .where(like(userFiles.fileName, `${sanitizedId}.%`))
          .limit(1);
        result = results;
      }
      
      if (!result[0]) {
        console.warn(`⚠️ File not found in database: ${id}`);
        return false;
      }
      
      // Delete from storage if using App Storage
      const storageKey = this.extractStorageKeyFromUrl(result[0].fileUrl);
      if (storageKey && storageClient) {
        try {
          await storageClient.delete(storageKey);
        } catch (storageError) {
          console.warn(`⚠️ Failed to delete from App Storage: ${storageError}`);
          // Continue with database deletion even if storage deletion fails
        }
      }
      
      // Remove from database using the actual filename found
      await db.delete(userFiles).where(eq(userFiles.fileName, result[0].fileName));
      
      console.log(`🗑️ Deleted file: ${result[0].fileName}`);
      return true;
    } catch (error) {
      console.error(`❌ Failed to delete file: ${error}`);
      throw new Error(`Failed to delete file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getFileUrl(id: string): Promise<string> {
    const file = await this.getFile(id);
    return file ? file.url : '';
  }

  async getUserFiles(userId: number): Promise<StoredFile[]> {
    try {
      const files = await db.select().from(userFiles).where(eq(userFiles.userId, userId));
      return files.map(file => ({
        id: this.extractIdFromFilename(file.fileName),
        filename: file.fileName,
        originalName: file.originalFileName,
        mimeType: file.fileType,
        size: file.fileSize || 0,
        url: file.fileUrl,
        uploadedAt: file.createdAt
      }));
    } catch (error) {
      console.error(`❌ Error getting user files: ${error}`);
      throw new Error(`Failed to get user files: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private extractStorageKeyFromUrl(url: string): string | null {
    // Extract storage key from App Storage URL - implementation depends on URL format
    const match = url.match(/\/([^/]+\/[^/]+\/[^/]+)$/);
    return match ? match[1] : null;
  }

  private extractIdFromFilename(filename: string): string {
    // Extract the id part (timestamp_hash) from filename before extension
    const lastDotIndex = filename.lastIndexOf('.');
    return lastDotIndex > 0 ? filename.substring(0, lastDotIndex) : filename;
  }

  private validateAndSanitizeId(id: string): string {
    // Remove any potential SQL wildcard characters for safety
    return id.replace(/[%_]/g, '');
  }

  private isValidIdPattern(id: string): boolean {
    // Validate ID matches expected pattern: timestamp_hash (digits_hex)
    return /^\d{10,20}_[a-f0-9]{6,16}$/.test(id);
  }

  private getExtensionFromMimeType(mimeType: string): string {
    const mimeToExt: Record<string, string> = {
      'image/jpeg': '.jpg',
      'image/jpg': '.jpg', 
      'image/png': '.png',
      'image/webp': '.webp',
      'image/gif': '.gif',
      'image/bmp': '.bmp',
      'image/tiff': '.tiff',
      'image/svg+xml': '.svg',
      'video/mp4': '.mp4',
      'video/webm': '.webm',
      'video/avi': '.avi',
      'video/mov': '.mov',
      'video/quicktime': '.mov'
    };
    return mimeToExt[mimeType] || '.bin';
  }
}

export const storage = new DatabaseStorage();
export const fileStorage = new HybridFileStorage();
