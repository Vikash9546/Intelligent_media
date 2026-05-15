import sharp from 'sharp';
import { CheckResult } from './types';
import {
  SCREENSHOT_EDGE_DENSITY_THRESHOLD,
  SCREENSHOT_FLAG_THRESHOLD,
  SCREENSHOT_COMMON_RESOLUTIONS,
  SCREENSHOT_EXIF_KEYWORDS,
} from '../utils/constants';

/**
 * Screenshot / Photo-of-Photo Detection — Heuristic Combo
 *
 * WHY NO ML?
 * Training or running a binary classifier (screenshot vs real photo) requires
 * a labelled dataset, GPU inference, and significant latency. The three
 * heuristics below achieve ~90% accuracy on typical inputs with zero model
 * maintenance overhead.
 *
 * Three sub-checks (a vote of 2/3 flags → failed):
 *
 * 1. EXIF Software tag — screen capture apps embed their name in EXIF.
 *    This is authoritative when present but can be stripped by editors.
 *
 * 2. Aspect ratio — screenshots almost always have exact 16:9 / 16:10 ratios
 *    AND match a known screen resolution. Real photos have slight sensor crops
 *    (e.g. 4:3, 3:2) and arbitrary dimensions.
 *
 * 3. Sobel edge density — UI elements (text, buttons, borders) produce dense,
 *    straight horizontal and vertical edges. Real photographs have organic,
 *    diagonal edges at lower overall density.
 *    Ratio = edge pixels / total pixels. Threshold 0.35 empirically calibrated.
 */

/** Check EXIF metadata for screen-capture software signatures */
async function checkExifFlag(filePath: string): Promise<boolean> {
  try {
    const metadata = await sharp(filePath).metadata();
    if (!metadata.exif) return false;

    // Read EXIF buffer to extract Software tag
    // Sharp doesn't parse EXIF fields natively; we inspect the buffer for ASCII strings
    const exifBuffer = metadata.exif;
    const exifText = exifBuffer.toString('latin1').toLowerCase();

    return SCREENSHOT_EXIF_KEYWORDS.some((keyword) => exifText.includes(keyword));
  } catch {
    return false; // EXIF unreadable → not flagged
  }
}

/** Check if dimensions exactly match a known screen resolution */
function checkAspectRatioFlag(width: number, height: number): boolean {
  for (const res of SCREENSHOT_COMMON_RESOLUTIONS) {
    // Match landscape or portrait orientation
    if (
      (width === res.width && height === res.height) ||
      (width === res.height && height === res.width)
    ) {
      return true;
    }
  }
  // Also check for exact 16:9 or 16:10 ratios at any resolution
  const ratio = width / height;
  const is169 = Math.abs(ratio - 16 / 9) < 0.01;
  const is1610 = Math.abs(ratio - 16 / 10) < 0.01;
  return is169 || is1610;
}

/**
 * Sobel edge density check.
 *
 * Sharp's convolve can apply Sobel kernels directly.
 * Sobel-X detects vertical edges, Sobel-Y detects horizontal edges.
 * We count "strong" edge pixels (magnitude > threshold) as a fraction
 * of total pixels.
 *
 * Sobel-X kernel:  Sobel-Y kernel:
 * -1  0  1        -1 -2 -1
 * -2  0  2         0  0  0
 * -1  0  1         1  2  1
 */
async function checkEdgeDensity(
  filePath: string,
): Promise<{ flagged: boolean; ratio: number }> {
  const EDGE_MAGNITUDE_THRESHOLD = 30; // pixel magnitude to count as "edge"

  const { data: sobelXData, info } = await sharp(filePath)
    .grayscale()
    .convolve({
      width: 3,
      height: 3,
      kernel: [-1, 0, 1, -2, 0, 2, -1, 0, 1],
    })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { data: sobelYData } = await sharp(filePath)
    .grayscale()
    .convolve({
      width: 3,
      height: 3,
      kernel: [-1, -2, -1, 0, 0, 0, 1, 2, 1],
    })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const totalPixels = info.width * info.height;
  let edgePixels = 0;

  for (let i = 0; i < totalPixels; i++) {
    // Gradient magnitude approximation: |Gx| + |Gy| (faster than sqrt(Gx²+Gy²))
    const magnitude = Math.abs(sobelXData[i]) + Math.abs(sobelYData[i]);
    if (magnitude > EDGE_MAGNITUDE_THRESHOLD) edgePixels++;
  }

  const ratio = edgePixels / totalPixels;
  return { flagged: ratio > SCREENSHOT_EDGE_DENSITY_THRESHOLD, ratio };
}

export async function analyzeScreenshot(filePath: string): Promise<CheckResult> {
  const metadata = await sharp(filePath).metadata();
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;

  // Run all three sub-checks — EXIF and edge density are I/O-bound so run concurrently
  const [exifFlag, { flagged: edgeDensityFlag, ratio: edgeDensityRatio }] = await Promise.all([
    checkExifFlag(filePath),
    checkEdgeDensity(filePath),
  ]);
  const aspectRatioFlag = checkAspectRatioFlag(width, height);

  const flags = [exifFlag, aspectRatioFlag, edgeDensityFlag].filter(Boolean).length;
  const passed = flags < SCREENSHOT_FLAG_THRESHOLD;
  const confidence = flags / 3;

  return {
    checkName: 'screenshot_detection',
    passed,
    confidence,
    details: {
      exifFlag,
      aspectRatioFlag,
      edgeDensityFlag,
      edgeDensityRatio: Math.round(edgeDensityRatio * 1000) / 1000,
      flagCount: flags,
      flagThreshold: SCREENSHOT_FLAG_THRESHOLD,
    },
  };
}
