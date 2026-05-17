import { Worker, Job } from 'bullmq';
import { createRedisConnection, QUEUE_NAME, ImageJobPayload } from './producer';
import { runAllAnalyses } from '../analysis';
import { updateJobStatus, insertAnalysisResult, incrementRetryCount } from '../db/models';
import { storage } from '../storage/provider';
import { AppError, toError } from '../utils/errors';
import logger from '../utils/logger';

/**
 * BullMQ worker — processes image analysis jobs from the queue.
 *
 * KEY DESIGN DECISIONS:
 *
 * 1. CONCURRENCY = 3:
 *    Each job runs ~5–15 seconds (OCR is the bottleneck). With 3 concurrent
 *    workers on a 4-core machine, we keep CPU busy without starving the API
 *    process of cores. At 10k uploads/day (~7 jobs/minute peak), 3 concurrent
 *    workers handle bursts comfortably.
 *
 * 2. FATAL vs TRANSIENT ERROR DISTINCTION:
 *    - Fatal (AppError with isFatal=true): corrupt file, validation failure.
 *      Worker throws a non-retriable error; BullMQ moves job to failed without
 *      consuming retry attempts.
 *    - Transient (AppError with isFatal=false, or unknown Error): DB connection
 *      lost, file I/O error. Worker throws normally; BullMQ retries with backoff.
 *
 * 3. PER-JOB ERROR ISOLATION:
 *    Each job's errors are caught and handled without crashing the worker process.
 *    A single corrupt image does not affect other jobs in the queue.
 */

/**
 * Core processor function for a single image analysis job.
 * Throws on fatal/transient errors — BullMQ handles the retry/fail decision.
 */
async function processImageJob(job: Job<ImageJobPayload>): Promise<void> {
  const { jobId, filePath, originalName, mimeType, fileSize } = job.data;
  const jobLog = logger.child({ jobId, bullJobId: job.id, attempt: job.attemptsMade + 1 });

  jobLog.info({ filePath, originalName, mimeType, fileSize }, 'Job picked up — starting processing');

  // ── Step 1: Mark job as 'processing' ────────────────────────────────────────
  await updateJobStatus(jobId, 'processing');

  // ── Step 2: Verify the file still exists ────────────────────────────────────
  // The file might have been deleted between upload and worker pickup.
  // This is a FATAL error — retrying won't recover a deleted file.
  const fileExists = await storage.exists(filePath);
  if (!fileExists) {
    const reason = `File not found at path: ${filePath}`;
    jobLog.error({ filePath }, reason);
    await updateJobStatus(jobId, 'failed', { failureReason: reason, processedAt: true });

    // Throw an unrecoverable error — BullMQ will not retry
    throw Object.assign(new Error(reason), { failedReason: reason });
  }

  // ── Step 3: Run all 7 analysis checks concurrently ──────────────────────────
  const { checks, qualityScore, perceptualHash, trustAssessment } = await runAllAnalyses(filePath, jobId);

  // ── Step 4: Persist each check result to DB ──────────────────────────────────
  // Even if individual inserts fail, we attempt all of them (partial results > none)
  const insertErrors: Error[] = [];

  for (const check of checks) {
    try {
      await insertAnalysisResult({
        jobId,
        checkName: check.checkName,
        passed: check.passed,
        confidence: check.confidence,
        details: check.details,
      });
      jobLog.info(
        { checkName: check.checkName, passed: check.passed, confidence: check.confidence },
        'Check result saved',
      );
    } catch (err) {
      const error = toError(err);
      insertErrors.push(error);
      jobLog.error({ err: error, checkName: check.checkName }, 'Failed to insert check result');
    }
  }

  if (insertErrors.length > 0) {
    // Partial DB failure — this is a transient issue (DB blip); retry is appropriate
    throw new Error(`Failed to save ${insertErrors.length}/${checks.length} check results: ${insertErrors.map(e => e.message).join('; ')}`);
  }

  // ── Step 5: Update job to 'completed' with trust assessment ──────────────────
  await updateJobStatus(jobId, 'completed', {
    qualityScore,
    perceptualHash: perceptualHash ?? undefined,
    trustAssessment,
    processedAt: true,
  });

  jobLog.info({ qualityScore, checksCount: checks.length, trustLevel: trustAssessment.trustLevel }, 'Job completed successfully');
}

/**
 * Create and start the BullMQ worker.
 * Returns the Worker instance so the caller can shut it down gracefully.
 */
export function startWorker(): Worker<ImageJobPayload> {
  const worker = new Worker<ImageJobPayload>(
    QUEUE_NAME,
    async (job) => {
      try {
        await processImageJob(job);
      } catch (err) {
        const error = toError(err);

        // Increment our own retry counter (BullMQ has its own, but we track in DB too)
        try {
          await incrementRetryCount(job.data.jobId);
        } catch {
          // Don't let a DB error mask the original processing error
        }

        // Re-throw so BullMQ handles retry/failure logic
        throw error;
      }
    },
    {
      connection: createRedisConnection(),
      concurrency: parseInt(process.env.QUEUE_CONCURRENCY ?? '3', 10),
    },
  );

  worker.on('completed', (job) => {
    logger.info({ jobId: job.data.jobId, bullJobId: job.id }, 'BullMQ: job completed');
  });

  worker.on('failed', (job, err) => {
    if (!job) {
      logger.error({ err }, 'BullMQ: job failed (no job data)');
      return;
    }

    const isExhausted = job.attemptsMade >= (job.opts.attempts ?? 3);

    logger.error(
      {
        jobId: job.data.jobId,
        bullJobId: job.id,
        attempt: job.attemptsMade,
        maxAttempts: job.opts.attempts,
        isExhausted,
        err,
      },
      isExhausted ? 'BullMQ: job exhausted all retries — marking as failed' : 'BullMQ: job failed, will retry',
    );

    // Only mark DB as failed when all retry attempts are exhausted
    if (isExhausted) {
      updateJobStatus(job.data.jobId, 'failed', {
        failureReason: err.message,
        processedAt: true,
      }).catch((dbErr) => {
        logger.error({ dbErr, jobId: job.data.jobId }, 'Failed to update job status to failed in DB');
      });
    }
  });

  worker.on('error', (err) => {
    logger.error({ err }, 'BullMQ worker error');
  });

  logger.info(
    { queue: QUEUE_NAME, concurrency: parseInt(process.env.QUEUE_CONCURRENCY ?? '3', 10) },
    'BullMQ worker started',
  );

  return worker;
}
