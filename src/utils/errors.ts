/**
 * Centralized error types for the media processing pipeline.
 *
 * Distinguishing TRANSIENT vs FATAL errors is critical for retry logic:
 * - TRANSIENT errors (DB unavailable, file read I/O) → BullMQ should retry
 * - FATAL errors (corrupt file, validation failure) → mark failed immediately, no retry
 */

/** Base class for all application errors */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly errorCode: string;
  public readonly details?: Record<string, unknown>;
  /** If true, the worker should NOT retry this job */
  public readonly isFatal: boolean;

  constructor(
    statusCode: number,
    errorCode: string,
    message: string,
    options: { details?: Record<string, unknown>; isFatal?: boolean } = {},
  ) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.details = options.details;
    this.isFatal = options.isFatal ?? false;
    Error.captureStackTrace(this, this.constructor);
  }
}

/** File type is not JPEG, PNG, or WEBP */
export class UnsupportedFileTypeError extends AppError {
  constructor(mimeType: string) {
    super(415, 'UNSUPPORTED_FILE_TYPE', `File type '${mimeType}' is not supported. Use JPEG, PNG, or WEBP.`, {
      details: { providedMimeType: mimeType, supportedTypes: ['image/jpeg', 'image/png', 'image/webp'] },
      isFatal: true,
    });
  }
}

/** Uploaded file exceeds the 10MB limit */
export class FileTooLargeError extends AppError {
  constructor(sizeBytes: number) {
    super(413, 'FILE_TOO_LARGE', `File size ${(sizeBytes / 1_048_576).toFixed(2)}MB exceeds the 10MB limit.`, {
      details: { fileSizeBytes: sizeBytes, limitBytes: 10 * 1_048_576 },
      isFatal: true,
    });
  }
}

/** Image bytes cannot be decoded — file is corrupt or truncated */
export class CorruptImageError extends AppError {
  constructor(reason?: string) {
    super(422, 'CORRUPT_IMAGE', `Image could not be decoded: ${reason ?? 'unknown error'}`, {
      isFatal: true,
    });
  }
}

/** Generic upload failure (disk write error, etc.) */
export class UploadFailedError extends AppError {
  constructor(reason?: string) {
    super(500, 'UPLOAD_FAILED', `Failed to store uploaded file: ${reason ?? 'unknown error'}`, {
      isFatal: false, // Could be transient disk I/O
    });
  }
}

/** Requested jobId does not exist in the DB */
export class JobNotFoundError extends AppError {
  constructor(jobId: string) {
    super(404, 'JOB_NOT_FOUND', `No job found with ID '${jobId}'`, {
      isFatal: true,
    });
  }
}

/** Results requested but job is not yet completed */
export class JobNotCompletedError extends AppError {
  constructor(jobId: string, currentStatus: string) {
    super(409, 'JOB_NOT_COMPLETED', `Job '${jobId}' is currently '${currentStatus}'. Results are only available after completion.`, {
      details: { currentStatus },
      isFatal: true,
    });
  }
}

/** Transient infrastructure error — safe to retry */
export class TransientError extends AppError {
  constructor(message: string, cause?: Error) {
    super(503, 'TRANSIENT_ERROR', message, { isFatal: false });
    if (cause) this.stack = `${this.stack}\nCaused by: ${cause.stack}`;
  }
}

/** Type guard: narrows unknown catch values to Error */
export function toError(caught: unknown): Error {
  if (caught instanceof Error) return caught;
  return new Error(String(caught));
}
