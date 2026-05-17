import { CheckResult, TrustAssessment } from './types';
import { analyzeBlur } from './blurDetection';
import { analyzeBrightness } from './brightnessAnalysis';
import { analyzeDuplicates } from './duplicateDetection';
import { analyzeScreenshot } from './screenshotDetection';
import { analyzeOcrPlate } from './ocrPlateDetection';
import { analyzeDimensions } from './dimensionValidation';
import { analyzeTampering } from './tamperingDetection';
import { computeTrustAssessment } from './trustEngine';
import logger from '../utils/logger';

export interface AnalysisRunResult {
  checks: CheckResult[];
  trustAssessment: TrustAssessment;
  qualityScore: number;
  perceptualHash: string | null;
}

/**
 * Orchestrate the Production-Grade Vehicle Image Trust Engine.
 * 
 * Fuses 7 independent CV signals into a unified trustworthiness model.
 */
export async function runAllAnalyses(
  filePath: string,
  jobId: string,
): Promise<AnalysisRunResult> {
  const startMs = Date.now();
  logger.info({ jobId }, 'Starting production-grade trust analysis pipeline');

  // 1. Execute all independent computer vision checks concurrently
  const settledResults = await Promise.allSettled([
    analyzeBlur(filePath),
    analyzeBrightness(filePath),
    analyzeDuplicates(filePath, jobId),
    analyzeScreenshot(filePath),
    analyzeOcrPlate(filePath),
    analyzeDimensions(filePath),
    analyzeTampering(filePath)
  ]);

  const checks: CheckResult[] = [];
  let perceptualHash: string | null = null;

  const checkNames = [
    'blur_detection',
    'brightness_analysis',
    'duplicate_detection',
    'screenshot_detection',
    'ocr_plate_detection',
    'dimension_validation',
    'tampering_detection'
  ];

  // 2. Unwrap results and handle failures gracefully
  settledResults.forEach((result, idx) => {
    const name = checkNames[idx];
    if (result.status === 'fulfilled') {
      const checkResult = result.value as CheckResult;
      checks.push(checkResult);

      if (name === 'duplicate_detection' && checkResult.details?.dHash) {
        perceptualHash = checkResult.details.dHash as string;
      }
    } else {
      logger.error({ jobId, checkName: name, err: result.reason }, 'Check failed');
      checks.push({
        checkName: name,
        passed: false,
        confidence: 0,
        details: { error: String(result.reason), checkErrored: true }
      });
    }
  });

  // 3. FUSE signals into the Trust Assessment
  const trustAssessment = computeTrustAssessment(checks);

  logger.info(
    { 
      jobId, 
      trustScore: trustAssessment.trustScore, 
      level: trustAssessment.trustLevel,
      recommendation: trustAssessment.recommendation,
      durationMs: Date.now() - startMs 
    },
    'Trust analysis complete'
  );

  return { 
    checks, 
    trustAssessment,
    qualityScore: trustAssessment.trustScore, // Replace legacy score with trust-aware score
    perceptualHash 
  };
}
