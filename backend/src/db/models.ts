import { query } from './pool';

/** Database row shapes — kept close to the DB schema, not inflated with domain logic. */

export interface ImageJobRow {
  id: string;
  original_name: string;
  file_path: string;
  mime_type: string;
  file_size_bytes: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  failure_reason: string | null;
  retry_count: number;
  quality_score: number | null;
  perceptual_hash: string | null;
  created_at: string;
  updated_at: string;
  processed_at: string | null;
  trust_assessment: any | null;
}

export interface AnalysisResultRow {
  id: string;
  job_id: string;
  check_name: string;
  passed: boolean;
  confidence: number | null;
  details: Record<string, unknown> | null;
  created_at: string;
}

// ─── image_jobs queries ───────────────────────────────────────────────────────

export async function insertImageJob(params: {
  id: string;
  originalName: string;
  filePath: string;
  mimeType: string;
  fileSizeBytes: number;
}): Promise<ImageJobRow> {
  const { rows } = await query<ImageJobRow>(
    `INSERT INTO image_jobs (id, original_name, file_path, mime_type, file_size_bytes)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [params.id, params.originalName, params.filePath, params.mimeType, params.fileSizeBytes],
  );
  return rows[0];
}

export async function getImageJob(id: string): Promise<ImageJobRow | null> {
  const { rows } = await query<ImageJobRow>('SELECT * FROM image_jobs WHERE id = $1', [id]);
  return rows[0] ?? null;
}

export async function updateJobStatus(
  id: string,
  status: ImageJobRow['status'],
  extras: {
    failureReason?: string;
    qualityScore?: number;
    perceptualHash?: string;
    trustAssessment?: any;
    processedAt?: boolean; // if true, set to now()
  } = {},
): Promise<void> {
  const sets: string[] = ['status = $2', 'updated_at = now()'];
  const params: unknown[] = [id, status];
  let idx = 3;

  if (extras.failureReason !== undefined) {
    sets.push(`failure_reason = $${idx++}`);
    params.push(extras.failureReason);
  }
  if (extras.qualityScore !== undefined) {
    sets.push(`quality_score = $${idx++}`);
    params.push(extras.qualityScore);
  }
  if (extras.perceptualHash !== undefined) {
    sets.push(`perceptual_hash = $${idx++}`);
    params.push(extras.perceptualHash);
  }
  if (extras.trustAssessment !== undefined) {
    sets.push(`trust_assessment = $${idx++}`);
    params.push(JSON.stringify(extras.trustAssessment));
  }
  if (extras.processedAt) {
    sets.push('processed_at = now()');
  }

  await query(`UPDATE image_jobs SET ${sets.join(', ')} WHERE id = $1`, params);
}

export async function incrementRetryCount(id: string): Promise<void> {
  await query('UPDATE image_jobs SET retry_count = retry_count + 1, updated_at = now() WHERE id = $1', [id]);
}

export async function listImageJobs(params: {
  page: number;
  limit: number;
  status?: string;
}): Promise<{ rows: ImageJobRow[]; total: number }> {
  const offset = (params.page - 1) * params.limit;
  const conditions: string[] = [];
  const queryParams: unknown[] = [];
  let idx = 1;

  if (params.status) {
    conditions.push(`status = $${idx++}`);
    queryParams.push(params.status);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const { rows } = await query<ImageJobRow>(
    `SELECT * FROM image_jobs ${where} ORDER BY created_at DESC LIMIT $${idx++} OFFSET $${idx++}`,
    [...queryParams, params.limit, offset],
  );

  const { rows: countRows } = await query<{ count: string }>(
    `SELECT COUNT(*) as count FROM image_jobs ${where}`,
    queryParams,
  );

  return { rows, total: parseInt(countRows[0].count, 10) };
}

/** Fetch last N perceptual hashes for duplicate detection, excluding current job. */
export async function getRecentHashes(currentJobId: string, limit: number): Promise<Array<{ id: string; perceptual_hash: string }>> {
  const { rows } = await query<{ id: string; perceptual_hash: string }>(
    `SELECT id, perceptual_hash FROM image_jobs
     WHERE perceptual_hash IS NOT NULL AND id != $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [currentJobId, limit],
  );
  return rows;
}

// ─── analysis_results queries ─────────────────────────────────────────────────

export async function insertAnalysisResult(params: {
  jobId: string;
  checkName: string;
  passed: boolean;
  confidence: number;
  details: Record<string, unknown>;
}): Promise<void> {
  await query(
    `INSERT INTO analysis_results (job_id, check_name, passed, confidence, details)
     VALUES ($1, $2, $3, $4, $5)`,
    [params.jobId, params.checkName, params.passed, params.confidence, JSON.stringify(params.details)],
  );
}

export async function getAnalysisResultsByJobId(jobId: string): Promise<AnalysisResultRow[]> {
  const { rows } = await query<AnalysisResultRow>(
    'SELECT * FROM analysis_results WHERE job_id = $1 ORDER BY created_at ASC',
    [jobId],
  );
  return rows;
}
