import { Request, Response } from 'express';
import {
  getImageJob,
  getAnalysisResultsByJobId,
  listImageJobs,
} from '../db/models';
import { JobNotFoundError, JobNotCompletedError } from '../utils/errors';
import logger from '../utils/logger';

/**
 * GET /api/v1/jobs/:jobId/status
 *
 * Returns the current processing status of a job.
 * Safe to poll repeatedly — read-only, no side effects.
 */
export async function getJobStatus(req: Request, res: Response): Promise<void> {
  const { jobId } = req.params;

  const job = await getImageJob(jobId);
  if (!job) throw new JobNotFoundError(jobId);

  res.status(200).json({
    jobId: job.id,
    status: job.status,
    createdAt: job.created_at,
    processedAt: job.processed_at,
    retryCount: job.retry_count,
    failureReason: job.failure_reason,
  });
}

/**
 * GET /api/v1/jobs/:jobId/results
 *
 * Returns full analysis results. Only available when status = 'completed'.
 * Returns 409 Conflict for in-progress jobs so callers know to retry later.
 *
 * WHY 409 CONFLICT (not 200 with empty results)?
 * Returning 200 with empty data would look like a bug to API consumers.
 * 409 signals "the request is valid but cannot be fulfilled in the current
 * server state" — exactly right for a job still processing.
 */
export async function getJobResults(req: Request, res: Response): Promise<void> {
  const { jobId } = req.params;

  const job = await getImageJob(jobId);
  if (!job) throw new JobNotFoundError(jobId);

  if (job.status !== 'completed') {
    throw new JobNotCompletedError(jobId, job.status);
  }

  const analysisRows = await getAnalysisResultsByJobId(jobId);

  const checks = analysisRows.map((row) => ({
    checkName: row.check_name,
    passed: row.passed,
    confidence: row.confidence,
    details: row.details,
  }));

  const totalChecks = checks.length;
  const passedChecks = checks.filter((c) => c.passed).length;
  const failedChecks = checks.filter((c) => !c.passed);

  res.status(200).json({
    jobId: job.id,
    status: job.status,
    qualityScore: job.quality_score,
    processedAt: job.processed_at,
    checks,
    summary: {
      totalChecks,
      passed: passedChecks,
      failed: failedChecks.length,
      failedChecks: failedChecks.map((c) => c.checkName),
    },
  });
}

/**
 * GET /api/v1/jobs/:jobId/failure
 *
 * Returns failure details for a failed job.
 * Returns 200 even if not failed (status reflects in the body) — callers
 * can check status first or call this speculatively.
 */
export async function getJobFailure(req: Request, res: Response): Promise<void> {
  const { jobId } = req.params;

  const job = await getImageJob(jobId);
  if (!job) throw new JobNotFoundError(jobId);

  res.status(200).json({
    jobId: job.id,
    status: job.status,
    failureReason: job.failure_reason,
    retryCount: job.retry_count,
    createdAt: job.created_at,
    processedAt: job.processed_at,
  });
}

/**
 * GET /api/v1/jobs
 *
 * List jobs with pagination and optional status filter.
 * ?page=1&limit=20&status=completed
 */
export async function listJobs(req: Request, res: Response): Promise<void> {
  const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10));
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? '20'), 10)));
  const status = typeof req.query.status === 'string' ? req.query.status : undefined;

  const VALID_STATUSES = ['pending', 'processing', 'completed', 'failed'];
  if (status && !VALID_STATUSES.includes(status)) {
    res.status(400).json({
      error: 'VALIDATION_ERROR',
      message: `Invalid status filter. Must be one of: ${VALID_STATUSES.join(', ')}`,
    });
    return;
  }

  const { rows, total } = await listImageJobs({ page, limit, status });

  const jobs = rows.map((job) => ({
    jobId: job.id,
    originalName: job.original_name,
    status: job.status,
    qualityScore: job.quality_score,
    mimeType: job.mime_type,
    fileSizeBytes: job.file_size_bytes,
    retryCount: job.retry_count,
    createdAt: job.created_at,
    processedAt: job.processed_at,
  }));

  res.status(200).json({
    jobs,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  });
}
