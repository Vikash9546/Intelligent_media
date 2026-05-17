import sharp from 'sharp';
import crypto from 'crypto';
import fs from 'fs';
import { CheckResult } from './types';
import { query } from '../db/pool';

/** Helper to count differing bits between two hex-encoded 64-bit hashes */
function getHammingDistance(a: string, b: string): number {
  const diff = BigInt('0x' + a) ^ BigInt('0x' + b);
  return diff.toString(2).split('').filter(c => c === '1').length;
}

export async function analyzeDuplicates(
  filePath: string,
  jobId: string
): Promise<CheckResult> {
  const fileBuffer = fs.readFileSync(filePath);

  // --- STAGE 1: Exact duplicate (MD5 fast-path) ---
  const md5Hash = crypto.createHash('md5').update(fileBuffer).digest('hex');
  
  const { rows: exactMatches } = await query<{ job_id: string }>(
    'SELECT job_id FROM image_hashes WHERE md5_hash = $1 AND job_id != $2 LIMIT 1',
    [md5Hash, jobId]
  );

  if (exactMatches.length > 0) {
    await query(
      'INSERT INTO image_hashes (job_id, md5_hash, d_hash, created_at) VALUES ($1, $2, $3, now())',
      [jobId, md5Hash, '0000000000000000']
    );

    return {
      checkName: 'duplicate_detection',
      passed: false,
      confidence: 1.0,
      details: {
        hammingDistance: 0,
        duplicateType: 'exact_match',
        perceptualLabel: 'Previously Submitted',
        severity: 'critical'
      }
    };
  }

  // --- STAGE 2: Perceptual hash (dHash) ---
  const { data } = await sharp(filePath)
    .resize(9, 8, { fit: 'fill' })
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  let dHashBinary = '';
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const idx = row * 9 + col;
      dHashBinary += data[idx] > data[idx + 1] ? '1' : '0';
    }
  }
  const dHashHex = BigInt('0b' + dHashBinary).toString(16).padStart(16, '0');

  const { rows: recentHashes } = await query<{ job_id: string, d_hash: string }>(
    'SELECT job_id, d_hash FROM image_hashes WHERE job_id != $1 ORDER BY created_at DESC LIMIT 500',
    [jobId]
  );

  let nearestMatchJobId: string | null = null;
  let minDistance: number | null = null;

  for (const row of recentHashes) {
    const dist = getHammingDistance(dHashHex, row.d_hash);
    if (minDistance === null || dist < minDistance) {
      minDistance = dist;
      nearestMatchJobId = row.job_id;
    }
  }

  // TIERED SIMILARITY THRESHOLDS (User requested thresholds)
  let passed = true;
  let duplicateType: string = 'unique';
  let perceptualLabel: string = 'Unique Content';
  let severity: string = 'none';

  if (minDistance !== null) {
    if (minDistance === 0) {
      passed = false;
      duplicateType = 'exact_perceptual';
      perceptualLabel = 'Previously Submitted';
      severity = 'critical';
    } else if (minDistance <= 5) {
      passed = false;
      duplicateType = 'highly_similar';
      perceptualLabel = 'Highly Similar';
      severity = 'high';
    } else if (minDistance <= 12) {
      passed = false;
      duplicateType = 'visually_related';
      perceptualLabel = 'Visually Related';
      severity = 'medium';
    } else {
      duplicateType = 'unique';
      perceptualLabel = 'Unique Content';
      severity = 'none';
    }
  }

  await query(
    'INSERT INTO image_hashes (job_id, md5_hash, d_hash, created_at) VALUES ($1, $2, $3, now())',
    [jobId, md5Hash, dHashHex]
  );

  return {
    checkName: 'duplicate_detection',
    passed,
    confidence: 1.0,
    details: {
      dHash: dHashHex,
      hammingDistance: minDistance,
      duplicateType,
      perceptualLabel,
      severity
    }
  };
}
