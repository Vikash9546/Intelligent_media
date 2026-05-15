import sharp from 'sharp';
import { CheckResult } from './types';
import {
  DIMENSION_MIN_PIXELS,
  DIMENSION_MAX_PIXELS,
  DIMENSION_MIN_ASPECT_RATIO,
  DIMENSION_MAX_ASPECT_RATIO,
} from '../utils/constants';

/**
 * Image Dimension Validation
 *
 * WHY READ METADATA ONLY (NO FULL DECODE)?
 * Sharp can read width/height/format from the file header in microseconds
 * without decoding the full pixel buffer. This avoids the CPU overhead of
 * decompressing a 100MP JPEG just to reject it.
 *
 * Failure conditions:
 * - < 200px in either dimension: image too small to be useful (thumbnail, icon)
 * - > 8000px in either dimension: unusually large; likely corrupt header or
 *   synthetic image that would cause memory issues downstream
 * - Aspect ratio < 0.3 or > 4.0: pathologically narrow/wide strip images;
 *   these break layout assumptions and are rarely real photos
 *
 * This is a deterministic check → confidence = 1.0 always.
 */
export async function analyzeDimensions(filePath: string): Promise<CheckResult> {
  const metadata = await sharp(filePath).metadata();

  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;
  const aspectRatio = height > 0 ? width / height : 0;
  const megapixels = (width * height) / 1_000_000;

  const failures: string[] = [];

  if (width < DIMENSION_MIN_PIXELS) failures.push(`width ${width}px < minimum ${DIMENSION_MIN_PIXELS}px`);
  if (height < DIMENSION_MIN_PIXELS) failures.push(`height ${height}px < minimum ${DIMENSION_MIN_PIXELS}px`);
  if (width > DIMENSION_MAX_PIXELS) failures.push(`width ${width}px > maximum ${DIMENSION_MAX_PIXELS}px`);
  if (height > DIMENSION_MAX_PIXELS) failures.push(`height ${height}px > maximum ${DIMENSION_MAX_PIXELS}px`);
  if (aspectRatio < DIMENSION_MIN_ASPECT_RATIO || aspectRatio > DIMENSION_MAX_ASPECT_RATIO) {
    failures.push(
      `aspect ratio ${aspectRatio.toFixed(3)} out of range [${DIMENSION_MIN_ASPECT_RATIO}, ${DIMENSION_MAX_ASPECT_RATIO}]`,
    );
  }

  const passed = failures.length === 0;

  return {
    checkName: 'dimension_validation',
    passed,
    confidence: 1.0, // deterministic: no uncertainty
    details: {
      width,
      height,
      aspectRatio: Math.round(aspectRatio * 1000) / 1000,
      megapixels: Math.round(megapixels * 100) / 100,
      failures,
      thresholds: {
        minPixels: DIMENSION_MIN_PIXELS,
        maxPixels: DIMENSION_MAX_PIXELS,
        minAspectRatio: DIMENSION_MIN_ASPECT_RATIO,
        maxAspectRatio: DIMENSION_MAX_ASPECT_RATIO,
      },
    },
  };
}
