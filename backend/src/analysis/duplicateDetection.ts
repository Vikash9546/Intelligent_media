import sharp from 'sharp';
import { CheckResult } from './types';
import { DUPLICATE_LOOKBACK_COUNT, DUPLICATE_HAMMING_THRESHOLD } from '../utils/constants';
import { getRecentHashes, updateJobStatus } from '../db/models';

/**
 * Duplicate Detection — Perceptual Hashing (dHash)
 *
 * WHY PHASH OVER MD5/SHA256?
 * Cryptographic hashes change completely with any bit flip — a JPEG re-saved
 * at 95% quality looks identical to humans but produces a completely different
 * SHA256. Perceptual hashes are designed to be similar for visually similar
 * images, tolerating:
 *   - Re-encoding / compression artifacts
 *   - Slight crops or resizes
 *   - Minor colour adjustments
 *
 * WHY DHASH SPECIFICALLY?
 * dHash (difference hash) computes the gradient between adjacent pixels in a
 * downscaled image. It's:
 *   - Faster than pHash (no DCT computation)
 *   - More robust than aHash to lighting changes
 *   - Still 64 bits, fitting in a VARCHAR(64) as a hex string
 *
 * Hamming distance measures how many bits differ. Distance < 10 (~15% of 64
 * bits) reliably identifies duplicates in practice.
 */

/** Compute dHash: resize to 9×8, compare adjacent pixels → 64-bit fingerprint */
async function computeDHash(filePath: string): Promise<string> {
  // 9×8 grayscale → 8×8 comparisons = 64 bits
  const { data } = await sharp(filePath)
    .resize(9, 8, { fit: 'fill' })
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  let hash = BigInt(0);
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const left = data[row * 9 + col];
      const right = data[row * 9 + col + 1];
      // Bit is 1 if left pixel is brighter than right
      hash = (hash << BigInt(1)) | BigInt(left > right ? 1 : 0);
    }
  }

  // Return as 16-character hex string (64 bits / 4 bits per hex char)
  return hash.toString(16).padStart(16, '0');
}

/** Count differing bits between two hex-encoded 64-bit hashes */
function hammingDistance(hashA: string, hashB: string): number {
  const a = BigInt('0x' + hashA);
  const b = BigInt('0x' + hashB);
  let xor = a ^ b;
  let distance = 0;
  while (xor > BigInt(0)) {
    distance += Number(xor & BigInt(1));
    xor >>= BigInt(1);
  }
  return distance;
}

export async function analyzeDuplicates(
  filePath: string,
  jobId: string,
): Promise<CheckResult & { hash: string }> {
  const hash = await computeDHash(filePath);

  // Persist the hash immediately so concurrent jobs can detect this one too
  await updateJobStatus(jobId, 'processing', { perceptualHash: hash });

  // Fetch recent hashes (excluding current job)
  const recentHashes = await getRecentHashes(jobId, DUPLICATE_LOOKBACK_COUNT);

  let nearestMatchJobId: string | null = null;
  let minHammingDistance: number | null = null;

  for (const row of recentHashes) {
    if (!row.perceptual_hash) continue;
    const distance = hammingDistance(hash, row.perceptual_hash);
    if (minHammingDistance === null || distance < minHammingDistance) {
      minHammingDistance = distance;
      nearestMatchJobId = row.id;
    }
  }

  const isDuplicate =
    minHammingDistance !== null && minHammingDistance < DUPLICATE_HAMMING_THRESHOLD;

  return {
    checkName: 'duplicate_detection',
    passed: !isDuplicate,
    confidence: isDuplicate ? 1 - minHammingDistance! / DUPLICATE_HAMMING_THRESHOLD : 1.0,
    details: {
      hash,
      nearestMatchJobId,
      hammingDistance: minHammingDistance,
      threshold: DUPLICATE_HAMMING_THRESHOLD,
    },
    hash,
  };
}
