/**
 * Shared type for the result of any analysis check.
 */
export interface CheckResult {
  checkName: string;
  passed: boolean;
  confidence: number; // 0.0–1.0
  details: Record<string, unknown>;
}

/**
 * Vehicle Image Trust Engine Assessment
 * Fuses all metrics into a unified trustworthiness model.
 */
export type TrustLevel = 'high' | 'medium' | 'low' | 'none';
export type OperationalRecommendation = 
  | 'ready_for_verification'
  | 'acceptable_with_warnings'
  | 'manual_review_required' 
  | 'verification_limited' 
  | 'rejected';

/**
 * Multi-Dimensional Trust Model
 */
export interface TrustDimensions {
  visualQuality: number;       // 0-100: Clarity, exposure, resolution
  ocrReliability: number;      // 0-100: Extraction certainty, pattern match
  authenticityConfidence: number; // 0-100: Screenshot/tampering risk
  workflowIntegrity: number;   // 0-100: Duplicates, reuse risk
  operationalUsability: number; // 0-100: Can a human verifier use this?
}

export interface TrustAssessment {
  trustScore: number; // 0-100 (Primary operational score)
  trustLevel: TrustLevel;
  recommendation: OperationalRecommendation;
  summary: string[];
  uncertaintyFlags: string[];
  isAuthentic: boolean;
  completeness: 'complete' | 'partial' | 'incomplete';
  dimensions: TrustDimensions;
  fusionSignals: Record<string, any>;
}

/** Clamp a number to [min, max] */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
