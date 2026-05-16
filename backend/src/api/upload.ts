import { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { fromBuffer } from 'file-type';
import sharp from 'sharp';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { storage } from '../storage/provider';
import { insertImageJob } from '../db/models';
import { enqueueImageJob } from '../queue/producer';
import {
  UnsupportedFileTypeError,
  FileTooLargeError,
  CorruptImageError,
  UploadFailedError,
  toError,
} from '../utils/errors';
import { MAX_FILE_SIZE_BYTES, ALLOWED_MIME_TYPES } from '../utils/constants';
import logger from '../utils/logger';

/**
 * Multer configuration — memory storage so we can inspect bytes before saving.
 *
 * WHY MEMORY STORAGE?
 * Disk storage would save the file before we validate it, creating orphaned
 * files on validation failure. Memory storage lets us:
 * 1. Check magic bytes (actual file type)
 * 2. Attempt image decode (detect corrupt files)
 * 3. Only then persist to disk
 *
 * Trade-off: at 10MB max, this keeps up to 10MB × concurrency in memory.
 * With 3 concurrent uploads that's 30MB — well within typical server RAM.
 * At higher scale, switch to temp-file storage + explicit cleanup.
 */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE_BYTES, // Multer rejects files > 10MB with MulterError
    files: 1,                      // Only one file per request
  },
  fileFilter: (_req, file, cb) => {
    // Pre-filter by declared MIME type (quick rejection before full read)
    // Magic-byte check happens after the file is in memory (see handler below)
    const declared = file.mimetype as string;
    if (!ALLOWED_MIME_TYPES.includes(declared as (typeof ALLOWED_MIME_TYPES)[number])) {
      cb(new UnsupportedFileTypeError(declared));
    } else {
      cb(null, true);
    }
  },
});

/** Multer middleware as a promise for cleaner async/await usage */
function runMulter(req: Request, res: Response): Promise<void> {
  return new Promise((resolve, reject) => {
    upload.single('image')(req, res, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

/** Extension from MIME type */
function mimeToExt(mimeType: string): string {
  const map: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
  };
  return map[mimeType] ?? 'bin';
}

/**
 * POST /api/v1/upload
 *
 * Flow:
 * 1. Multer: limit size, declared MIME type
 * 2. Magic bytes: verify actual file type (prevent disguised executables)
 * 3. Sharp decode: detect corrupt/truncated images
 * 4. Persist to storage
 * 5. Insert DB record
 * 6. Enqueue BullMQ job
 * 7. Return 202 Accepted
 */
export async function uploadHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  // ── Step 1: Parse multipart form ────────────────────────────────────────────
  try {
    await runMulter(req, res);
  } catch (err) {
    const error = toError(err);

    // Handle Multer's built-in size limit error
    if (error.name === 'MulterError' && (error as NodeJS.ErrnoException).code === 'LIMIT_FILE_SIZE') {
      next(new FileTooLargeError(MAX_FILE_SIZE_BYTES + 1)); // exact size unknown at this point
      return;
    }

    next(err);
    return;
  }

  if (!req.file) {
    res.status(400).json({
      error: 'VALIDATION_ERROR',
      message: 'No file uploaded. Include an "image" field in the multipart form.',
    });
    return;
  }

  const fileBuffer = req.file.buffer;
  const originalName = req.file.originalname;

  // ── Step 2: Magic byte validation ────────────────────────────────────────────
  // file-type reads the first bytes of the buffer to determine the actual format.
  // This prevents attacks like a .php file renamed to .jpg.
  const detectedType = await fromBuffer(fileBuffer);

  if (!detectedType || !ALLOWED_MIME_TYPES.includes(detectedType.mime as (typeof ALLOWED_MIME_TYPES)[number])) {
    next(new UnsupportedFileTypeError(detectedType?.mime ?? 'unknown'));
    return;
  }

  const mimeType = detectedType.mime;

  // ── Step 3: Image integrity validation ───────────────────────────────────────
  // Attempt a full decode. Sharp will throw on corrupt/truncated files.
  // We use .stats() which decodes enough to validate but doesn't return the full buffer.
  try {
    await sharp(fileBuffer).stats();
  } catch (err) {
    const error = toError(err);
    next(new CorruptImageError(error.message));
    return;
  }

  // ── Steps 4–6: Persist, insert DB, enqueue ───────────────────────────────────
  const jobId = uuidv4();
  const ext = mimeToExt(mimeType);
  const filename = `${jobId}.${ext}`;

  let filePath: string;

  try {
    filePath = await storage.save(fileBuffer, filename);
  } catch (err) {
    const error = toError(err);
    next(new UploadFailedError(error.message));
    return;
  }

  try {
    await insertImageJob({
      id: jobId,
      originalName,
      filePath,
      mimeType,
      fileSizeBytes: fileBuffer.length,
    });

    await enqueueImageJob({
      jobId,
      filePath,
      originalName,
      mimeType,
      fileSize: fileBuffer.length,
    });
  } catch (err) {
    // DB or queue failure after file was saved — clean up the orphaned file
    logger.error({ err, jobId, filePath }, 'Failed to insert job or enqueue — cleaning up file');
    await storage.delete(filePath).catch((cleanupErr) => {
      logger.error({ cleanupErr, filePath }, 'Failed to clean up orphaned upload file');
    });
    next(new UploadFailedError(toError(err).message));
    return;
  }

  logger.info({ jobId, originalName, mimeType, sizeBytes: fileBuffer.length }, 'Upload accepted');

  // 202 Accepted: the request has been received but processing is async
  res.status(202).json({
    jobId,
    status: 'pending',
    message: 'Image received. Processing started.',
  });
}
