import sharp from 'sharp';
import { CheckResult, clamp } from './types';
import {
  BRIGHTNESS_TOO_DARK,
  BRIGHTNESS_TOO_BRIGHT,
  BRIGHTNESS_DARK_PIXEL_THRESHOLD,
  BRIGHTNESS_DARK_MASS_RATIO,
  BRIGHTNESS_BLOWN_PIXEL_THRESHOLD,
  BRIGHTNESS_BLOWN_RATIO,
  BRIGHTNESS_PLATE_ZONE_DARK_THRESHOLD,
} from '../utils/constants';

/**
 * Brightness Analysis — 4-Signal Histogram Analysis
 * 
 * 1. Mean Luminance: Overall exposure balance.
 * 2. Dark Pixel Mass: Detection of large nearly-black regions.
 * 3. Blown Highlight Detection: High-exposure clipping detection.
 * 4. Plate Zone Check: Ensures the vehicle plate area is not underexposed.
 */
export async function analyzeBrightness(filePath: string): Promise<CheckResult> {
  const { data, info } = await sharp(filePath)
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height } = info;
  const pixelCount = width * height;

  // Signal 1: Mean Luminance
  let sum = 0;
  let darkCount = 0;
  let blownCount = 0;

  // Signal 4: Plate Zone (Center-Bottom)
  // ROI: x=[width*0.15, width*0.85], y=[height*0.55, height*0.95]
  const pX1 = Math.floor(width * 0.15);
  const pX2 = Math.floor(width * 0.85);
  const pY1 = Math.floor(height * 0.55);
  const pY2 = Math.floor(height * 0.95);
  
  let plateSum = 0;
  let plateCount = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const val = data[idx];
      
      sum += val;
      if (val < BRIGHTNESS_DARK_PIXEL_THRESHOLD) darkCount++;
      if (val >= BRIGHTNESS_BLOWN_PIXEL_THRESHOLD) blownCount++;
      
      if (x >= pX1 && x < pX2 && y >= pY1 && y < pY2) {
        plateSum += val;
        plateCount++;
      }
    }
  }

  const meanLuminance = sum / pixelCount;
  const darkPixelRatio = darkCount / pixelCount;
  const blownPixelRatio = blownCount / pixelCount;
  const plateZoneMean = plateCount > 0 ? plateSum / plateCount : 128; // Default to mid if area is empty

  // VERDICT LOGIC
  const failures: string[] = [];
  
  if (meanLuminance < BRIGHTNESS_TOO_DARK) failures.push('too_dark');
  if (meanLuminance > BRIGHTNESS_TOO_BRIGHT) failures.push('too_bright');
  if (darkPixelRatio > BRIGHTNESS_DARK_MASS_RATIO) failures.push('too_dark_mass');
  if (blownPixelRatio > BRIGHTNESS_BLOWN_RATIO) failures.push('overexposed_regions');
  if (plateZoneMean < BRIGHTNESS_PLATE_ZONE_DARK_THRESHOLD) failures.push('plate_zone_too_dark');

  const passed = failures.length === 0;
  
  let verdict: string = 'ok';
  if (failures.includes('too_dark') || failures.includes('too_dark_mass')) {
    verdict = 'too_dark';
  } else if (failures.includes('overexposed_regions') || failures.includes('too_bright')) {
    verdict = 'too_bright';
  } else if (failures.includes('plate_zone_too_dark')) {
    verdict = 'plate_zone_dark';
  }
  if (failures.length > 1 && verdict !== 'ok') {
    verdict = 'multiple_issues';
  }

  // CONFIDENCE CALCULATION (Continuous scale)
  const meanScore  = 1 - clamp(Math.abs(meanLuminance - 128) / 88, 0, 1);
  const darkScore  = 1 - clamp(darkPixelRatio / BRIGHTNESS_DARK_MASS_RATIO, 0, 1);
  const blownScore = 1 - clamp(blownPixelRatio / BRIGHTNESS_BLOWN_RATIO, 0, 1);
  const plateScore = clamp((plateZoneMean - 30) / 80, 0, 1);
  
  const confidence = (0.30 * meanScore) + (0.25 * darkScore) + (0.25 * blownScore) + (0.20 * plateScore);

  return {
    checkName: 'brightness_analysis',
    passed,
    confidence,
    details: {
      meanLuminance: Math.round(meanLuminance * 100) / 100,
      darkPixelRatio: Math.round(darkPixelRatio * 1000) / 1000,
      blownPixelRatio: Math.round(blownPixelRatio * 1000) / 1000,
      plateZoneMean: Math.round(plateZoneMean * 100) / 100,
      failures,
      verdict,
      thresholds: {
        tooDark: BRIGHTNESS_TOO_DARK,
        tooBright: BRIGHTNESS_TOO_BRIGHT,
        darkMassRatio: BRIGHTNESS_DARK_MASS_RATIO,
        blownRatio: BRIGHTNESS_BLOWN_RATIO,
        plateZoneDark: BRIGHTNESS_PLATE_ZONE_DARK_THRESHOLD
      }
    }
  };
}
