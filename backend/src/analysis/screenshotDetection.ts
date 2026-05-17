import sharp from 'sharp';
import { CheckResult, clamp } from './types';
import {
  SCREENSHOT_EDGE_DENSITY_THRESHOLD,
  SCREENSHOT_COMMON_RESOLUTIONS,
  SCREENSHOT_EXIF_KEYWORDS,
  SCREENSHOT_PALETTE_THRESHOLD,
  SCREENSHOT_FLAT_RATIO_THRESHOLD,
  SCREENSHOT_SCORE_THRESHOLD,
} from '../utils/constants';

/** Check EXIF metadata for screen-capture software signatures */
async function checkExifFlag(filePath: string): Promise<boolean> {
  try {
    const metadata = await sharp(filePath).metadata();
    if (!metadata.exif) return false;
    const exifText = metadata.exif.toString('latin1').toLowerCase();
    return SCREENSHOT_EXIF_KEYWORDS.some((keyword) => exifText.includes(keyword));
  } catch {
    return false;
  }
}

/** Check if resolution matches common mobile screens */
function checkResolutionFlag(width: number, height: number): boolean {
  return SCREENSHOT_COMMON_RESOLUTIONS.some(res => 
    (width === res.width && height === res.height) || 
    (width === res.height && height === res.width)
  );
}

/** Color Palette Entropy: Unique quantized colors */
async function checkColorPalette(filePath: string): Promise<{ flagged: boolean; count: number }> {
  const { data } = await sharp(filePath).resize(64, 64, { fit: 'fill' }).raw().toBuffer({ resolveWithObject: true });
  const colors = new Set<number>();
  for (let i = 0; i < data.length; i += 3) {
    const r4 = data[i] >> 4;
    const g4 = data[i + 1] >> 4;
    const b4 = data[i + 2] >> 4;
    colors.add((r4 << 8) | (g4 << 4) | b4);
  }
  return { flagged: colors.size < SCREENSHOT_PALETTE_THRESHOLD, count: colors.size };
}

/** Flat Region Ratio: Large uniform-color areas (UI elements) */
async function checkFlatRegions(filePath: string): Promise<{ flagged: boolean; ratio: number }> {
  const { data, info } = await sharp(filePath).resize(100, 100, { fit: 'fill' }).grayscale().raw().toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  let flatPixels = 0;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const c = data[y * width + x];
      const diff = Math.max(
        Math.abs(c - data[(y - 1) * width + x]),
        Math.abs(c - data[(y + 1) * width + x]),
        Math.abs(c - data[y * width + (x - 1)]),
        Math.abs(c - data[y * width + (x + 1)])
      );
      if (diff < 8) flatPixels++;
    }
  }
  const ratio = flatPixels / (width * height);
  return { flagged: ratio > SCREENSHOT_FLAT_RATIO_THRESHOLD, ratio };
}

/** Heuristic: Status Bar Detection (Top 5% crop color consistency) */
async function checkStatusBarHeuristic(filePath: string): Promise<boolean> {
  try {
    const metadata = await sharp(filePath).metadata();
    const h = metadata.height ?? 0;
    const w = metadata.width ?? 0;
    const topStrip = await sharp(filePath).extract({ left: 0, top: 0, width: w, height: Math.floor(h * 0.05) }).resize(50, 10).grayscale().raw().toBuffer();
    
    let variance = 0;
    const mean = topStrip.reduce((a, b) => a + b, 0) / topStrip.length;
    topStrip.forEach(v => variance += (v - mean) ** 2);
    variance /= topStrip.length;
    
    // Very low variance in top strip suggests a solid UI bar
    return variance < 15;
  } catch {
    return false;
  }
}

export async function analyzeScreenshot(filePath: string): Promise<CheckResult> {
  const metadata = await sharp(filePath).metadata();
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;

  const [exifFlag, palette, flat, statusBar] = await Promise.all([
    checkExifFlag(filePath),
    checkColorPalette(filePath),
    checkFlatRegions(filePath),
    checkStatusBarHeuristic(filePath)
  ]);
  const resolutionFlag = checkResolutionFlag(width, height);

  const scores = {
    exif: exifFlag ? 2 : 0,
    resolution: resolutionFlag ? 2 : 0,
    palette: palette.flagged ? 2 : 0,
    flatness: flat.flagged ? 1 : 0,
    statusBar: statusBar ? 2 : 0
  };

  const totalScore = Object.values(scores).reduce((a, b) => a + b, 0);
  const passed = totalScore < SCREENSHOT_SCORE_THRESHOLD;
  const confidence = clamp(totalScore / 8, 0, 1);

  return {
    checkName: 'screenshot_detection',
    passed,
    confidence,
    details: {
      totalScore,
      scoreBreakdown: scores,
      verdict: totalScore >= 6 ? 'likely_screenshot' : totalScore >= 3 ? 'possible_screen_recapture' : 'native_camera_capture',
      perceptualLabels: {
        authenticity: totalScore >= 6 ? 'Suspicious' : totalScore >= 3 ? 'Uncertain' : 'Verified',
        captureSource: totalScore >= 6 ? 'Digital Screenshot' : totalScore >= 3 ? 'Possible Recapture' : 'Native Device'
      }
    }
  };
}
