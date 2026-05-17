import sharp from 'sharp';
import { CheckResult, clamp } from './types';
import {
  BRIGHTNESS_TOO_DARK,
  BRIGHTNESS_TOO_BRIGHT,
  BRIGHTNESS_DARK_PIXEL_THRESHOLD,
  BRIGHTNESS_DARK_MASS_RATIO,
  BRIGHTNESS_BLOWN_PIXEL_THRESHOLD,
  BRIGHTNESS_BLOWN_RATIO,
} from '../utils/constants';

/** Extracts P5, P50 (median), and P95 from image histogram */
function computeHistogramPercentiles(data: Uint8Array): { p5: number; p50: number; p95: number } {
  const histogram = new Uint32Array(256);
  for (let i = 0; i < data.length; i++) histogram[data[i]]++;

  const total = data.length;
  let p5 = 0, p50 = 0, p95 = 0;
  let acc = 0;

  for (let i = 0; i < 256; i++) {
    acc += histogram[i];
    if (p5 === 0 && acc >= total * 0.05) p5 = i;
    if (p50 === 0 && acc >= total * 0.50) p50 = i;
    if (p95 === 0 && acc >= total * 0.95) p95 = i;
  }
  return { p5, p50, p95 };
}

/** Computes RMS Contrast (Root Mean Square Deviation) */
function computeRMSContrast(data: Uint8Array, mean: number): number {
  let sumSqDiff = 0;
  for (let i = 0; i < data.length; i++) {
    sumSqDiff += (data[i] - mean) ** 2;
  }
  return Math.sqrt(sumSqDiff / data.length);
}

/** 
 * Finds the largest connected blown region using a coarse 16x16 grid.
 */
function getLargestBlownRegionRatio(data: Uint8Array, width: number, height: number): number {
  const GRID_SIZE = 16;
  const grid = new Uint8Array(GRID_SIZE * GRID_SIZE);
  const blockW = Math.floor(width / GRID_SIZE);
  const blockH = Math.floor(height / GRID_SIZE);

  for (let gy = 0; gy < GRID_SIZE; gy++) {
    for (let gx = 0; gx < GRID_SIZE; gx++) {
      let blownInBlock = 0;
      for (let y = gy * blockH; y < (gy + 1) * blockH; y++) {
        for (let x = gx * blockW; x < (gx + 1) * blockW; x++) {
          if (data[y * width + x] >= BRIGHTNESS_BLOWN_PIXEL_THRESHOLD) blownInBlock++;
        }
      }
      if (blownInBlock / (blockW * blockH) > 0.5) grid[gy * GRID_SIZE + gx] = 1;
    }
  }

  let maxArea = 0;
  const visited = new Set<number>();
  for (let i = 0; i < grid.length; i++) {
    if (grid[i] === 1 && !visited.has(i)) {
      let area = 0;
      const stack = [i];
      visited.add(i);
      while (stack.length > 0) {
        const curr = stack.pop()!;
        area++;
        const cx = curr % GRID_SIZE;
        const cy = Math.floor(curr / GRID_SIZE);
        [[0,1], [0,-1], [1,0], [-1,0]].forEach(([dx, dy]) => {
          const nx = cx + dx;
          const ny = cy + dy;
          const ni = ny * GRID_SIZE + nx;
          if (nx >= 0 && nx < GRID_SIZE && ny >= 0 && ny < GRID_SIZE && grid[ni] === 1 && !visited.has(ni)) {
            visited.add(ni);
            stack.push(ni);
          }
        });
      }
      maxArea = Math.max(maxArea, area);
    }
  }
  return maxArea / (GRID_SIZE * GRID_SIZE);
}

/** Logistic sigmoid for non-linear confidence mapping */
function sigmoid(x: number, k: number = 10, x0: number = 0.5): number {
  return 1 / (1 + Math.exp(-k * (x - x0)));
}

export async function analyzeBrightness(filePath: string): Promise<CheckResult> {
  const { data, info } = await sharp(filePath)
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height } = info;
  const pixels = new Uint8Array(data);

  const { p5, p50: medianLuminance, p95 } = computeHistogramPercentiles(pixels);

  let sum = 0;
  for (let i = 0; i < pixels.length; i++) sum += pixels[i];
  const meanLuminance = sum / pixels.length;
  const rmsContrast = computeRMSContrast(pixels, meanLuminance);

  let weightedSum = 0;
  let totalWeight = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const dx = (x / width - 0.5) / 0.3;
      const dy = (y / height - 0.75) / 0.25;
      const weight = Math.exp(-(dx * dx + dy * dy));
      weightedSum += pixels[y * width + x] * weight;
      totalWeight += weight;
    }
  }
  const weightedLuminance = weightedSum / totalWeight;

  const blownRegionRatio = getLargestBlownRegionRatio(pixels, width, height);
  const shadowSpread = medianLuminance - p5;

  const failures: string[] = [];
  if (medianLuminance < BRIGHTNESS_TOO_DARK) failures.push('underexposed');
  if (medianLuminance > BRIGHTNESS_TOO_BRIGHT) failures.push('overexposed');
  if (p5 < 10 && shadowSpread < 20) failures.push('shadow_clipping');
  if (p95 > 250 && blownRegionRatio > 0.15) failures.push('highlight_clipping');
  if (rmsContrast < 25) failures.push('low_contrast');

  const passed = failures.length === 0;

  let verdict = 'balanced';
  if (failures.length > 0) {
    if (failures.includes('underexposed') || failures.includes('shadow_clipping')) verdict = 'too_dark';
    else if (failures.includes('overexposed') || failures.includes('highlight_clipping')) verdict = 'too_bright';
    else verdict = failures[0];
  }

  const contrastScore = sigmoid(rmsContrast, 0.15, 40);
  const shadowScore   = sigmoid(shadowSpread, 0.1, 30);
  const highlightScore = 1 - sigmoid(blownRegionRatio, 20, 0.2);
  const medianScore   = 1 - clamp(Math.abs(medianLuminance - 128) / 100, 0, 1);

  const confidence = (0.3 * medianScore) + (0.3 * contrastScore) + (0.2 * shadowScore) + (0.2 * highlightScore);

  return {
    checkName: 'brightness_analysis',
    passed,
    confidence: Math.round(confidence * 100) / 100,
    details: {
      medianLuminance,
      rmsContrast: Math.round(rmsContrast * 100) / 100,
      blownRegionRatio: Math.round(blownRegionRatio * 100) / 100,
      failures,
      verdict,
      perceptualLabels: {
        exposure: medianLuminance < 40 ? 'severely_underexposed' : medianLuminance < 75 ? 'slightly_dark' : medianLuminance > 210 ? 'overexposed' : 'balanced',
        contrast: rmsContrast < 20 ? 'flat' : rmsContrast < 35 ? 'low' : 'optimal',
        dynamicRange: blownRegionRatio > 0.2 ? 'severely_clipped' : shadowSpread < 15 ? 'crushed_shadows' : 'optimal'
      }
    }
  };
}
