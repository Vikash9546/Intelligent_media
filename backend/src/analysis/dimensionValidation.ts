import sharp from 'sharp';
import fs from 'fs/promises';
import { CheckResult } from './types';
import {
  DIMENSION_MIN_PIXELS,
  DIMENSION_MAX_PIXELS,
  DIMENSION_MIN_ASPECT_RATIO,
  DIMENSION_MAX_ASPECT_RATIO,
  DIMENSION_MIN_FILE_SIZE_BYTES,
} from '../utils/constants';

/**
 * Image Dimension Validation
 * 
 * Verifies that the image has usable dimensions, a standard aspect ratio,
 * and sufficient file size to contain meaningful detail.
 */
export async function analyzeDimensions(filePath: string): Promise<CheckResult> {
  const [metadata, stats] = await Promise.all([
    sharp(filePath).metadata(),
    fs.stat(filePath)
  ]);

  const width = metadata.width;
  const height = metadata.height;
  const fileSizeBytes = stats.size;

  // FIX 1: Handle missing metadata as hard failure
  if (width === undefined || height === undefined) {
    return {
      checkName: 'dimension_validation',
      passed: false,
      confidence: 1.0,
      details: { 
        failures: ['metadata_unreadable'], 
        width: null, 
        height: null,
        fileSizeBytes 
      }
    };
  }

  const aspectRatio = height > 0 ? width / height : 0;
  const megapixels = (width * height) / 1_000_000;
  const fileSizeMB = Math.round(fileSizeBytes / 10_000) / 100;

  const failures: string[] = [];

  // FIX 2: File-size adequacy check
  if (fileSizeBytes < DIMENSION_MIN_FILE_SIZE_BYTES) {
    failures.push('file_too_small_for_detail');
  }

  if (width < DIMENSION_MIN_PIXELS) failures.push('width_below_min');
  if (height < DIMENSION_MIN_PIXELS) failures.push('height_below_min');
  if (width > DIMENSION_MAX_PIXELS) failures.push('width_above_max');
  if (height > DIMENSION_MAX_PIXELS) failures.push('height_above_max');
  
  // Aspect ratio check (widened range)
  if (aspectRatio < DIMENSION_MIN_ASPECT_RATIO || aspectRatio > DIMENSION_MAX_ASPECT_RATIO) {
    failures.push('aspect_ratio_out_of_range');
  }

  const passed = failures.length === 0;

  return {
    checkName: 'dimension_validation',
    passed,
    confidence: 1.0,
    details: {
      width,
      height,
      aspectRatio: Math.round(aspectRatio * 1000) / 1000,
      megapixels: Math.round(megapixels * 100) / 100,
      fileSizeBytes,
      fileSizeMB,
      failures,
      thresholds: {
        minPixels: DIMENSION_MIN_PIXELS,
        maxPixels: DIMENSION_MAX_PIXELS,
        minAspectRatio: DIMENSION_MIN_ASPECT_RATIO,
        maxAspectRatio: DIMENSION_MAX_ASPECT_RATIO,
        minFileSize: DIMENSION_MIN_FILE_SIZE_BYTES
      },
    },
  };
}
