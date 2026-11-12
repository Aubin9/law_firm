import fs from "fs";
import path from "path";
import { Readable } from "stream";

export interface StorageProvider {
  put(key: string, data: Buffer | Uint8Array, mimeType: string): Promise<void>;
  get(key: string): Promise<NodeJS.ReadableStream>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  getBuffer(key: string): Promise<Buffer>;
}

/**
 * Local Disk Storage Provider
 * Implements data residency compliance for Cameroon Law n° 2024/017.
 * Files are stored under opaque UUID keys with no public URL access.
 */
export class LocalDiskStorageProvider implements StorageProvider {
  private baseDir: string;

  constructor(baseDir?: string) {
    this.baseDir =
      baseDir ||
      process.env.STORAGE_LOCAL_PATH ||
      path.join(process.cwd(), "storage_data");

    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true });
    }
  }

  private resolvePath(key: string): string {
    // Sanitize key to prevent path traversal
    const safeKey = key.replace(/[^a-zA-Z0-9_-]/g, "");
    return path.join(this.baseDir, safeKey);
  }

  async put(key: string, data: Buffer | Uint8Array): Promise<void> {
    const filePath = this.resolvePath(key);
    await fs.promises.writeFile(filePath, data);
  }

  async get(key: string): Promise<NodeJS.ReadableStream> {
    const filePath = this.resolvePath(key);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Fichier introuvable dans le stockage: ${key}`);
    }
    return fs.createReadStream(filePath);
  }

  async getBuffer(key: string): Promise<Buffer> {
    const filePath = this.resolvePath(key);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Fichier introuvable dans le stockage: ${key}`);
    }
    return await fs.promises.readFile(filePath);
  }

  async delete(key: string): Promise<void> {
    const filePath = this.resolvePath(key);
    if (fs.existsSync(filePath)) {
      await fs.promises.unlink(filePath);
    }
  }

  async exists(key: string): Promise<boolean> {
    const filePath = this.resolvePath(key);
    return fs.existsSync(filePath);
  }
}

// Global singleton instance
export const storageProvider: StorageProvider = new LocalDiskStorageProvider();
