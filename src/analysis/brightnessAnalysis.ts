import sharp from 'sharp';
import { CheckResult, clamp } from './types';
import {
  BRIGHTNESS_TOO_DARK,
  BRIGHTNESS_TOO_BRIGHT,
  BRIGHTNESS_CONFIDENCE_MARGIN,
} from '../utils/constants';

/**
 * Brightness Analysis — Mean Pixel Luminance
 *
 * WHY MEAN LUMINANCE?
 * Mean grayscale value gives a quick, robust estimate of overall exposure.
 * More sophisticated methods (histogram-based, EXIF EV) exist but require
 * more dependencies or may not be available for all images. Mean luminance
 * catches both underexposed (night photos, lens caps) and overexposed
 * (flash burn, direct sunlight) images reliably.
 *
 * Confidence scaling:
 * - Clearly in-range (mean in [40+margin, 220-margin]) → 1.0
 * - Near a threshold → scales toward 0 linearly within margin zone
 * - This avoids binary cliff-edges and gives downstream logic a useful signal.
 */
export async function analyzeBrightness(filePath: string): Promise<CheckResult> {
  // Convert to grayscale and get raw pixel data
  const { data, info } = await sharp(filePath)
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const pixelCount = info.width * info.height;

  // Compute mean luminance (sum all pixel values, divide by count)
  let sum = 0;
  for (let i = 0; i < pixelCount; i++) {
    sum += data[i];
  }
  const meanLuminance = sum / pixelCount;

  let verdict: 'too_dark' | 'too_bright' | 'ok';
  let passed: boolean;

  if (meanLuminance < BRIGHTNESS_TOO_DARK) {
    verdict = 'too_dark';
    passed = false;
  } else if (meanLuminance > BRIGHTNESS_TOO_BRIGHT) {
    verdict = 'too_bright';
    passed = false;
  } else {
    verdict = 'ok';
    passed = true;
  }

  // Confidence: 1.0 when clearly in range, scales toward 0 near boundaries
  let confidence: number;
  if (!passed) {
    confidence = 0.0;
  } else {
    const distFromDark = meanLuminance - BRIGHTNESS_TOO_DARK;
    const distFromBright = BRIGHTNESS_TOO_BRIGHT - meanLuminance;
    const minDist = Math.min(distFromDark, distFromBright);
    confidence = clamp(minDist / BRIGHTNESS_CONFIDENCE_MARGIN, 0, 1);
  }

  return {
    checkName: 'brightness_analysis',
    passed,
    confidence,
    details: {
      meanLuminance: Math.round(meanLuminance * 100) / 100,
      verdict,
      thresholdDark: BRIGHTNESS_TOO_DARK,
      thresholdBright: BRIGHTNESS_TOO_BRIGHT,
    },
  };
}
