/**
 * Shared type for the result of any analysis check.
 * Every check module exports exactly one function: analyzeX(filePath) → CheckResult
 */
export interface CheckResult {
  checkName: string;
  passed: boolean;
  confidence: number; // 0.0–1.0
  details: Record<string, unknown>;
}

/** Clamp a number to [min, max] */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
