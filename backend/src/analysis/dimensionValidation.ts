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

// eslint-disable-next-line @typescript-eslint/no-var-requires
const exifReader = require('exif-reader');

/**
 * Parses EXIF metadata from raw image buffer if available.
 */
function parseExif(exifBuffer?: Buffer): any {
  if (!exifBuffer) return null;
  try {
    const parsed = exifReader(exifBuffer);
    const cameraMake = parsed?.image?.Make || parsed?.image?.make || null;
    const cameraModel = parsed?.image?.Model || parsed?.image?.model || null;
    const software = parsed?.image?.Software || parsed?.image?.software || null;
    
    // Dates
    const createdDate = parsed?.exif?.DateTimeOriginal || parsed?.exif?.dateTimeOriginal || null;
    const modifyDate = parsed?.image?.ModifyDate || parsed?.image?.modifyDate || null;
    
    // GPS Coordination mapping
    let gps: { latitude: number; longitude: number } | null = null;
    if (parsed?.gps && parsed.gps.GPSLatitude && parsed.gps.GPSLongitude) {
      const lat = parsed.gps.GPSLatitude;
      const lon = parsed.gps.GPSLongitude;
      const latRef = parsed.gps.GPSLatitudeRef || 'N';
      const lonRef = parsed.gps.GPSLongitudeRef || 'E';
      
      if (Array.isArray(lat) && Array.isArray(lon) && lat.length >= 3 && lon.length >= 3) {
        let latitude = lat[0] + lat[1] / 60 + lat[2] / 3600;
        let longitude = lon[0] + lon[1] / 60 + lon[2] / 3600;
        
        if (latRef === 'S') latitude = -latitude;
        if (lonRef === 'W') longitude = -longitude;
        
        gps = {
          latitude: Math.round(latitude * 100000) / 100000,
          longitude: Math.round(longitude * 100000) / 100000
        };
      }
    }

    return {
      cameraMake: typeof cameraMake === 'string' ? cameraMake.trim() : null,
      cameraModel: typeof cameraModel === 'string' ? cameraModel.trim() : null,
      software: typeof software === 'string' ? software.trim() : null,
      createdDate: createdDate instanceof Date ? createdDate.toISOString() : (typeof createdDate === 'string' ? createdDate : null),
      modifyDate: modifyDate instanceof Date ? modifyDate.toISOString() : (typeof modifyDate === 'string' ? modifyDate : null),
      gps
    };
  } catch (err) {
    return null;
  }
}

/**
 * Image Dimension & Full EXIF Metadata Analysis
 * 
 * Verifies that the image has usable dimensions, a standard aspect ratio,
 * sufficient file size, and extracts comprehensive structured EXIF/image metadata.
 */
export async function analyzeDimensions(filePath: string): Promise<CheckResult> {
  const [metadata, stats] = await Promise.all([
    sharp(filePath).metadata(),
    fs.stat(filePath)
  ]);

  const width = metadata.width;
  const height = metadata.height;
  const fileSizeBytes = stats.size;

  // Handle missing metadata as hard failure
  if (width === undefined || height === undefined) {
    return {
      checkName: 'dimension_validation',
      passed: false,
      confidence: 1.0,
      details: { 
        failures: ['metadata_unreadable'], 
        width: null, 
        height: null,
        fileSizeBytes,
        metadata: null
      }
    };
  }

  const aspectRatio = height > 0 ? width / height : 0;
  const megapixels = (width * height) / 1_000_000;
  const fileSizeMB = Math.round(fileSizeBytes / 10_000) / 100;

  const failures: string[] = [];

  // File-size adequacy check
  if (fileSizeBytes < DIMENSION_MIN_FILE_SIZE_BYTES) {
    failures.push('file_too_small_for_detail');
  }

  if (width < DIMENSION_MIN_PIXELS) failures.push('width_below_min');
  if (height < DIMENSION_MIN_PIXELS) failures.push('height_below_min');
  if (width > DIMENSION_MAX_PIXELS) failures.push('width_above_max');
  if (height > DIMENSION_MAX_PIXELS) failures.push('height_above_max');
  
  // Aspect ratio check
  if (aspectRatio < DIMENSION_MIN_ASPECT_RATIO || aspectRatio > DIMENSION_MAX_ASPECT_RATIO) {
    failures.push('aspect_ratio_out_of_range');
  }

  const passed = failures.length === 0;

  // Extract structured image-specific metadata
  const parsedExif = parseExif(metadata.exif);
  const imageMetadata = {
    format: (metadata.format || 'unknown').toUpperCase(),
    colorSpace: metadata.space || 'unknown',
    channels: metadata.channels || null,
    depth: metadata.depth || 'unknown',
    density: metadata.density || null,
    hasAlpha: metadata.hasAlpha || metadata.channels === 4,
    hasProfile: metadata.hasProfile || false,
    orientation: metadata.orientation || 1,
    cameraMake: parsedExif?.cameraMake || null,
    cameraModel: parsedExif?.cameraModel || null,
    software: parsedExif?.software || null,
    createdDate: parsedExif?.createdDate || null,
    modifyDate: parsedExif?.modifyDate || null,
    gps: parsedExif?.gps || null
  };

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
      metadata: imageMetadata,
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
