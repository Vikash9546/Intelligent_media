import sharp from 'sharp';
import { CheckResult, clamp } from './types';
import { 
  BLUR_THRESHOLD, 
  BLUR_TENENGRAD_THRESHOLD, 
  BLUR_PEAK_BLOCK_THRESHOLD 
} from '../utils/constants';

/**
 * Blur Detection — Multi-Metric Ensemble Approach
 * 
 * We use three independent metrics to determine image sharpness:
 * 1. Global Laplacian Variance (Existing)
 * 2. Tenengrad (Sobel gradient magnitude variance)
 * 3. Local Block Sharpness (Spatial awareness)
 * 
 * Subject-Awareness:
 * Center ROI strategy ensures focused subjects are prioritized even with bokeh backgrounds.
 */

/** Helper to compute Laplacian variance for a specific pixel buffer and region */
function computeLaplacianVariance(
  pixels: Uint8Array, 
  width: number, 
  height: number,
  startX: number = 1,
  startY: number = 1,
  endX: number = width - 1,
  endY: number = height - 1
): number {
  const laplacian: number[] = [];
  
  for (let y = startY; y < endY; y++) {
    for (let x = startX; x < endX; x++) {
      const center = pixels[y * width + x];
      const top = pixels[(y - 1) * width + x];
      const bottom = pixels[(y + 1) * width + x];
      const left = pixels[y * width + (x - 1)];
      const right = pixels[y * width + (x + 1)];

      const value = top + bottom + left + right - 4 * center;
      laplacian.push(value);
    }
  }

  if (laplacian.length === 0) return 0;
  
  const n = laplacian.length;
  const mean = laplacian.reduce((sum, v) => sum + v, 0) / n;
  const variance = laplacian.reduce((sum, v) => sum + (v - mean) ** 2, 0) / n;
  return variance;
}

/** Helper to compute Tenengrad score (variance of gradient magnitude) */
function computeTenengradScore(pixels: Uint8Array, width: number, height: number): number {
  const magnitudes: number[] = [];

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      // Sobel-X: [-1 0 1; -2 0 2; -1 0 1]
      const gx = (
        -1 * pixels[(y - 1) * width + (x - 1)] + 1 * pixels[(y - 1) * width + (x + 1)] +
        -2 * pixels[y * width + (x - 1)] + 2 * pixels[y * width + (x + 1)] +
        -1 * pixels[(y + 1) * width + (x - 1)] + 1 * pixels[(y + 1) * width + (x + 1)]
      );

      // Sobel-Y: [-1 -2 -1; 0 0 0; 1 2 1]
      const gy = (
        -1 * pixels[(y - 1) * width + (x - 1)] + -2 * pixels[(y - 1) * width + x] + -1 * pixels[(y - 1) * width + (x + 1)] +
         1 * pixels[(y + 1) * width + (x - 1)] +  2 * pixels[(y + 1) * width + x] +  1 * pixels[(y + 1) * width + (x + 1)]
      );

      magnitudes.push(Math.sqrt(gx * gx + gy * gy));
    }
  }

  if (magnitudes.length === 0) return 0;

  const n = magnitudes.length;
  const mean = magnitudes.reduce((sum, v) => sum + v, 0) / n;
  const variance = magnitudes.reduce((sum, v) => sum + (v - mean) ** 2, 0) / n;
  return variance;
}

export async function analyzeBlur(filePath: string): Promise<CheckResult> {
  const { data, info } = await sharp(filePath)
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height } = info;
  const pixels = new Uint8Array(data);

  // METRIC 1: Global Laplacian Variance
  const laplacianVar = computeLaplacianVariance(pixels, width, height);

  // METRIC 2: Tenengrad Score
  const tenengradScore = computeTenengradScore(pixels, width, height);

  // METRIC 3: Local Block Sharpness (4x4 grid)
  const blockVariances: number[] = [];
  const blockW = Math.floor(width / 4);
  const blockH = Math.floor(height / 4);

  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 4; col++) {
      const var_val = computeLaplacianVariance(
        pixels, width, height,
        Math.max(1, col * blockW), 
        Math.max(1, row * blockH),
        Math.min(width - 1, (col + 1) * blockW),
        Math.min(height - 1, (row + 1) * blockH)
      );
      blockVariances.push(var_val);
    }
  }
  
  const sortedBlocks = [...blockVariances].sort((a, b) => b - a);
  const peakBlockSharpness = sortedBlocks.slice(0, 4).reduce((a, b) => a + b, 0) / 4;

  // FOCUS REGION STRATEGY: Center ROI
  const centerRoiVar = computeLaplacianVariance(
    pixels, width, height,
    Math.floor(width * 0.25),
    Math.floor(height * 0.20),
    Math.floor(width * 0.75),
    Math.floor(height * 0.80)
  );
  
  const centerRoiOverride = centerRoiVar >= (BLUR_THRESHOLD * 1.5);

  // ENSEMBLE VOTING
  let blurryVotes = 0;
  if (laplacianVar < BLUR_THRESHOLD) blurryVotes++;
  if (tenengradScore < BLUR_TENENGRAD_THRESHOLD) blurryVotes++;
  if (peakBlockSharpness < BLUR_PEAK_BLOCK_THRESHOLD) blurryVotes++;

  const passed = centerRoiOverride || (blurryVotes <= 1);

  // CONFIDENCE CALCULATION
  const laplacianNorm = clamp(laplacianVar / 500, 0, 1);
  const tenengradNorm = clamp(tenengradScore / 2000, 0, 1);
  const blockNorm     = clamp(peakBlockSharpness / 600, 0, 1);
  
  const confidence = (0.4 * laplacianNorm) + (0.3 * tenengradNorm) + (0.3 * blockNorm);

  return {
    checkName: 'blur_detection',
    passed,
    confidence,
    details: {
      laplacianVariance: Math.round(laplacianVar * 100) / 100,
      tenegradScore: Math.round(tenengradScore * 100) / 100,
      peakBlockSharpness: Math.round(peakBlockSharpness * 100) / 100,
      centerRoiVariance: Math.round(centerRoiVar * 100) / 100,
      centerRoiOverride,
      blurryVoteCount: blurryVotes,
      thresholds: { 
        laplacian: BLUR_THRESHOLD, 
        tenengrad: BLUR_TENENGRAD_THRESHOLD, 
        blockPeak: BLUR_PEAK_BLOCK_THRESHOLD 
      }
    }
  };
}
