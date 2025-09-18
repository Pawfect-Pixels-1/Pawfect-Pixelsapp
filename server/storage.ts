import { users, transformations, userFiles, type User, type InsertUser, type Transformation, type UserFile, type InsertTransformation, type InsertUserFile } from "@shared/schema";
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { eq } from "drizzle-orm";
import { Client } from "@replit/object-storage";
import fs from 'fs/promises';
import path from 'path';
import { createHash } from 'crypto';
import { Readable } from 'stream';

// Initialize database connection
const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql, { schema: { users, transformations, userFiles } });

// App Storage client - disabled for now until properly configured
let storageClient: Client | null = null;
console.log('📁 Using local file storage (App Storage disabled)');

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
}

// File storage interface for App Storage
export interface IFileStorage {
  saveFile(buffer: Buffer, originalName: string, mimeType: string, userId?: number): Promise<StoredFile>;
  saveFileFromUrl(url: string, originalName: string, mimeType: string, userId?: number): Promise<StoredFile>;
  getFile(id: string): Promise<StoredFile | undefined>;
  deleteFile(id: string): Promise<boolean>;
  getFileUrl(id: string): string;
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
      return false;
    }
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
      await db.insert(userFiles).values({
        userId,
        fileName: filename,
        originalFileName: originalName,
        fileUrl,
        fileType: mimeType,
        fileSize: buffer.length,
      });
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
      throw new Error('Failed to save file from URL');
    }
  }

  async getFile(id: string): Promise<StoredFile | undefined> {
    // In a real implementation, you might store file metadata in a database
    // For now, we'll use the database lookup
    try {
      const result = await db.select().from(userFiles).where(eq(userFiles.fileName, `${id}${'.png'}`)).limit(1); // Simplified lookup
      if (result[0]) {
        return {
          id,
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
    }
    return undefined;
  }

  async deleteFile(id: string): Promise<boolean> {
    try {
      // Find file in database first
      const result = await db.select().from(userFiles).where(eq(userFiles.fileName, `${id}.png`)).limit(1);
      if (!result[0]) return false;
      
      const storageKey = this.extractStorageKeyFromUrl(result[0].fileUrl);
      if (storageKey && storageClient) {
        await storageClient.delete(storageKey);
      }
      
      // Remove from database
      await db.delete(userFiles).where(eq(userFiles.fileName, `${id}.png`));
      
      console.log(`🗑️ Deleted file from App Storage: ${id}`);
      return true;
    } catch (error) {
      console.error(`❌ Failed to delete file: ${error}`);
      return false;
    }
  }

  getFileUrl(id: string): string {
    // This would need to be looked up from database in a real implementation
    return ``;
  }

  async getUserFiles(userId: number): Promise<StoredFile[]> {
    try {
      const files = await db.select().from(userFiles).where(eq(userFiles.userId, userId));
      return files.map(file => ({
        id: file.id.toString(),
        filename: file.fileName,
        originalName: file.originalFileName,
        mimeType: file.fileType,
        size: file.fileSize || 0,
        url: file.fileUrl,
        uploadedAt: file.createdAt
      }));
    } catch (error) {
      console.error(`❌ Error getting user files: ${error}`);
      return [];
    }
  }

  private extractStorageKeyFromUrl(url: string): string | null {
    // Extract storage key from App Storage URL - implementation depends on URL format
    const match = url.match(/\/([^/]+\/[^/]+\/[^/]+)$/);
    return match ? match[1] : null;
  }

  private getExtensionFromMimeType(mimeType: string): string {
    const mimeToExt: Record<string, string> = {
      'image/jpeg': '.jpg',
      'image/jpg': '.jpg', 
      'image/png': '.png',
      'image/webp': '.webp',
      'image/gif': '.gif',
      'video/mp4': '.mp4',
      'video/webm': '.webm'
    };
    return mimeToExt[mimeType] || '.bin';
  }
}

export const storage = new DatabaseStorage();
export const fileStorage = new HybridFileStorage();
