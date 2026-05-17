import Tesseract from 'tesseract.js';
import sharp from 'sharp';
import { CheckResult, clamp } from './types';
import { PLATE_REGEX_STANDARD, PLATE_REGEX_BH } from '../utils/constants';
import logger from '../utils/logger';

/**
 * Production-Grade Perceptual Vehicle Plate Extraction
 * 
 * Pipeline:
 * 1. ROI Localization (Lightweight heuristic search for plate-like regions)
 * 2. Targeted Preprocessing (High-sharpening, local contrast for candidates)
 * 3. Multi-PSM Multi-Region OCR
 * 4. Fuzzy Validation (Pattern similarity vs binary regex)
 * 5. Perceptual Trust Fusion (Readability vs Extraction confidence)
 */

const OCR_TIMEOUT_MS = 15000;

interface RoiCandidate {
  left: number;
  top: number;
  width: number;
  height: number;
  score: number;
}

/** Correct common OCR character misreads in vehicle plates */
function fixOcrMisreads(text: string): string {
  return text
    .toUpperCase()
    .replace(/\bO\b(?=\d)/g, '0')
    .replace(/(?<=\d)\bO\b/g, '0')
    .replace(/\bI\b(?=[A-Z])/g, '1')
    .replace(/\b5\b(?=[A-Z]{2,})/g, 'S')
    .replace(/\bB\b(?=\d{4})/g, '8')
    .replace(/\s+/g, ''); // Plates usually don't have spaces in verification context
}

/** 
 * Fuzzy Plate Validation
 * Scores a token based on its similarity to Indian vehicle registration patterns.
 */
function getFuzzyPlateScore(token: string): { score: number, type: 'standard' | 'bh' | 'partial' | 'none' } {
  const cleaned = token.replace(/[^A-Z0-9]/g, '');
  
  if (PLATE_REGEX_STANDARD.test(cleaned)) return { score: 1.0, type: 'standard' };
  if (PLATE_REGEX_BH.test(cleaned)) return { score: 1.0, type: 'bh' };

  // Heuristic pattern scoring (e.g. State code + Number + Series + Number)
  // Example: [A-Z]{2}[0-9]{2} is a strong partial indicator
  const hasState = /^[A-Z]{2}[0-9]/.test(cleaned);
  const hasSeries = /[A-Z]{1,2}[0-9]{4}$/.test(cleaned);
  
  if (hasState && hasSeries) return { score: 0.85, type: 'partial' };
  if (hasState || hasSeries) return { score: 0.5, type: 'partial' };
  
  // Length-based fallback for messy OCR
  if (cleaned.length >= 7 && cleaned.length <= 11) {
    const digitCount = (cleaned.match(/\d/g) || []).length;
    const letterCount = (cleaned.match(/[A-Z]/g) || []).length;
    if (digitCount >= 4 && letterCount >= 2) return { score: 0.4, type: 'partial' };
  }

  return { score: 0, type: 'none' };
}

/** 
 * Lightweight Plate ROI Detection
 * Uses edge density and bottom-center weighting to find plate candidates.
 */
async function findPlateCandidates(filePath: string): Promise<RoiCandidate[]> {
  const metadata = await sharp(filePath).metadata();
  const W = metadata.width || 0;
  const H = metadata.height || 0;

  // Process a small grayscale version to find ROI energy
  const { data, info } = await sharp(filePath)
    .resize(300, 300, { fit: 'fill' })
    .grayscale()
    .convolve({
      width: 3, height: 3,
      kernel: [-1, -1, -1, -1, 8, -1, -1, -1, -1] // Laplacian edge detection
    })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const w = info.width;
  const h = info.height;
  const grid = 12;
  const cellW = Math.floor(w / grid);
  const cellH = Math.floor(h / grid);
  
  const candidates: RoiCandidate[] = [];

  for (let gy = 4; gy < grid - 1; gy++) { // Focus on bottom 60%
    for (let gx = 1; gx < grid - 1; gx++) {
      let energy = 0;
      for (let y = gy * cellH; y < (gy + 1) * cellH; y++) {
        for (let x = gx * cellW; x < (gx + 1) * cellW; x++) {
          energy += data[y * w + x];
        }
      }
      
      // Weighting: Bottom-Center is prime plate real estate
      const distToCenter = Math.abs(gx - grid / 2);
      const posWeight = (gy / grid) * (1 - distToCenter / (grid / 2));
      const score = energy * posWeight;

      if (score > 1000) {
        // Map back to original coordinates with 20% padding, widened to prevent clipping
        candidates.push({
          left: Math.max(0, Math.floor(((gx - 1) / grid) * W)),
          top: Math.max(0, Math.floor(((gy - 0.5) / grid) * H)),
          width: Math.min(W, Math.floor((3 / grid) * W)),
          height: Math.min(H, Math.floor((2.5 / grid) * H)),
          score
        });
      }
    }
  }

  return candidates.sort((a, b) => b.score - a.score).slice(0, 3);
}

/** Preprocess specific ROI using multi-pass variant logic for maximized character contrast */
async function preprocessRoi(
  buffer: Buffer,
  crop: RoiCandidate,
  mode: 'grayscale' | 'adaptive' | 'high_contrast' | 'inverted'
): Promise<Buffer> {
  let pipeline = sharp(buffer)
    .extract({
      left: crop.left,
      top: crop.top,
      width: crop.width,
      height: crop.height
    })
    .resize(900)
    .grayscale()
    .normalize();

  if (mode === 'high_contrast') {
    pipeline = pipeline.sharpen(2);
  }

  if (mode === 'adaptive') {
    pipeline = pipeline.threshold(120);
  }

  if (mode === 'inverted') {
    pipeline = pipeline.negate().threshold(140);
  }

  return pipeline.png().toBuffer();
}

async function runOcrPass(
  buffer: Buffer, 
  psm: string, 
  regionName: string
): Promise<{ text: string; words: any[] }> {
  const ocrPromise = Tesseract.recognize(buffer, 'eng', {
    tessedit_pageseg_mode: psm,
    tessedit_ocr_engine_mode: Tesseract.OEM.LSTM_ONLY as unknown as string,
    tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 ',
  } as Record<string, string>);

  const timeoutPromise = new Promise<{ text: string; words: any[] }>((resolve) => {
    setTimeout(() => {
      logger.warn({ regionName }, 'OCR Pass timed out');
      resolve({ text: '', words: [] });
    }, OCR_TIMEOUT_MS);
  });

  const result = await Promise.race([ocrPromise, timeoutPromise]);
  return {
    text: (result as any).data?.text ?? '',
    words: (result as any).data?.words ?? []
  };
}

export async function analyzeOcrPlate(filePath: string): Promise<CheckResult> {
  const startMs = Date.now();
  const rawImage = await sharp(filePath).toBuffer();
  
  // 1. ROI Candidate Search
  const roiCandidates = await findPlateCandidates(filePath);
  const metadata = await sharp(filePath).metadata();
  const W = metadata.width || 0;
  const H = metadata.height || 0;

  // Fallback to standard bottom strip if no ROI found
  const rois = roiCandidates.length > 0 ? roiCandidates : [{
    left: 0, top: Math.floor(H * 0.45), width: W, height: Math.floor(H * 0.55), score: 0
  }];

  // 2. Parallel Multi-Pass OCR on Top Candidates
  const ocrPromises = rois.map(async (roi, idx) => {
    const variants = await Promise.all([
      preprocessRoi(rawImage, roi, 'grayscale'),
      preprocessRoi(rawImage, roi, 'adaptive'),
      preprocessRoi(rawImage, roi, 'high_contrast'),
      preprocessRoi(rawImage, roi, 'inverted')
    ]);

    const results = await Promise.all(
      variants.map((buf, i) =>
        runOcrPass(
          buf,
          Tesseract.PSM.SINGLE_BLOCK as unknown as string,
          `ROI_${idx}_VARIANT_${i}`
        )
      )
    );

    return results;
  });

  const ocrResultsNested = await Promise.all(ocrPromises);
  const ocrResults = ocrResultsNested.flat();

  // 3. Result Fusion & Fuzzy Validation
  const allDetectedTokens: string[] = [];
  const validPlates: string[] = [];
  let bestOcrConfidence = 0;

  ocrResults.forEach(res => {
    const cleaned = res.text
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, ' ');

    const tokens = cleaned
      .split(/\s+/)
      .filter(t => t.length >= 4);

    tokens.forEach(t => {
      const fixed = fixOcrMisreads(t);
      const { score } = getFuzzyPlateScore(fixed);
      if (score > 0.4) {
        allDetectedTokens.push(fixed);
        if (score >= 0.85) validPlates.push(fixed);
      }
    });

    // Only count confidence for regions that likely contained a plate
    if (res.words.length > 0) {
      const plateWords = res.words.filter(w => getFuzzyPlateScore(fixOcrMisreads(w.text)).score > 0.3);
      if (plateWords.length > 0) {
        const conf = plateWords.reduce((a, b) => a + b.confidence, 0) / plateWords.length / 100;
        bestOcrConfidence = Math.max(bestOcrConfidence, conf);
      }
    }
  });

  // 4. Perceptual Interpretation
  const formatValid = validPlates.length > 0;
  const hasPartial = allDetectedTokens.length > 0;
  
  // Separate OCR Engine confidence from Human Readability estimation
  // If we found a plate ROI but OCR was just slightly messy, human readability is still likely high.
  let readability: string = 'unreadable';
  let perceptualCertainty = 0;

  if (formatValid) {
    perceptualCertainty = bestOcrConfidence > 0.7 ? 0.95 : 0.80;
    readability = bestOcrConfidence > 0.75 ? 'clearly_readable' : 'mostly_readable';
  } else if (hasPartial) {
    perceptualCertainty = 0.50;
    readability = 'partially_readable';
  } else if (roiCandidates.length > 0) {
    // We found a plate-like region, but OCR failed. Likely readable by human if blurred/angled.
    perceptualCertainty = 0.30;
    readability = 'low_confidence_extraction';
  } else {
    perceptualCertainty = 0.10;
    readability = 'unreadable_plate';
  }

  // 5. Trust Calibration
  // Confidence here reflects "Extraction Confidence" using the robust multi-pass scoring
  const roiStrength = roiCandidates.length > 0
    ? Math.min(roiCandidates[0].score / 5000, 1)
    : 0;

  const confidence = clamp(
    0.25 + (bestOcrConfidence * 0.5) + (roiStrength * 0.25),
    0.2,
    0.95
  );

  return {
    checkName: 'ocr_plate_detection',
    passed: formatValid || (hasPartial && bestOcrConfidence > 0.6),
    confidence,
    details: {
      detectedPlates: [...new Set(validPlates)],
      partialMatches: [...new Set(allDetectedTokens)],
      roiCount: roiCandidates.length,
      bestOcrConfidence: Math.round(bestOcrConfidence * 100) / 100,
      processingMs: Date.now() - startMs,
      perceptualLabels: {
        readability,
        extractionQuality: bestOcrConfidence > 0.8 ? 'High' : bestOcrConfidence > 0.5 ? 'Medium' : 'Low',
        humanPerceptionScore: perceptualCertainty
      }
    }
  };
}
