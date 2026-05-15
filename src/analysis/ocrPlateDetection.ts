import Tesseract from 'tesseract.js';
import { CheckResult } from './types';
import { PLATE_REGEX_STANDARD, PLATE_REGEX_BH } from '../utils/constants';
import logger from '../utils/logger';

/**
 * Indian Vehicle Number Plate OCR
 *
 * WHY TESSERACT.JS OVER GOOGLE VISION / AWS TEXTRACT?
 * This is an MVP for a take-home. Tesseract.js runs entirely locally with no
 * API key, billing, or rate-limit concerns. For production, Vision API or
 * Textract would offer better accuracy, especially on low-res or angled plates.
 * The abstraction is easy to swap: replace the Tesseract.recognize call.
 *
 * WHY PSM 11 (SPARSE TEXT)?
 * PSM 11 tells Tesseract to find text anywhere in the image without assuming
 * a reading order. This is ideal for number plates that may appear at any
 * position, rotation, or scale within the image. PSM 6 (uniform block) would
 * miss plates that occupy only a small region.
 *
 * REGEX COVERAGE:
 * Standard: MH12AB1234 — State (2 chars) + District (1-2 digits) +
 *           Series (1-3 chars) + Plate number (4 digits)
 * BH series: 22BH1234AB — Year (2 digits) + BH + Plate (4 digits) + Series (1-2 chars)
 */

/** Extract candidate plate strings by cleaning OCR output */
function extractPlateCandidates(rawText: string): string[] {
  // 1. Uppercase and remove non-alphanumeric characters except spaces
  const cleaned = rawText.toUpperCase().replace(/[^A-Z0-9\s]/g, ' ');

  // 2. Split into whitespace-delimited tokens
  const tokens = cleaned.split(/\s+/).filter((t) => t.length >= 4);

  // 3. Also try sliding window of 2–3 adjacent tokens (plates may be split by OCR)
  const candidates = [...tokens];
  for (let i = 0; i < tokens.length - 1; i++) {
    candidates.push(tokens[i] + tokens[i + 1]);
    if (i < tokens.length - 2) {
      candidates.push(tokens[i] + tokens[i + 1] + tokens[i + 2]);
    }
  }

  return [...new Set(candidates)]; // deduplicate
}

export async function analyzeOcrPlate(filePath: string): Promise<CheckResult> {
  let rawOcrText = '';

  try {
    const result = await Tesseract.recognize(filePath, 'eng', {
      // PSM 11: Sparse text — find as much text as possible in no particular order
      tessedit_pageseg_mode: Tesseract.PSM.SPARSE_TEXT as unknown as string,
      // OEM 1: LSTM engine only (more accurate than legacy Tesseract engine)
      tessedit_ocr_engine_mode: Tesseract.OEM.LSTM_ONLY as unknown as string,
      // Whitelist characters valid in Indian plates
      tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 ',
    } as Record<string, string>);

    rawOcrText = result.data.text ?? '';
  } catch (err) {
    logger.warn({ err, filePath }, 'Tesseract OCR failed — treating as no plate found');
    rawOcrText = '';
  }

  const candidates = extractPlateCandidates(rawOcrText);
  const detectedPlates: string[] = [];

  for (const candidate of candidates) {
    if (PLATE_REGEX_STANDARD.test(candidate) || PLATE_REGEX_BH.test(candidate)) {
      detectedPlates.push(candidate);
    }
  }

  const formatValid = detectedPlates.length > 0;

  // Confidence heuristic:
  // 0.9 — strong: regex matched with full plate length
  // 0.5 — partial: OCR found numbers/letters but no full plate (partial plate visible)
  // 0.0 — no text found at all
  let confidence: number;
  if (formatValid) {
    confidence = 0.9;
  } else if (rawOcrText.trim().length > 0) {
    confidence = 0.5; // some text found, but no valid plate format
  } else {
    confidence = 0.0;
  }

  return {
    checkName: 'ocr_plate_detection',
    passed: formatValid,
    confidence,
    details: {
      rawOcrText: rawOcrText.trim().slice(0, 500), // cap length to avoid bloating DB
      detectedPlates,
      formatValid,
    },
  };
}
