import {
  getBlurInterpretation,
  getBrightnessInterpretation
} from "./analysisHelpers";
function normalizeAnalysisResponse(raw) {
  const results = raw?.results ?? {};
  const trust = raw?.trustAssessment;
  const blurResult = results["blur"] || results["blur_detection"];
  const brightnessResult = results["brightness"] || results["brightness_analysis"];
  const ocrResult = results["ocr"] || results["ocr_plate_detection"];
  const dupResult = results["duplicate"] || results["duplicate_detection"];
  const screenResult = results["screenshot"] || results["screenshot_detection"];
  const dimResult = results["dimensions"] || results["dimension_validation"];
  const tamperResult = results["tampering"] || results["tampering_detection"];
  let blurState = getBlurInterpretation(blurResult);
  const ocrConfidence = ocrResult?.confidence ?? ocrResult?.details?.ocrWordConfidence ?? null;
  const megapixels = dimResult?.details?.megapixels ?? null;
  if (megapixels !== null && megapixels < 0.5 && blurState.severity === "success") {
    blurState = {
      ...blurState,
      label: "Limited Detail",
      severity: "warning",
      desc: "Clarity appears sufficient but low resolution may obscure small character features.",
      color: "text-warning"
    };
  }
  if (ocrConfidence !== null && ocrConfidence < 0.45 && blurState.severity === "success") {
    blurState = {
      ...blurState,
      label: "Uncertain Readability",
      severity: "warning",
      desc: "Visual clarity is high, but OCR engine is struggling. Character verification required.",
      color: "text-warning"
    };
  }
  const recMap = {
    ready_for_verification: { label: "Ready for Verification", severity: "success", desc: "Optimal conditions for automated and manual processing." },
    acceptable_with_warnings: { label: "Acceptable with Warnings", severity: "success", desc: "Minor quality or workflow issues detected. Automated processing safe." },
    manual_review_required: { label: "Manual Review Recommended", severity: "warning", desc: "Uncertain signals detected. Human visual confirmation advised." },
    verification_limited: { label: "Verification Limited", severity: "error", desc: "Suboptimal quality may lead to false negatives/positives." },
    rejected: { label: "Verification Rejected", severity: "error", desc: "Authenticity or quality failures prevent reliable processing." }
  };
  const recommendation = recMap[trust?.recommendation ?? ""] ?? {
    label: raw?.status === "completed" ? "Evaluation Complete" : "Analyzing Usability...",
    severity: "info",
    desc: "Pipeline finalizing trust assessment and operational outcomes."
  };
  const ocrReadability = ocrConfidence === null ? "Analyzing..." : ocrConfidence > 0.75 ? "Clearly Readable" : ocrConfidence > 0.45 ? "Partially Readable" : ocrConfidence > 0.15 ? "Uncertain Identity" : "Readability Failed";
  const resLabel = megapixels === null ? "Validating..." : megapixels < 0.2 ? "Low Resolution" : megapixels < 0.8 ? "Moderate Resolution" : "High Resolution";
  return {
    id: raw?.id ?? "Unknown",
    isReady: raw?.status === "completed",
    completeness: Object.keys(results).length >= 7 ? "complete" : Object.keys(results).length > 0 ? "partial" : "pending",
    trustScore: trust?.trustScore ?? Math.round((raw?.qualityScore ?? 0) * 100),
    trustLevel: trust?.trustLevel?.toUpperCase() ?? "PENDING",
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
      ...getBrightnessInterpretation(brightnessResult),
      confidence: brightnessResult?.confidence ?? null,
      details: brightnessResult?.details ?? null
    },
    uniqueness: {
      passed: dupResult?.passed ?? null,
      label: dupResult?.details?.perceptualLabel ?? (dupResult?.passed === false ? "Duplicate Detected" : "Unique Content"),
      severity: dupResult?.details?.severity ?? (dupResult?.passed === false ? "error" : "success")
    },
    authenticity: {
      passed: (screenResult?.passed && tamperResult?.passed) ?? null,
      label: tamperResult?.details?.perceptualLabels?.authenticity ?? (screenResult?.passed === false ? "Suspicious" : "Authentic"),
      source: screenResult?.details?.perceptualLabels?.captureSource ?? "Validating Source...",
      riskLevel: screenResult?.details?.totalScore >= 6 ? "high" : screenResult?.details?.totalScore >= 3 ? "medium" : "low",
      flags: [...screenResult?.details?.flags || [], ...tamperResult?.details?.softwareFound ? [`Edited: ${tamperResult.details.softwareFound}`] : []]
    },
    ocr: {
      readability: ocrReadability,
      readabilityLevel: ocrConfidence > 0.75 ? "high" : ocrConfidence > 0.45 ? "medium" : ocrConfidence > 0.15 ? "low" : "unreadable",
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
      impactDesc: megapixels < 0.6 ? "Low detail density may impact automated extraction reliability." : "Sufficient resolution for high-fidelity verification."
    }
  };
}
export {
  normalizeAnalysisResponse
};
