import sharp from 'sharp';
import { CheckResult, clamp } from './types';
import { BLUR_THRESHOLD, BLUR_CONFIDENCE_DIVISOR } from '../utils/constants';

/**
 * Blur Detection — Laplacian Variance Method
 *
 * WHY LAPLACIAN VARIANCE?
 * The Laplacian operator computes the second derivative of pixel intensities,
 * acting as an edge detector. In a sharp image, edges are crisp → high second-
 * derivative magnitude → high variance across the Laplacian output.
 * In a blurry image, transitions are smooth → low variance.
 *
 * We chose this over FFT-based methods because:
 * 1. It's a single convolution — fast even on large images.
 * 2. No ML model needed — purely mathematical.
 * 3. Works well for motion blur and out-of-focus blur.
 *
 * Limitation: images with very uniform content (e.g. blank wall) may
 * produce low variance even when sharp. This is acceptable for the MVP.
 *
 * Laplacian kernel (3×3):
 *   0  1  0
 *   1 -4  1
 *   0  1  0
 */
export async function analyzeBlur(filePath: string): Promise<CheckResult> {
  // 1. Load as grayscale — colour channels add noise without information gain
  const { data, info } = await sharp(filePath)
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const width = info.width;
  const height = info.height;
  const pixels = new Uint8Array(data); // 8-bit grayscale values

  // 2. Apply Laplacian kernel via manual convolution.
  //    We skip the border pixels (1-pixel padding) to avoid edge artifacts.
  const laplacian: number[] = [];
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const center = pixels[y * width + x];
      const top = pixels[(y - 1) * width + x];
      const bottom = pixels[(y + 1) * width + x];
      const left = pixels[y * width + (x - 1)];
      const right = pixels[y * width + (x + 1)];

      // Laplacian: top + bottom + left + right - 4*center
      const value = top + bottom + left + right - 4 * center;
      laplacian.push(value);
    }
  }

  // 3. Compute variance of the Laplacian output
  const n = laplacian.length;
  const mean = laplacian.reduce((sum, v) => sum + v, 0) / n;
  const variance = laplacian.reduce((sum, v) => sum + (v - mean) ** 2, 0) / n;

  const passed = variance >= BLUR_THRESHOLD;
  const confidence = clamp(variance / BLUR_CONFIDENCE_DIVISOR, 0, 1);

  return {
    checkName: 'blur_detection',
    passed,
    confidence,
    details: {
      laplacianVariance: Math.round(variance * 100) / 100,
      threshold: BLUR_THRESHOLD,
    },
  };
}
