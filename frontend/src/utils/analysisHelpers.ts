/**
 * Frontend Interpretation Layer for Operational Verification
 * 
 * Maps raw metrics and trust signals to human-perceptual operational states.
 * Focuses on verification usability rather than aesthetic quality.
 */

export interface BlurResult {
  passed: boolean;
  confidence: number;
  details?: {
    laplacianVariance?: number;
    tenegradScore?: number;
    orientationEntropy?: number;
    directionalCoherence?: number;
    lowerQuartileBlockSharpness?: number;
    motionBlurDetected?: boolean;
    blurryVoteCount?: number;
    perceptualLabels?: {
      edgeEnergy: string;
      motionRisk: string;
      spatialClarity: string;
    };
  };
}

export interface BrightnessResult {
  passed: boolean;
  confidence: number;
  details?: {
    medianLuminance?: number;
    rmsContrast?: number;
    blownRegionRatio?: number;
    failures?: string[];
    verdict?: string;
  };
}

export interface AnalysisState {
  label: string;
  severity: 'success' | 'warning' | 'error' | 'info' | 'pending';
  icon: string;
  desc: string;
  color: string;
}

/** Get operational status and description for Sharpness/Blur */
export const getBlurInterpretation = (result?: BlurResult): AnalysisState => {
  if (!result || !result.details) {
    return {
      label: 'Analyzing Clarity...',
      severity: 'pending',
      icon: 'hourglass_empty',
      desc: 'Clarity and motion risk evaluation in progress.',
      color: 'text-outline'
    };
  }

  const { details, passed, confidence } = result;
  const labels = details.perceptualLabels;

  // PRIORITY 1: Motion Blur (Smearing)
  if (details.motionBlurDetected || (labels && (labels.motionRisk === 'Severe' || labels.motionRisk === 'High'))) {
    return {
      label: labels?.motionRisk === 'Severe' ? 'Severe Motion Smearing' : 'Moderate Motion Blur',
      severity: 'error',
      icon: 'motion_photos_off',
      desc: 'Directional streaking detected. Detail clarity is compromised for verification.',
      color: 'text-error'
    };
  }

  // PRIORITY 2: Focus Failures
  if (!passed) {
    if ((details.blurryVoteCount ?? 0) >= 2) {
      return {
        label: 'Uncertain Readability',
        severity: 'error',
        icon: 'blur_off',
        desc: 'Significant loss of high-frequency detail. Character legibility likely low.',
        color: 'text-error'
      };
    }
    return {
      label: 'Reduced Sharpness',
      severity: 'warning',
      icon: 'blur_on',
      desc: 'Acceptable for manual review, but lacks professional focus clarity.',
      color: 'text-warning'
    };
  }

  // PRIORITY 3: Operational Success States
  if (confidence >= 0.9 && labels?.motionRisk === 'Low' && labels?.edgeEnergy === 'High') {
    return {
      label: 'Verification Ready',
      severity: 'success',
      icon: 'verified',
      desc: 'Optimal clarity with zero motion artifacts and high edge definition.',
      color: 'text-secondary'
    };
  }

  if (confidence >= 0.75) {
    return {
      label: 'Acceptable Clarity',
      severity: 'success',
      icon: 'check_circle',
      desc: 'Sufficient detail density for automated and manual verification.',
      color: 'text-secondary'
    };
  }

  if (confidence >= 0.5) {
    return {
      label: 'Manual Review Recommended',
      severity: 'info',
      icon: 'help',
      desc: 'Slightly soft focus. Visual confirmation of plate identity suggested.',
      color: 'text-outline'
    };
  }

  return {
    label: 'Limited Detail',
    severity: 'info',
    icon: 'info',
    desc: 'Image lacks sufficient structure for automated processing.',
    color: 'text-outline'
  };
};

/** Get operational status and description for Exposure */
export const getBrightnessInterpretation = (result?: BrightnessResult): AnalysisState => {
  if (!result || !result.details) {
    return {
      label: 'Analyzing Lighting...',
      severity: 'pending',
      icon: 'hourglass_empty',
      desc: 'Luminance and contrast evaluation in progress.',
      color: 'text-outline'
    };
  }

  const { details, passed } = result;

  if (details.failures?.includes('shadow_clipping')) {
    return {
      label: 'Crushed Shadows',
      severity: 'error',
      icon: 'brightness_4',
      desc: 'Severe detail loss in dark regions. May hide vehicle features.',
      color: 'text-error'
    };
  }

  if (details.failures?.includes('highlight_clipping')) {
    return {
      label: 'Blown Highlights',
      severity: 'error',
      icon: 'brightness_7',
      desc: 'Severe glare or overexposure. May obscure characters.',
      color: 'text-error'
    };
  }

  if (details.failures?.includes('low_contrast')) {
    return {
      label: 'Limited Contrast',
      severity: 'warning',
      icon: 'tonality',
      desc: 'Lacks tonal separation. Character differentiation may be difficult.',
      color: 'text-warning'
    };
  }

  if (!passed) {
    return {
      label: details.verdict === 'too_dark' ? 'Suboptimal Lighting' : 'Strong Exposure',
      severity: 'error',
      icon: details.verdict === 'too_dark' ? 'dark_mode' : 'light_mode',
      desc: 'Illumination levels are outside optimal verification range.',
      color: 'text-error'
    };
  }

  return {
    label: 'Balanced Exposure',
    severity: 'success',
    icon: 'brightness_medium',
    desc: 'Optimal luminance and contrast for automated extraction.',
    color: 'text-secondary'
  };
};
