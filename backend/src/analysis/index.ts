import { CheckResult } from './types';
import { QUALITY_WEIGHTS } from '../utils/constants';
import { analyzeBlur } from './blurDetection';
import { analyzeBrightness } from './brightnessAnalysis';
import { analyzeDuplicates } from './duplicateDetection';
import { analyzeScreenshot } from './screenshotDetection';
import { analyzeOcrPlate } from './ocrPlateDetection';
import { analyzeDimensions } from './dimensionValidation';
import logger from '../utils/logger';

export interface AnalysisRunResult {
  checks: CheckResult[];
  qualityScore: number;
  perceptualHash: string | null;
}

/**
 * Orchestrate all six analysis checks concurrently.
 *
 * WHY Promise.allSettled OVER Promise.all?
 * Promise.all short-circuits on the first rejection — one failing check
 * would abort ALL checks, losing partial results. allSettled waits for
 * every promise and gives us fulfilled/rejected status per check.
 * This means a Tesseract crash doesn't prevent blur/brightness results
 * from being saved, and we can surface exactly which check failed.
 */
export async function runAllAnalyses(
  filePath: string,
  jobId: string,
): Promise<AnalysisRunResult> {
  const startMs = Date.now();

  logger.info({ jobId, filePath }, 'Starting concurrent analysis checks');

  // All checks run concurrently — Sharp operations are CPU-bound but Node.js
  // releases the event loop between I/O operations, so this still benefits
  // from concurrency for the I/O portions.
  const [blurResult, brightnessResult, duplicateResult, screenshotResult, ocrResult, dimensionResult] =
    await Promise.allSettled([
      analyzeBlur(filePath),
      analyzeBrightness(filePath),
      analyzeDuplicates(filePath, jobId),
      analyzeScreenshot(filePath),
      analyzeOcrPlate(filePath),
      analyzeDimensions(filePath),
    ]);

  const checks: CheckResult[] = [];
  let perceptualHash: string | null = null;

  // Unwrap settled results, creating synthetic failure entries for rejected checks
  const settled = [
    { name: 'blur_detection', result: blurResult },
    { name: 'brightness_analysis', result: brightnessResult },
    { name: 'duplicate_detection', result: duplicateResult },
    { name: 'screenshot_detection', result: screenshotResult },
    { name: 'ocr_plate_detection', result: ocrResult },
    { name: 'dimension_validation', result: dimensionResult },
  ];

  for (const { name, result } of settled) {
    if (result.status === 'fulfilled') {
      const checkResult = result.value as CheckResult & { hash?: string };
      checks.push(checkResult);

      // Extract perceptual hash from duplicate detection result
      if (name === 'duplicate_detection' && checkResult.details?.dHash) {
        perceptualHash = checkResult.details.dHash as string;
      }

      logger.info(
        {
          jobId,
          checkName: name,
          passed: checkResult.passed,
          confidence: checkResult.confidence,
          durationMs: Date.now() - startMs,
        },
        'Check completed',
      );
    } else {
      // Check threw an unexpected error — record as failed with confidence 0
      logger.error(
        { jobId, checkName: name, err: result.reason },
        'Analysis check threw an error — recording as failed',
      );
      checks.push({
        checkName: name,
        passed: false,
        confidence: 0,
        details: {
          error: result.reason instanceof Error ? result.reason.message : String(result.reason),
          checkErrored: true,
        },
      });
    }
  }

  // Compute weighted quality score (only passed checks contribute)
  const qualityScore = checks.reduce((score, check) => {
    if (!check.passed) return score;
    const weight = QUALITY_WEIGHTS[check.checkName] ?? 0;
    return score + check.confidence * weight;
  }, 0);

  logger.info(
    { jobId, qualityScore, durationMs: Date.now() - startMs },
    'All analysis checks complete',
  );

  return { checks, qualityScore, perceptualHash };
}
