import sharp from 'sharp';
import { CheckResult, clamp } from './types';

/**
 * Tampering & Authenticity Heuristics
 * 
 * Performs lightweight suspiciousness detection using metadata 
 * and local visual consistency patterns.
 */
export async function analyzeTampering(filePath: string): Promise<CheckResult> {
  const metadata = await sharp(filePath).metadata();
  const software = metadata.exif?.toString('latin1').toLowerCase() || '';
  
  // 1. Metadata Signal: Editing Software Signatures
  const editingSoftware = ['adobe', 'photoshop', 'gimp', 'pixlr', 'picsart', 'canva', 'snapseed', 'lightroom'];
  const softwareFlag = editingSoftware.find(s => software.includes(s));

  // 2. Visual Signal: Local Variance Inconsistency (Rough heuristic)
  // Divide into 4x4 regions, compute Laplacian variance.
  // Sudden spikes in specific regions while others are flat suggests local cloning/editing.
  const { data, info } = await sharp(filePath).grayscale().resize(200, 200).raw().toBuffer({ resolveWithObject: true });
  const w = info.width;
  const h = info.height;
  
  const blockW = Math.floor(w / 4);
  const blockH = Math.floor(h / 4);
  const variances: number[] = [];

  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 4; col++) {
      let sum = 0;
      let sumSq = 0;
      let count = 0;
      for (let y = row * blockH; y < (row + 1) * blockH; y++) {
        for (let x = col * blockW; x < (col + 1) * blockW; x++) {
          const val = data[y * w + x];
          sum += val;
          sumSq += val * val;
          count++;
        }
      }
      const mean = sum / count;
      const variance = (sumSq / count) - (mean * mean);
      variances.push(variance);
    }
  }

  const avgVar = variances.reduce((a, b) => a + b, 0) / variances.length;
  const maxVar = Math.max(...variances);
  const inconsistencyRatio = avgVar > 0 ? maxVar / avgVar : 0;
  
  const suspiciousConsistency = inconsistencyRatio > 8.0; // High outlier variance suggests local manipulation

  const passed = !softwareFlag && !suspiciousConsistency;
  const confidence = softwareFlag ? 0.9 : (suspiciousConsistency ? 0.6 : 0.8);

  return {
    checkName: 'tampering_detection',
    passed,
    confidence,
    details: {
      softwareFlag: !!softwareFlag,
      softwareFound: softwareFlag ?? null,
      inconsistencyRatio: Math.round(inconsistencyRatio * 10) / 10,
      suspiciousConsistency,
      verdict: softwareFlag ? 'possible_editing_detected' : (suspiciousConsistency ? 'suspicious_visual_inconsistencies' : 'no_obvious_manipulation'),
      perceptualLabels: {
        authenticity: softwareFlag ? 'Likely Edited' : (suspiciousConsistency ? 'Suspicious' : 'Authentic'),
        metadataIntegrity: softwareFlag ? 'Compromised' : 'Intact'
      }
    }
  };
}
