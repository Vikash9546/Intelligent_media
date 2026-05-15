import fs from 'fs/promises';
import path from 'path';
import logger from '../utils/logger';

/**
 * Storage abstraction layer.
 *
 * WHY ABSTRACT STORAGE?
 * The MVP stores files on the local filesystem, which is fast and zero-cost to set up.
 * However, local disk has obvious limitations: it doesn't survive container restarts,
 * can't be shared across horizontally-scaled API instances, and has no CDN story.
 *
 * By implementing a StorageProvider interface here, swapping to S3 (or GCS, Azure Blob)
 * requires only:
 *   1. A new class implementing StorageProvider
 *   2. Changing the factory function below — no call-site changes
 *
 * S3 implementation sketch (not included to keep MVP lean):
 *   class S3StorageProvider implements StorageProvider {
 *     async save(buffer, filename) { await s3.putObject({ Bucket, Key: filename, Body: buffer }); return `s3://${Bucket}/${filename}`; }
 *     async read(filePath) { const obj = await s3.getObject({ Bucket, Key: filePath }).promise(); return obj.Body as Buffer; }
 *     async delete(filePath) { await s3.deleteObject({ Bucket, Key: filePath }).promise(); }
 *     async exists(filePath) { try { await s3.headObject({ Bucket, Key: filePath }).promise(); return true; } catch { return false; } }
 *   }
 */

export interface StorageProvider {
  /** Persist a buffer and return the storage path (local path or S3 key). */
  save(buffer: Buffer, filename: string): Promise<string>;
  /** Read a file back as a Buffer. */
  read(filePath: string): Promise<Buffer>;
  /** Remove a file. Does not throw if file is already gone. */
  delete(filePath: string): Promise<void>;
  /** Check if a file exists. */
  exists(filePath: string): Promise<boolean>;
}

// ─── Local filesystem implementation ─────────────────────────────────────────

export class LocalStorageProvider implements StorageProvider {
  private readonly baseDir: string;

  constructor(baseDir: string) {
    this.baseDir = baseDir;
  }

  async save(buffer: Buffer, filename: string): Promise<string> {
    await fs.mkdir(this.baseDir, { recursive: true });
    const filePath = path.join(this.baseDir, filename);
    await fs.writeFile(filePath, buffer);
    logger.debug({ filePath, sizeBytes: buffer.length }, 'File saved to local storage');
    return filePath;
  }

  async read(filePath: string): Promise<Buffer> {
    return fs.readFile(filePath);
  }

  async delete(filePath: string): Promise<void> {
    try {
      await fs.unlink(filePath);
      logger.debug({ filePath }, 'File deleted from local storage');
    } catch (err: unknown) {
      const nodeErr = err as NodeJS.ErrnoException;
      if (nodeErr.code === 'ENOENT') return; // already gone — not an error
      throw err;
    }
  }

  async exists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
}

// ─── Factory ─────────────────────────────────────────────────────────────────

/** Returns the active storage provider based on environment configuration. */
export function createStorageProvider(): StorageProvider {
  const uploadDir = path.resolve(process.env.UPLOAD_DIR ?? './uploads');
  return new LocalStorageProvider(uploadDir);
}

// Singleton for use across the application
export const storage = createStorageProvider();
