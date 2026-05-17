/**
 * Analysis Adapter Layer
 * 
 * Normalizes raw backend CV responses into frontend-safe, strongly typed DTOs.
 * Centralizes interpretation, fusion, and completeness logic.
 */

import { 
  getBlurInterpretation, 
  getBrightnessInterpretation, 
} from './analysisHelpers';
import type { AnalysisState } from './analysisHelpers';

// --- Raw Backend Interfaces ---
export interface RawCheckResult {
  passed: boolean;
  confidence: number;
  details: Record<string, any>;
}

export interface TrustDimensions {
  visualQuality: number;
  ocrReliability: number;
  authenticityConfidence: number;
  workflowIntegrity: number;
  operationalUsability: number;
}

export interface RawAnalysisResponse {
  id: string;
  status: string;
  originalFilename: string;
  qualityScore: number;
  results: Record<string, RawCheckResult>;
  trustAssessment?: {
    trustScore: number;
    trustLevel: string;
    recommendation: string;
    summary: string[];
    uncertaintyFlags: string[];
    isAuthentic: boolean;
    dimensions: TrustDimensions;
    fusionSignals: Record<string, any>;
  };
}

export interface ImageMetadata {
  format: string;
  colorSpace: string;
  channels: number | null;
  depth: string;
  density: number | null;
  hasAlpha: boolean | null;
  hasProfile: boolean | null;
  orientation: number | null;
  cameraMake: string | null;
  cameraModel: string | null;
  software: string | null;
  createdDate: string | null;
  modifyDate: string | null;
  gps: { latitude: number; longitude: number } | null;
}

// --- Normalized Frontend DTOs ---
export interface NormalizedAnalysis {
  id: string;
  isReady: boolean;
  completeness: 'complete' | 'partial' | 'pending';
  trustScore: number; // Normalized 0-100
  trustLevel: string;
  recommendation: {
    label: string;
    severity: 'success' | 'warning' | 'error' | 'info';
    desc: string;
    summary: string[];
  };
  dimensions: TrustDimensions | null;
  imageMetadata: ImageMetadata | null;
  blur: AnalysisState & { 
    confidence: number | null; 
    details: any;
  };
  brightness: AnalysisState & { 
    confidence: number | null; 
    details: any;
  };
  uniqueness: {
    passed: boolean | null;
    label: string;
    severity: 'success' | 'warning' | 'error' | 'none';
  };
  authenticity: {
    passed: boolean | null;
    label: string;
    source: string;
    riskLevel: 'low' | 'medium' | 'high';
    flags: string[];
  };
  ocr: {
    readability: string;
    readabilityLevel: 'high' | 'medium' | 'low' | 'unreadable';
    text: string | null;
    plates: string[];
    confidence: number | null;
  };
  specs: {
    resolutionLabel: string;
    megapixels: number | null;
    width: number | null;
    height: number | null;
    fileSizeMB: number | null;
    impactDesc: string;
  };
}

/**
 * Normalizes a raw backend response into a safe frontend model.
 */
export function normalizeAnalysisResponse(raw?: RawAnalysisResponse): NormalizedAnalysis {
  const results = raw?.results ?? {};
  const trust = raw?.trustAssessment;
  
  // 1. Base results
  const blurResult = results['blur'] || results['blur_detection'];
  const brightnessResult = results['brightness'] || results['brightness_analysis'];
  const ocrResult = results['ocr'] || results['ocr_plate_detection'];
  const dupResult = results['duplicate'] || results['duplicate_detection'];
  const screenResult = results['screenshot'] || results['screenshot_detection'];
  const dimResult = results['dimensions'] || results['dimension_validation'];
  const tamperResult = results['tampering'] || results['tampering_detection'];

  // 2. Fusion & Cross-Signal Reasoning
  let blurState = getBlurInterpretation(blurResult as any);
  const ocrConfidence = ocrResult?.confidence ?? ocrResult?.details?.ocrWordConfidence ?? null;
  const megapixels = dimResult?.details?.megapixels ?? null;
  
  if (megapixels !== null && megapixels < 0.5 && blurState.severity === 'success') {
    blurState = {
      ...blurState,
      label: 'Limited Detail',
      severity: 'warning',
      desc: 'Clarity appears sufficient but low resolution may obscure small character features.',
      color: 'text-warning'
    };
  }

  if (ocrConfidence !== null && ocrConfidence < 0.45 && blurState.severity === 'success') {
    blurState = {
      ...blurState,
      label: 'Uncertain Readability',
      severity: 'warning',
      desc: 'Visual clarity is high, but OCR engine is struggling. Character verification required.',
      color: 'text-warning'
    };
  }

  // 3. Operational Recommendation Routing
  const recMap: Record<string, any> = {
    ready_for_verification: { label: 'Ready for Verification', severity: 'success', desc: 'Optimal conditions for automated and manual processing.' },
    acceptable_with_warnings: { label: 'Acceptable with Warnings', severity: 'success', desc: 'Minor quality or workflow issues detected. Automated processing safe.' },
    manual_review_required: { label: 'Manual Review Recommended', severity: 'warning', desc: 'Uncertain signals detected. Human visual confirmation advised.' },
    verification_limited: { label: 'Verification Limited', severity: 'error', desc: 'Suboptimal quality may lead to false negatives/positives.' },
    rejected: { label: 'Verification Rejected', severity: 'error', desc: 'Authenticity or quality failures prevent reliable processing.' }
  };

  const recommendation = recMap[trust?.recommendation ?? ''] ?? {
    label: raw?.status === 'completed' ? 'Evaluation Complete' : 'Analyzing Usability...',
    severity: 'info',
    desc: 'Pipeline finalizing trust assessment and operational outcomes.'
  };

  // 4. Perceptual Mappings
  const ocrReadability = ocrConfidence === null ? 'Analyzing...' :
    ocrConfidence > 0.75 ? 'Clearly Readable' :
    ocrConfidence > 0.45 ? 'Partially Readable' :
    ocrConfidence > 0.15 ? 'Uncertain Identity' : 'Readability Failed';

  const resLabel = megapixels === null ? 'Validating...' :
    megapixels < 0.2 ? 'Low Resolution' :
    megapixels < 0.8 ? 'Moderate Resolution' : 'High Resolution';

  return {
    id: raw?.id ?? 'Unknown',
    isReady: raw?.status === 'completed',
    completeness: Object.keys(results).length >= 7 ? 'complete' : (Object.keys(results).length > 0 ? 'partial' : 'pending'),
    trustScore: trust?.trustScore ?? Math.round((raw?.qualityScore ?? 0) * 100),
    trustLevel: trust?.trustLevel?.toUpperCase() ?? 'PENDING',
    dimensions: trust?.dimensions ?? null,
    imageMetadata: dimResult?.details?.metadata ?? null,
    
    recommendation: {
      ...recommendation,
      summary: trust?.summary ?? []
    },
    
    blur: {
      ...blurState,
      confidence: blurResult?.confidence ?? null,
      details: blurResult?.details ?? null
    },
    
    brightness: {
      ...getBrightnessInterpretation(brightnessResult as any),
      confidence: brightnessResult?.confidence ?? null,
      details: brightnessResult?.details ?? null
    },
    
    uniqueness: {
      passed: dupResult?.passed ?? null,
      label: dupResult?.details?.perceptualLabel ?? (dupResult?.passed === false ? 'Duplicate Detected' : 'Unique Content'),
      severity: dupResult?.details?.severity ?? (dupResult?.passed === false ? 'error' : 'success')
    },
    
    authenticity: {
      passed: (screenResult?.passed && tamperResult?.passed) ?? null,
      label: tamperResult?.details?.perceptualLabels?.authenticity ?? (screenResult?.passed === false ? 'Suspicious' : 'Authentic'),
      source: screenResult?.details?.perceptualLabels?.captureSource ?? 'Validating Source...',
      riskLevel: screenResult?.details?.totalScore >= 6 ? 'high' : (screenResult?.details?.totalScore >= 3 ? 'medium' : 'low'),
      flags: [...(screenResult?.details?.flags || []), ...(tamperResult?.details?.softwareFound ? [`Edited: ${tamperResult.details.softwareFound}`] : [])]
    },
    
    ocr: {
      readability: ocrReadability,
      readabilityLevel: ocrConfidence > 0.75 ? 'high' : (ocrConfidence > 0.45 ? 'medium' : (ocrConfidence > 0.15 ? 'low' : 'unreadable')),
      text: ocrResult?.details?.correctedText ?? null,
      plates: ocrResult?.details?.detectedPlates ?? [],
      confidence: ocrConfidence
    },
    
    specs: {
      resolutionLabel: resLabel,
      megapixels,
      width: dimResult?.details?.width ?? null,
      height: dimResult?.details?.height ?? null,
      fileSizeMB: dimResult?.details?.fileSizeMB ?? null,
      impactDesc: megapixels < 0.6 ? 'Low detail density may impact automated extraction reliability.' : 'Sufficient resolution for high-fidelity verification.'
    }
  };
}
