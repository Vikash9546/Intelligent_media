/**
 * Frontend Interpretation Layer for Analysis Results
 * 
 * Maps raw backend metrics and flags to human-perceptual states.
 */

export interface BlurResult {
  passed: boolean;
  confidence: number;
  details: {
    laplacianVariance: number;
    tenegradScore: number;
    orientationEntropy: number;
    directionalCoherence: number;
    lowerQuartileBlockSharpness: number;
    motionBlurDetected: boolean;
    blurryVoteCount: number;
  };
}

export interface BrightnessResult {
  passed: boolean;
  confidence: number;
  details: {
    medianLuminance: number;
    rmsContrast: number;
    blownRegionRatio: number;
    failures: string[];
    verdict: string;
  };
}

/** Get user-facing status and description for Blur Detection */
export const getBlurInterpretation = (result: BlurResult) => {
  const { details, passed, confidence } = result;
  
  if (details.motionBlurDetected) {
    return {
      label: 'Motion Blur',
      severity: 'error',
      icon: 'motion_photos_off',
      desc: 'Strong directional streaking detected from camera or subject motion.',
      color: 'text-error'
    };
  }

  if (!passed) {
    if (details.blurryVoteCount >= 2) {
      return {
        label: 'Out of Focus',
        severity: 'error',
        icon: 'blur_off',
        desc: 'Insufficient high-frequency detail detected. Image appears fuzzy.',
        color: 'text-error'
      };
    }
    return {
      label: 'Poor Focus',
      severity: 'warning',
      icon: 'blur_on',
      desc: 'Partial blur detected. Subject clarity is below optimal thresholds.',
      color: 'text-warning'
    };
  }

  if (confidence > 0.8) {
    return {
      label: 'Excellent Sharpness',
      severity: 'success',
      icon: 'verified',
      desc: 'Crystal clear focus with consistent edge distribution.',
      color: 'text-secondary'
    };
  }

  return {
    label: 'Good Focus',
    severity: 'success',
    icon: 'check_circle',
    desc: 'Focus quality is within acceptable parameters for analysis.',
    color: 'text-secondary'
  };
};

/** Get user-facing status and description for Brightness Analysis */
export const getBrightnessInterpretation = (result: BrightnessResult) => {
  const { details, passed } = result;

  if (details.failures.includes('shadow_clipping')) {
    return {
      label: 'Shadow Clipping',
      severity: 'error',
      icon: 'brightness_4',
      desc: 'Severe detail loss in dark regions (crushed blacks).',
      color: 'text-error'
    };
  }

  if (details.failures.includes('highlight_clipping')) {
    return {
      label: 'Highlight Clipping',
      severity: 'error',
      icon: 'brightness_7',
      desc: 'Severe detail loss in bright regions (blown highlights).',
      color: 'text-error'
    };
  }

  if (details.failures.includes('low_contrast')) {
    return {
      label: 'Low Contrast',
      severity: 'warning',
      icon: 'tonality',
      desc: 'Image lacks tonal separation. May be caused by fog, haze, or poor lighting.',
      color: 'text-warning'
    };
  }

  if (!passed) {
    return {
      label: details.verdict === 'too_dark' ? 'Underexposed' : 'Overexposed',
      severity: 'error',
      icon: details.verdict === 'too_dark' ? 'dark_mode' : 'light_mode',
      desc: 'Exposure levels are outside usable range for reliable processing.',
      color: 'text-error'
    };
  }

  return {
    label: 'Optimal Exposure',
    severity: 'success',
    icon: 'brightness_medium',
    desc: 'Balanced luminance and contrast detected across the scene.',
    color: 'text-secondary'
  };
};
