import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useParams, Link } from 'react-router-dom';
import { 
  getBlurInterpretation, 
  getBrightnessInterpretation 
} from '../utils/analysisHelpers';

const JobResults: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [job, setJob] = useState<any>(null);
  const [results, setResults] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchJobData = async () => {
      try {
        const [jobRes, resultsRes] = await Promise.all([
          axios.get(`/api/v1/jobs/${id}/status`),
          axios.get(`/api/v1/jobs/${id}/results`)
        ]);
        setJob(jobRes.data.job);
        setResults(resultsRes.data);
      } catch (err: any) {
        console.error(err);
        setError(err.response?.data?.message || 'Failed to fetch job data');
      } finally {
        setLoading(false);
      }
    };
    if (id) fetchJobData();
  }, [id]);

  if (loading) {
    return <div className="p-xl text-center font-headline-md text-primary">Loading Analysis Results...</div>;
  }

  if (error || !job) {
    return <div className="p-xl text-center font-headline-md text-error">{error || 'Job not found'}</div>;
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'failed': return 'bg-red-100 text-red-700 border-red-200';
      case 'processing': return 'bg-amber-100 text-amber-700 border-amber-200';
      default: return 'bg-surface-container text-outline border-outline-variant';
    }
  };

  const getQualityTier = (score: number) => {
    if (score >= 90) return { text: 'Premium Fidelity', desc: 'Optimal production standard' };
    if (score >= 75) return { text: 'High Quality', desc: 'Reliable for automated processing' };
    if (score >= 50) return { text: 'Acceptable', desc: 'May contain minor fidelity artifacts' };
    return { text: 'Low Fidelity', desc: 'Manual review strongly recommended' };
  };

  const displayScore = Math.round((job.qualityScore || 0) * 100);
  const tier = getQualityTier(displayScore);

  // Perceptual interpretations
  const blurInfo = results?.blur ? getBlurInterpretation(results.blur) : null;
  const brightnessInfo = results?.brightness ? getBrightnessInterpretation(results.brightness) : null;

  return (
    <div className="max-w-[1400px] mx-auto">
      {/* Header Section */}
      <section className="mb-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-lg">
        <div className="space-y-base">
          <div className="flex items-center gap-sm">
            <span className="px-sm py-xs bg-secondary-fixed text-on-secondary-fixed-variant rounded font-code-sm text-code-sm">
              JOB-{id?.substring(0, 8).toUpperCase()}
            </span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest border ${getStatusColor(job.status)}`}>
              {job.status}
            </span>
          </div>
          <h1 className="font-headline-xl text-headline-xl text-primary">{job.originalFilename || 'Processing Results'}</h1>
          <div className="flex items-center gap-md text-outline font-body-md">
            <div className="flex items-center gap-xs">
              <span className="material-symbols-outlined text-[18px]">calendar_today</span>
              <span>{new Date(job.createdAt).toLocaleDateString()}</span>
            </div>
            <div className="flex items-center gap-xs">
              <span className="material-symbols-outlined text-[18px]">tag</span>
              <span>ID: {job.id}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-xl bg-surface-container-lowest p-lg rounded-xl border border-outline-variant shadow-sm">
          <div className="relative w-20 h-20">
            <svg className="w-full h-full transform -rotate-90">
              <circle className="text-surface-container-highest" cx="40" cy="40" fill="transparent" r="36" stroke="currentColor" strokeWidth="8"></circle>
              <circle 
                className="text-secondary transition-all duration-1000 ease-out" 
                cx="40" cy="40" fill="transparent" r="36" stroke="currentColor" 
                strokeDasharray="226.2" 
                strokeDashoffset={226.2 - ((displayScore || 0) / 100) * 226.2} 
                strokeWidth="8"
              ></circle>
            </svg>
            <div className="absolute inset-0 flex items-center justify-center font-headline-md text-primary">
              {displayScore}
            </div>
          </div>
          <div>
            <p className="font-label-md text-outline uppercase tracking-wider">Quality Score</p>
            <p className="font-headline-md text-primary">{tier.text}</p>
            <p className="text-body-md text-on-surface-variant">{tier.desc}</p>
          </div>
        </div>
      </section>

      {/* Result Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-gutter">
        
        {/* Blur Detection Card (Refined) */}
        <div className="glass-card p-lg rounded-xl flex flex-col gap-md">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-sm">
              <span className={`material-symbols-outlined ${blurInfo?.color || 'text-secondary'}`}>
                {blurInfo?.icon || 'blur_on'}
              </span>
              <h3 className="font-headline-md text-headline-md">Sharpness</h3>
            </div>
            <div className="flex flex-col items-end">
              <span className="font-code-sm text-[10px] text-outline uppercase">Confidence</span>
              <span className="font-headline-sm text-primary">
                {Math.round((results?.blur?.confidence || 0) * 100)}%
              </span>
            </div>
          </div>
          
          <div className="flex-1 space-y-md">
            <div>
              <p className={`font-headline-sm ${blurInfo?.color || 'text-primary'}`}>
                {blurInfo?.label || 'Calculating...'}
              </p>
              <p className="text-body-md text-on-surface-variant mt-1">
                {blurInfo?.desc}
              </p>
            </div>
            
            {/* Diagnostics Accordion-style (expanded by default for now) */}
            <div className="p-md bg-surface-container-low rounded-lg space-y-xs border border-outline-variant">
              <p className="text-[10px] font-bold text-outline uppercase tracking-widest mb-1">Diagnostics</p>
              <div className="flex justify-between text-label-md">
                <span className="text-outline">Edge Energy</span>
                <span className="text-primary font-code-sm">{results?.blur?.details?.laplacianVariance?.toFixed(1) || '0.0'}</span>
              </div>
              <div className="flex justify-between text-label-md">
                <span className="text-outline">Motion Coherence</span>
                <span className={`font-code-sm ${results?.blur?.details?.directionalCoherence > 0.15 ? 'text-error' : 'text-primary'}`}>
                  {results?.blur?.details?.directionalCoherence?.toFixed(3) || '0.000'}
                </span>
              </div>
              <div className="flex justify-between text-label-md">
                <span className="text-outline">Spatial Dist.</span>
                <span className="text-primary font-code-sm">{results?.blur?.details?.lowerQuartileBlockSharpness?.toFixed(1) || '0.0'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Brightness Card (Refined) */}
        <div className="glass-card p-lg rounded-xl flex flex-col gap-md">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-sm">
              <span className={`material-symbols-outlined ${brightnessInfo?.color || 'text-secondary'}`}>
                {brightnessInfo?.icon || 'wb_sunny'}
              </span>
              <h3 className="font-headline-md text-headline-md">Exposure</h3>
            </div>
            <div className="flex flex-col items-end">
              <span className="font-code-sm text-[10px] text-outline uppercase">Contrast</span>
              <span className="font-headline-sm text-primary">
                {results?.brightness?.details?.rmsContrast?.toFixed(1) || '0.0'}
              </span>
            </div>
          </div>
          
          <div className="flex-1 space-y-md">
            <div>
              <p className={`font-headline-sm ${brightnessInfo?.color || 'text-primary'}`}>
                {brightnessInfo?.label || 'Calculating...'}
              </p>
              <p className="text-body-md text-on-surface-variant mt-1">
                {brightnessInfo?.desc}
              </p>
            </div>

            <div className="p-md bg-surface-container-low rounded-lg space-y-xs border border-outline-variant">
              <p className="text-[10px] font-bold text-outline uppercase tracking-widest mb-1">Light Map</p>
              <div className="flex justify-between text-label-md">
                <span className="text-outline">Median Luminance</span>
                <span className="text-primary font-code-sm">{results?.brightness?.details?.medianLuminance || '0'}</span>
              </div>
              <div className="flex justify-between text-label-md">
                <span className="text-outline">Clipping Ratio</span>
                <span className={`font-code-sm ${results?.brightness?.details?.blownRegionRatio > 0.1 ? 'text-error' : 'text-primary'}`}>
                  {Math.round((results?.brightness?.details?.blownRegionRatio || 0) * 100)}%
                </span>
              </div>
              <div className="flex justify-between text-label-md">
                <span className="text-outline">Spatial Balance</span>
                <span className="text-primary font-code-sm">{results?.brightness?.details?.weightedLuminance?.toFixed(0) || '0'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Duplicate Detection Card */}
        <div className="glass-card p-lg rounded-xl flex flex-col gap-md">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-sm">
              <span className="material-symbols-outlined text-secondary">content_copy</span>
              <h3 className="font-headline-md text-headline-md">Uniqueness</h3>
            </div>
            {results?.duplicate?.passed === false && (
              <span className="text-error font-code-sm">DUPLICATE</span>
            )}
          </div>
          <div className="flex-1 flex flex-col gap-md">
            <div className="p-md bg-surface-container-low rounded-lg border border-outline-variant flex items-center gap-lg">
              <div className="w-16 h-16 rounded border-2 border-outline-variant bg-surface-container-highest flex items-center justify-center">
                <span className="material-symbols-outlined text-2xl text-outline">fingerprint</span>
              </div>
              <div className="space-y-1">
                <p className="text-label-md text-outline uppercase tracking-widest font-bold">dHash (Perceptual)</p>
                <p className="font-code-sm text-primary text-[10px] truncate w-[160px]">{results?.duplicate?.details?.dHash || 'Not Generated'}</p>
              </div>
            </div>
            <p className="text-body-md text-on-surface-variant">
              {results?.duplicate?.passed === false 
                ? `Highly similar image detected (${results.duplicate.details.duplicateType}). Match distance: ${results.duplicate.details.hammingDistance}.`
                : 'Unique visual signature. No perceptually similar images found in recent history.'}
            </p>
          </div>
        </div>

        {/* Screenshot Detection Card */}
        <div className="glass-card p-lg rounded-xl flex flex-col gap-md">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-sm">
              <span className="material-symbols-outlined text-secondary">screenshot</span>
              <h3 className="font-headline-md text-headline-md">Origin</h3>
            </div>
            {results?.screenshot?.passed === false && (
              <div className="flex items-center gap-xs text-error font-label-md">
                <span className="material-symbols-outlined text-[16px]">warning</span>
                <span>Flagged</span>
              </div>
            )}
          </div>
          <div className="flex-1 flex flex-col gap-sm">
            <div className="flex flex-wrap gap-xs">
              {results?.screenshot?.details?.scoreBreakdown && Object.entries(results.screenshot.details.scoreBreakdown).map(([key, val]: any) => (
                val > 0 && (
                  <div key={key} className="px-sm py-xs bg-error-container text-on-error-container rounded-sm font-label-sm text-[10px] uppercase">
                    {key.replace(/([A-Z])/g, ' $1')}
                  </div>
                )
              ))}
              {results?.screenshot?.passed && (
                <div className="px-sm py-xs bg-secondary/10 text-secondary border border-secondary/20 rounded-sm font-label-sm text-[10px] uppercase">Native Camera</div>
              )}
            </div>
            <p className="text-body-md text-on-surface-variant mt-auto">
              {results?.screenshot?.passed === false 
                ? `Device-capture heuristics flagged (Score: ${results.screenshot.details.totalScore}/8). Likely non-native content.`
                : 'No UI markers, exact screen resolutions, or color palette entropy issues detected.'}
            </p>
          </div>
        </div>

        {/* OCR Detection Card */}
        <div className="glass-card p-lg rounded-xl flex flex-col gap-md">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-sm">
              <span className="material-symbols-outlined text-secondary">spellcheck</span>
              <h3 className="font-headline-md text-headline-md">Identity Extraction</h3>
            </div>
            <div className="flex flex-col items-end">
              <span className="font-code-sm text-[10px] text-outline uppercase">Confidence</span>
              <span className="font-headline-sm text-primary">
                {Math.round((results?.ocr?.details?.ocrWordConfidence || 0) * 100)}%
              </span>
            </div>
          </div>
          <div className="flex-1 space-y-sm">
            <div className="p-sm bg-surface-container-low border border-outline-variant rounded-lg font-code-sm text-on-surface min-h-[80px] max-h-[120px] overflow-y-auto italic text-on-surface-variant">
              "{results?.ocr?.details?.correctedText || 'No clear characters extracted'}"
            </div>
            <div className="flex flex-wrap gap-xs">
              {results?.ocr?.details?.detectedPlates?.map((plate: string, i: number) => (
                <span key={i} className="px-sm py-1 bg-secondary text-on-secondary rounded font-bold text-label-md tracking-widest border border-secondary">
                  {plate}
                </span>
              ))}
              {results?.ocr?.details?.partialMatches?.length > 0 && results?.ocr?.details?.detectedPlates?.length === 0 && (
                <span className="px-sm py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded font-label-md">
                  Partial: {results.ocr.details.partialMatches[0]}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Dimension Validation Card */}
        <div className="glass-card p-lg rounded-xl flex flex-col gap-md">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-sm">
              <span className="material-symbols-outlined text-secondary">aspect_ratio</span>
              <h3 className="font-headline-md text-headline-md">Specifications</h3>
            </div>
            <span className="text-on-surface-variant font-code-sm">
              {results?.dimensions?.details?.aspectRatio?.toFixed(2) || '0.00'} AR
            </span>
          </div>
          <div className="flex-1 flex flex-col gap-md">
            <div className="flex-1 flex items-center justify-center bg-surface-container-low rounded-lg border border-outline-variant">
              <div className="text-center">
                <p className="font-headline-md text-primary">
                  {results?.dimensions?.details?.width || 0} × {results?.dimensions?.details?.height || 0}
                </p>
                <p className="text-label-md text-outline uppercase tracking-widest mt-1">
                  {results?.dimensions?.details?.megapixels?.toFixed(1)} Megapixels
                </p>
              </div>
            </div>
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-sm">
                <span className="material-symbols-outlined text-outline">data_usage</span>
                <span className="text-body-md text-on-surface-variant">{results?.dimensions?.details?.fileSizeMB?.toFixed(2)} MB</span>
              </div>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${results?.dimensions?.passed ? 'bg-secondary/10 text-secondary' : 'bg-error-container text-on-error-container'}`}>
                {results?.dimensions?.passed ? 'Compliant' : 'Out of Bounds'}
              </span>
            </div>
          </div>
        </div>

      </div>

      {/* Action Footer */}
      <footer className="mt-2xl pt-xl border-t border-outline-variant flex justify-between items-center">
        <div className="flex items-center gap-md text-outline font-body-md">
          <div className="flex items-center gap-xs">
            <span className="material-symbols-outlined text-[18px]">verified_user</span>
            <span>Security Signature: {job.id.substring(0, 16)}</span>
          </div>
        </div>
        <div className="flex gap-md">
          <Link to="/jobs" className="px-lg py-md border border-primary rounded-lg text-primary font-label-md hover:bg-surface-container-high transition-colors">
            Back to Jobs
          </Link>
          <button className="px-lg py-md bg-primary text-on-primary rounded-lg font-label-md flex items-center gap-sm hover:opacity-90 transition-opacity">
            <span className="material-symbols-outlined text-[20px]">file_download</span>
            Download Full Report
          </button>
        </div>
      </footer>
    </div>
  );
};

export default JobResults;
