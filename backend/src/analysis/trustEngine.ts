import { CheckResult, TrustAssessment, TrustLevel, OperationalRecommendation, TrustDimensions, clamp } from './types';

/**
 * Vehicle Image Trust Engine
 * 
 * Fuses independent computer vision signals into a multi-dimensional trustworthiness model.
 * Separates visual quality from workflow risk to prevent over-penalization.
 */
export function computeTrustAssessment(checks: CheckResult[]): TrustAssessment {
  const results: Record<string, any> = {};
  checks.forEach(c => results[c.checkName] = c);

  const blur = results['blur_detection'];
  const brightness = results['brightness_analysis'];
  const ocr = results['ocr_plate_detection'];
  const duplicate = results['duplicate_detection'];
  const screenshot = results['screenshot_detection'];
  const tampering = results['tampering_detection'];

  const summary: string[] = [];
  const uncertaintyFlags: string[] = [];

  // 1. Initialize Multi-Dimensional Model
  const dimensions: TrustDimensions = {
    visualQuality: 100,
    ocrReliability: 100,
    authenticityConfidence: 100,
    workflowIntegrity: 100,
    operationalUsability: 100
  };

  // --- DIMENSION: Visual Quality (Clarity, Exposure, Detail) ---
  if (blur) {
    if (blur.details.motionBlurDetected) {
      dimensions.visualQuality -= 35;
      uncertaintyFlags.push('motion_blur');
    } else if (!blur.passed) {
      dimensions.visualQuality -= 15;
      uncertaintyFlags.push('soft_focus');
    }
  }
  if (brightness && !brightness.passed) {
    dimensions.visualQuality -= 15;
    uncertaintyFlags.push('exposure_risk');
  }
  dimensions.visualQuality = clamp(dimensions.visualQuality, 0, 100);

  // --- DIMENSION: OCR Reliability (Extraction & Pattern Confidence) ---
  if (ocr) {
    const readability = ocr.details?.perceptualLabels?.readability;
    const bestConf = ocr.details?.bestOcrConfidence ?? 0;

    if (readability === 'unreadable_plate') {
      dimensions.ocrReliability -= 60;
      uncertaintyFlags.push('extraction_failed');
    } else if (readability === 'low_confidence_extraction') {
      dimensions.ocrReliability -= 30;
      uncertaintyFlags.push('ocr_uncertainty');
    } else if (readability === 'partially_readable') {
      dimensions.ocrReliability -= 15;
    }
    
    // Reward pattern match even if engine confidence is low
    if (ocr.passed && bestConf < 0.5) {
      dimensions.ocrReliability += 10; 
    }
  }
  dimensions.ocrReliability = clamp(dimensions.ocrReliability, 0, 100);

  // --- DIMENSION: Authenticity Confidence (Screenshot & Tampering) ---
  if (screenshot && !screenshot.passed) {
    dimensions.authenticityConfidence -= 40; // Screenshot risk
    uncertaintyFlags.push('screenshot_detected');
  }
  if (tampering && !tampering.passed) {
    dimensions.authenticityConfidence -= 60; // Manipulation risk
    uncertaintyFlags.push('tampering_risk');
  }
  dimensions.authenticityConfidence = clamp(dimensions.authenticityConfidence, 0, 100);

  // --- DIMENSION: Workflow Integrity (Submission Context) ---
  if (duplicate && !duplicate.passed) {
    const dist = duplicate.details?.hammingDistance;
    if (dist === 0) {
      dimensions.workflowIntegrity -= 30; // Submission reuse
      uncertaintyFlags.push('exact_duplicate');
    } else {
      dimensions.workflowIntegrity -= 15; // Perceptual similarity
      uncertaintyFlags.push('similar_submission');
    }
  }
  dimensions.workflowIntegrity = clamp(dimensions.workflowIntegrity, 0, 100);

  // --- DIMENSION: Operational Usability (Human-Centric Fusion) ---
  // A human can often read plates that OCR fails on, IF visual quality is high.
  const visualUsabilityWeight = 0.75;
  const ocrUsabilityWeight = 0.25;
  dimensions.operationalUsability = clamp(
    (dimensions.visualQuality * visualUsabilityWeight) + (dimensions.ocrReliability * ocrUsabilityWeight),
    0, 100
  );

  // --- 2. FINAL TRUST SCORE CALIBRATION ---
  // Use Operational Usability as the anchor, then penalize for Authenticity/Workflow risks.
  let trustScore = dimensions.operationalUsability;
  
  // Apply authenticity penalties (Screenshots/Tampering)
  if (dimensions.authenticityConfidence < 70) {
    trustScore -= (70 - dimensions.authenticityConfidence) * 0.5;
  }
  
  // Apply workflow integrity penalties (Duplicates)
  if (dimensions.workflowIntegrity < 100) {
    trustScore -= (100 - dimensions.workflowIntegrity) * 0.2;
  }

  trustScore = clamp(trustScore, 0, 100);

  // 3. Operational Recommendation Routing
  let recommendation: OperationalRecommendation = 'ready_for_verification';
  if (trustScore >= 85) recommendation = 'ready_for_verification';
  else if (trustScore >= 70) recommendation = 'acceptable_with_warnings';
  else if (trustScore >= 50) recommendation = 'manual_review_required';
  else if (trustScore >= 30) recommendation = 'verification_limited';
  else recommendation = 'rejected';

  // Override: Rejections based on severe authenticity risk
  const isAuthentic = dimensions.authenticityConfidence >= 40;
  if (!isAuthentic) {
    recommendation = 'rejected';
    summary.push('Critical authenticity failure detected (manipulation or UI capture).');
  }

  // 4. Perceptual Summary Generation
  if (dimensions.visualQuality < 70) summary.push('Limited visual clarity may impact feature extraction.');
  if (dimensions.ocrReliability < 60) summary.push('Automated identity extraction is uncertain; visual check recommended.');
  if (dimensions.workflowIntegrity < 100) summary.push('Previously submitted image or highly similar record detected.');
  if (dimensions.authenticityConfidence < 100 && dimensions.authenticityConfidence >= 40) {
    summary.push('Non-native capture indicators detected (possible screenshot).');
  }
  
  if (summary.length === 0) {
    summary.push('Optimal visual clarity and authenticity verified.');
  }

  let trustLevel: TrustLevel = 'high';
  if (trustScore < 35) trustLevel = 'none';
  else if (trustScore < 55) trustLevel = 'low';
  else if (trustScore < 80) trustLevel = 'medium';

  return {
    trustScore: Math.round(trustScore),
    trustLevel,
    recommendation,
    summary,
    uncertaintyFlags,
    isAuthentic,
    completeness: checks.length >= 7 ? 'complete' : (checks.length > 0 ? 'partial' : 'incomplete'),
    dimensions,
    fusionSignals: {
      visualClarity: dimensions.visualQuality >= 80 ? 'optimal' : (dimensions.visualQuality >= 50 ? 'acceptable' : 'poor'),
      readabilityStatus: ocr?.details?.perceptualLabels?.readability ?? 'uncertain',
      submissionType: dimensions.workflowIntegrity === 100 ? 'unique' : 'reused',
      sourceTrust: dimensions.authenticityConfidence >= 80 ? 'verified' : 'unstable'
    }
  };
}
