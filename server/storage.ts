import { users, type User, type InsertUser } from "@shared/schema";
import fs from 'fs/promises';
import path from 'path';
import { createHash } from 'crypto';

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
}

// File storage interface
export interface IFileStorage {
  saveFile(buffer: Buffer, originalName: string, mimeType: string): Promise<StoredFile>;
  getFile(id: string): Promise<StoredFile | undefined>;
  deleteFile(id: string): Promise<boolean>;
  getFileUrl(id: string): string;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  currentId: number;

  constructor() {
    this.users = new Map();
    this.currentId = 1;
  }

  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentId++;
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }
}

// File storage implementation
export class FileStorage implements IFileStorage {
  private files: Map<string, StoredFile>;
  private uploadDir: string;

  constructor() {
    this.files = new Map();
    this.uploadDir = path.join(process.cwd(), 'uploads');
    this.ensureUploadDir();
  }

  private async ensureUploadDir() {
    try {
      await fs.access(this.uploadDir);
    } catch {
      await fs.mkdir(this.uploadDir, { recursive: true });
      console.log(`📁 Created upload directory: ${this.uploadDir}`);
    }
  }

  async saveFile(buffer: Buffer, originalName: string, mimeType: string): Promise<StoredFile> {
    // Generate unique file ID
    const hash = createHash('md5').update(buffer).digest('hex');
    const timestamp = Date.now();
    const id = `${timestamp}_${hash.substring(0, 8)}`;
    
    // Determine file extension
    const extension = path.extname(originalName) || this.getExtensionFromMimeType(mimeType);
    const filename = `${id}${extension}`;
    const filePath = path.join(this.uploadDir, filename);
    
    // Save file to disk
    await fs.writeFile(filePath, buffer);
    
    const storedFile: StoredFile = {
      id,
      filename,
      originalName,
      mimeType,
      size: buffer.length,
      url: `/uploads/${filename}`,
      uploadedAt: new Date()
    };
    
    this.files.set(id, storedFile);
    
    console.log(`💾 Saved file: ${originalName} (${(buffer.length / 1024 / 1024).toFixed(2)}MB)`);
    
    return storedFile;
  }

  async getFile(id: string): Promise<StoredFile | undefined> {
    return this.files.get(id);
  }

  async deleteFile(id: string): Promise<boolean> {
    const file = this.files.get(id);
    if (!file) return false;
    
    try {
      const filePath = path.join(this.uploadDir, file.filename);
      await fs.unlink(filePath);
      this.files.delete(id);
      console.log(`🗑️ Deleted file: ${file.originalName}`);
      return true;
    } catch (error) {
      console.error(`❌ Failed to delete file: ${error}`);
      return false;
    }
  }

  getFileUrl(id: string): string {
    const file = this.files.get(id);
    return file ? file.url : '';
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

export const storage = new MemStorage();
export const fileStorage = new FileStorage();
