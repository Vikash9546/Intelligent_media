import sharp from 'sharp';
import { CheckResult, clamp } from './types';
import { 
  BLUR_THRESHOLD, 
  BLUR_TENENGRAD_THRESHOLD, 
  BLUR_LOWER_QUARTILE_BLOCK_THRESHOLD,
  BLUR_COHERENCE_THRESHOLD,
  BLUR_MIN_ENTROPY_FOR_ROI,
  BLUR_HIGH_LAPLACIAN_THRESHOLD
} from '../utils/constants';

/**
 * Blur Detection — Stabilized Production-Grade Pipeline
 * 
 * Final Stabilizations:
 * 1. Resolution Normalization: Consistent analysis at 512px scale.
 * 2. 8-Neighbor Laplacian: Superior isotropic and diagonal detail capture.
 * 3. Directional Coherence: Fusion of entropy and dominance for motion detection.
 * 4. Additive Confidence Scoring: Stable, human-perceptual quality grading.
 * 5. Spatial Block Weighting: Subject-region prioritization (center over corners).
 */

const MAX_ENTROPY = Math.log2(36);

/** Helper to compute 8-neighbor Laplacian variance */
function computeLaplacianVariance8(
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
      // 8-neighbor kernel for improved isotropic sensitivity
      const val = (
        8 * pixels[y * width + x] -
        pixels[(y - 1) * width + (x - 1)] - pixels[(y - 1) * width + x] - pixels[(y - 1) * width + (x + 1)] -
        pixels[y * width + (x - 1)] - pixels[y * width + (x + 1)] -
        pixels[(y + 1) * width + (x - 1)] - pixels[(y + 1) * width + (x) ] - pixels[(y + 1) * width + (x + 1)]
      );
      laplacian.push(val);
    }
  }

  if (laplacian.length === 0) return 0;
  
  const n = laplacian.length;
  const mean = laplacian.reduce((sum, v) => sum + v, 0) / n;
  const variance = laplacian.reduce((sum, v) => sum + (v - mean) ** 2, 0) / n;
  return variance;
}

/** Computes Tenengrad, Weighted Entropy, and Directional Dominance */
function computeGradientsEntropyAndDominance(pixels: Uint8Array, width: number, height: number): { 
  tenengrad: number; 
  entropy: number;
  dominance: number;
} {
  const magnitudes: number[] = [];
  const bins = new Float32Array(36); 
  const MAGNITUDE_THRESHOLD = 45;    // Higher floor for low-light robustness

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const gx = (
        -1 * pixels[(y - 1) * width + (x - 1)] + 1 * pixels[(y - 1) * width + (x + 1)] +
        -2 * pixels[y * width + (x - 1)] + 2 * pixels[y * width + (x + 1)] +
        -1 * pixels[(y + 1) * width + (x - 1)] + 1 * pixels[(y + 1) * width + (x + 1)]
      );

      const gy = (
        -1 * pixels[(y - 1) * width + (x - 1)] + -2 * pixels[(y - 1) * width + x] + -1 * pixels[(y - 1) * width + (x + 1)] +
         1 * pixels[(y + 1) * width + (x - 1)] +  2 * pixels[(y + 1) * width + x] +  1 * pixels[(y + 1) * width + (x + 1)]
      );

      const mag = Math.sqrt(gx * gx + gy * gy);
      magnitudes.push(mag);

      if (mag > MAGNITUDE_THRESHOLD) {
        let angle = Math.atan2(gy, gx);
        if (angle < 0) angle += 2 * Math.PI;
        const bin = Math.floor((angle / (2 * Math.PI)) * 36) % 36;
        bins[bin] += mag; 
      }
    }
  }

  const n = magnitudes.length;
  const mean = magnitudes.reduce((sum, v) => sum + v, 0) / n;
  const tenengrad = magnitudes.reduce((sum, v) => sum + (v - mean) ** 2, 0) / n;

  const totalEnergy = bins.reduce((a, b) => a + b, 0);
  let entropy = 0;
  let maxBinEnergy = 0;
  if (totalEnergy > 0) {
    for (let i = 0; i < 36; i++) {
      const p = bins[i] / totalEnergy;
      if (p > 0) entropy -= p * Math.log2(p);
      if (bins[i] > maxBinEnergy) maxBinEnergy = bins[i];
    }
  }
  const dominance = totalEnergy > 0 ? maxBinEnergy / totalEnergy : 0;

  return { tenengrad, entropy, dominance };
}

export async function analyzeBlur(filePath: string): Promise<CheckResult> {
  const { data, info } = await sharp(filePath)
    .resize(512, 512, { fit: 'inside', withoutEnlargement: true }) // Resolution Normalization
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height } = info;
  const pixels = new Uint8Array(data);

  // METRIC 1 & 2: Edge Energy & Coherence
  const laplacianVar = computeLaplacianVariance8(pixels, width, height);
  const { tenengrad, entropy, dominance } = computeGradientsEntropyAndDominance(pixels, width, height);
  
  const entropyNorm = clamp(entropy / MAX_ENTROPY, 0, 1);
  const coherence = dominance * (1 - entropyNorm);

  // METRIC 3: Weighted Spatial Blocks (4x4)
  const blockVariances: number[] = [];
  const blockW = Math.floor(width / 4);
  const blockH = Math.floor(height / 4);
  const blockWeights = [
    0.6, 0.8, 0.8, 0.6,
    0.8, 1.0, 1.0, 0.8,
    0.8, 1.0, 1.0, 0.8,
    0.6, 0.8, 0.8, 0.6
  ];

  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 4; col++) {
      const variance = computeLaplacianVariance8(
        pixels, width, height,
        Math.max(1, col * blockW), Math.max(1, row * blockH),
        Math.min(width - 1, (col + 1) * blockW), Math.min(height - 1, (row + 1) * blockH)
      );
      blockVariances.push(variance * blockWeights[row * 4 + col]);
    }
  }
  const sortedBlocks = [...blockVariances].sort((a, b) => a - b);
  const lowerQuartileBlockSharpness = sortedBlocks[Math.floor(sortedBlocks.length * 0.25)];

  // REFINED MOTION BLUR DETECTION (More sensitive to coherence smearing)
  const motionBlurDetected = (coherence > BLUR_COHERENCE_THRESHOLD) || 
                             (coherence > 0.10 && laplacianVar > BLUR_HIGH_LAPLACIAN_THRESHOLD * 0.8);

  // SUBJECT-AWARE OVERRIDE (Center ROI)
  const centerRoiVar = computeLaplacianVariance8(
    pixels, width, height,
    Math.floor(width * 0.25), Math.floor(height * 0.20),
    Math.floor(width * 0.75), Math.floor(height * 0.80)
  );
  // ROI override is disabled if motion blur is detected to prevent sharp background from masking smearing
  const centerRoiOverride = !motionBlurDetected && centerRoiVar >= (BLUR_THRESHOLD * 1.5) && entropy > BLUR_MIN_ENTROPY_FOR_ROI;

  // ENSEMBLE VOTING (With Motion Blur Integration)
  let blurryVotes = 0;
  if (laplacianVar < BLUR_THRESHOLD) blurryVotes++;
  if (tenengrad < BLUR_TENENGRAD_THRESHOLD) blurryVotes++;
  if (lowerQuartileBlockSharpness < BLUR_LOWER_QUARTILE_BLOCK_THRESHOLD) blurryVotes++;
  if (motionBlurDetected) blurryVotes += 2; // Strong failure signal

  const passed = (centerRoiOverride || blurryVotes <= 1) && !motionBlurDetected;

  // PERCEPTUAL CONFIDENCE SCORING (Balanced against streaking energy)
  const laplacianNorm = clamp(laplacianVar / 600, 0, 1);
  const tenengradNorm = clamp(tenengrad / 1800, 0, 1);
  const blockNorm     = clamp(lowerQuartileBlockSharpness / 300, 0, 1);
  
  // Start with energy-based fidelity
  let confidence = (0.35 * laplacianNorm) + (0.35 * tenengradNorm) + (0.30 * blockNorm);
  
  // Apply Perceptual Penalties for Smearing (Non-linear)
  if (coherence > 0.04) {
    const penalty = Math.pow(coherence * 2, 1.5); // Sharp drop as coherence increases
    confidence -= penalty;
  }

  // Hard caps for failed/blurry states to prevent "100% Blurry" confusing labels
  if (motionBlurDetected) {
    confidence = Math.min(confidence, 0.40);
  } else if (!passed) {
    confidence = Math.min(confidence, 0.65);
  }
  
  confidence = clamp(confidence, 0, 1);

  // Perceptual Labeling Helpers
  const getLevel = (v: number, t: number) => v > t * 2 ? 'High' : v > t ? 'Moderate' : 'Low';

  return {
    checkName: 'blur_detection',
    passed,
    confidence: Math.round(confidence * 100) / 100,
    details: {
      laplacianVariance: Math.round(laplacianVar * 100) / 100,
      tenegradScore: Math.round(tenengrad * 100) / 100,
      directionalCoherence: Math.round(coherence * 1000) / 1000,
      lowerQuartileBlockSharpness: Math.round(lowerQuartileBlockSharpness * 100) / 100,
      centerRoiVariance: Math.round(centerRoiVar * 100) / 100,
      centerRoiOverride,
      motionBlurDetected,
      blurryVoteCount: blurryVotes,
      perceptualLabels: {
        edgeEnergy: getLevel(laplacianVar, BLUR_THRESHOLD),
        motionRisk: coherence > 0.15 ? 'Severe' : coherence > 0.08 ? 'High' : coherence > 0.04 ? 'Moderate' : 'Low',
        spatialClarity: getLevel(lowerQuartileBlockSharpness, BLUR_LOWER_QUARTILE_BLOCK_THRESHOLD)
      },
      thresholds: { 
        laplacian: BLUR_THRESHOLD, 
        tenengrad: BLUR_TENENGRAD_THRESHOLD, 
        lowerQuartileBlock: BLUR_LOWER_QUARTILE_BLOCK_THRESHOLD,
        coherence: BLUR_COHERENCE_THRESHOLD
      }
    }
  };
}
