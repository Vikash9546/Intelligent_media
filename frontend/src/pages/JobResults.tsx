import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useParams, Link } from 'react-router-dom';

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
        setJob(jobRes.data.data);
        setResults(resultsRes.data.data);
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

  // Helper to determine status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'failed': return 'bg-red-100 text-red-700 border-red-200';
      case 'processing': return 'bg-amber-100 text-amber-700 border-amber-200';
      default: return 'bg-surface-container text-outline border-outline-variant';
    }
  };

  const getQualityText = (score: number) => {
    if (score > 90) return { text: 'High Fidelity', desc: 'Optimal for production' };
    if (score > 70) return { text: 'Standard Quality', desc: 'Acceptable for most uses' };
    return { text: 'Low Quality', desc: 'May require review' };
  };

  const quality = getQualityText(job.qualityScore || 0);

  return (
    <div className="max-w-[1400px] mx-auto">
      {/* Job Results Header Section */}
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
          <h1 className="font-headline-xl text-headline-xl text-primary">Processing Results</h1>
          <div className="flex items-center gap-md text-outline font-body-md">
            <div className="flex items-center gap-xs">
              <span className="material-symbols-outlined text-[18px]">calendar_today</span>
              <span>{new Date(job.createdAt).toLocaleDateString()}</span>
            </div>
            <div className="flex items-center gap-xs">
              <span className="material-symbols-outlined text-[18px]">image</span>
              <span>{job.originalFilename}</span>
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
                strokeDashoffset={226.2 - ((job.qualityScore || 0) / 100) * 226.2} 
                strokeWidth="8"
              ></circle>
            </svg>
            <div className="absolute inset-0 flex items-center justify-center font-headline-md text-primary">
              {Math.round(job.qualityScore || 0)}
            </div>
          </div>
          <div>
            <p className="font-label-md text-outline uppercase tracking-wider">Overall Quality</p>
            <p className="font-headline-md text-primary">{quality.text}</p>
            <p className="text-body-md text-on-surface-variant">{quality.desc}</p>
          </div>
        </div>
      </section>

      {/* Result Cards Bento Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-gutter">
        
        {/* Blur Detection Card */}
        <div className="glass-card p-lg rounded-xl flex flex-col gap-md">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-sm">
              <span className="material-symbols-outlined text-secondary">blur_on</span>
              <h3 className="font-headline-md text-headline-md">Blur Detection</h3>
            </div>
            <span className="text-on-surface-variant font-code-sm">
              Var: {results?.blur?.variance?.toFixed(1) || 'N/A'}
            </span>
          </div>
          <div className="flex-1 flex flex-col justify-center gap-sm">
            <div className="h-2 w-full bg-surface-container-highest rounded-full overflow-hidden">
              <div 
                className={`h-full ${results?.blur?.isBlurred ? 'bg-error' : 'bg-secondary'}`} 
                style={{ width: `${Math.min(100, (results?.blur?.variance || 0) / 10)}%` }}
              ></div>
            </div>
            <div className="flex justify-between text-label-md text-outline">
              <span>Sharp</span>
              <span>Motion Blur</span>
            </div>
          </div>
          <p className="text-body-md text-on-surface-variant">
            {results?.blur?.isBlurred 
              ? 'Low variance indicates significant blurring or lack of focus.' 
              : 'Variance score indicates high edge definition. Low probability of focus issues.'}
          </p>
        </div>

        {/* Brightness Card */}
        <div className="glass-card p-lg rounded-xl flex flex-col gap-md">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-sm">
              <span className="material-symbols-outlined text-secondary">wb_sunny</span>
              <h3 className="font-headline-md text-headline-md">Luminance</h3>
            </div>
            <span className="text-on-surface-variant font-code-sm">
              {results?.brightness?.meanLuminance?.toFixed(1) || 'N/A'} cd/m²
            </span>
          </div>
          <div className="flex-1 flex items-end gap-1">
            <div className="bg-surface-container-highest w-full h-8 rounded-sm"></div>
            <div className="bg-surface-container-highest w-full h-12 rounded-sm"></div>
            <div className="bg-secondary w-full h-24 rounded-sm"></div>
            <div className="bg-secondary w-full h-20 rounded-sm"></div>
            <div className="bg-surface-container-highest w-full h-10 rounded-sm"></div>
            <div className="bg-surface-container-highest w-full h-6 rounded-sm"></div>
          </div>
          <p className="text-body-md text-on-surface-variant">
            {results?.brightness?.issue 
              ? `Exposure issue detected: ${results.brightness.issue}` 
              : 'Balanced exposure detected. Mid-tone distribution is within nominal parameters.'}
          </p>
        </div>

        {/* Duplicate Detection Card */}
        <div className="glass-card p-lg rounded-xl flex flex-col gap-md">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-sm">
              <span className="material-symbols-outlined text-secondary">content_copy</span>
              <h3 className="font-headline-md text-headline-md">Similarity</h3>
            </div>
            {results?.duplicate?.matchFound && (
              <span className="text-error font-code-sm">MATCH FOUND</span>
            )}
          </div>
          <div className="flex-1 flex items-center justify-center">
            <div className="relative flex -space-x-8">
              <div className="w-20 h-20 rounded-lg border-4 border-white shadow-lg bg-surface-container-highest flex items-center justify-center">
                <span className="material-symbols-outlined text-3xl text-outline">image</span>
              </div>
              {results?.duplicate?.matchFound && (
                <div className="w-20 h-20 rounded-lg border-4 border-white shadow-lg bg-surface-container-highest flex items-center justify-center opacity-60">
                  <span className="material-symbols-outlined text-3xl text-outline">image</span>
                </div>
              )}
            </div>
          </div>
          <p className="text-body-md text-on-surface-variant">
            {results?.duplicate?.matchFound 
              ? `Duplicate match found in database (distance: ${results.duplicate.hammingDistance}).`
              : 'Low duplication probability. Unique visual signature confirmed.'}
          </p>
        </div>

        {/* Screenshot Detection Card */}
        <div className="glass-card p-lg rounded-xl flex flex-col gap-md">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-sm">
              <span className="material-symbols-outlined text-secondary">screenshot</span>
              <h3 className="font-headline-md text-headline-md">UI Detection</h3>
            </div>
            {results?.screenshot?.isScreenshot && (
              <div className="flex items-center gap-xs text-error font-label-md">
                <span className="material-symbols-outlined text-[16px]">warning</span>
                <span>Flagged</span>
              </div>
            )}
          </div>
          <div className="flex-1 flex flex-wrap gap-sm content-start">
            {results?.screenshot?.reasons?.map((reason: string, i: number) => (
              <div key={i} className="px-sm py-xs bg-error-container text-on-error-container rounded-sm font-label-md">
                {reason}
              </div>
            ))}
            {!results?.screenshot?.isScreenshot && (
              <div className="px-sm py-xs bg-surface-container-highest text-outline rounded-sm font-label-md">Native Content</div>
            )}
          </div>
          <p className="text-body-md text-on-surface-variant">
            {results?.screenshot?.isScreenshot 
              ? 'Potential screenshot material detected via heuristic analysis.'
              : 'No UI overlays or mobile device resolutions detected.'}
          </p>
        </div>

        {/* OCR Detection Card */}
        <div className="glass-card p-lg rounded-xl flex flex-col gap-md">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-sm">
              <span className="material-symbols-outlined text-secondary">spellcheck</span>
              <h3 className="font-headline-md text-headline-md">OCR Extracted</h3>
            </div>
            <span className="material-symbols-outlined text-outline">translate</span>
          </div>
          <div className="flex-1 space-y-sm">
            <div className="p-sm bg-surface-container-low border border-outline-variant rounded-lg font-code-sm text-on-surface min-h-[60px] max-h-[100px] overflow-y-auto">
              {results?.ocr?.text || '"No text detected"'}
            </div>
            {results?.ocr?.platesFound && results.ocr.platesFound.length > 0 && (
              <div className="flex flex-wrap gap-xs">
                {results.ocr.platesFound.map((plate: string, i: number) => (
                  <span key={i} className="px-xs py-[2px] bg-secondary/10 text-secondary border border-secondary/20 rounded font-label-md text-[10px]">
                    {plate}
                  </span>
                ))}
              </div>
            )}
          </div>
          <p className="text-body-md text-on-surface-variant">
            {results?.ocr?.platesFound?.length > 0
              ? 'Number plates successfully extracted.'
              : 'No restricted patterns found in extracted text.'}
          </p>
        </div>

        {/* Dimension Validation Card */}
        <div className="glass-card p-lg rounded-xl flex flex-col gap-md">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-sm">
              <span className="material-symbols-outlined text-secondary">aspect_ratio</span>
              <h3 className="font-headline-md text-headline-md">Dimensions</h3>
            </div>
            <span className="text-on-surface-variant font-code-sm">
              {results?.dimensions?.aspectRatio?.toFixed(2) || 'N/A'} : 1
            </span>
          </div>
          <div className="flex-1 flex items-center justify-center">
            <div className="w-3/4 aspect-video border-2 border-dashed border-secondary/40 rounded flex items-center justify-center bg-secondary/5">
              <div className="text-center">
                <p className="font-headline-md text-secondary">
                  {results?.dimensions?.width || 0} x {results?.dimensions?.height || 0}
                </p>
              </div>
            </div>
          </div>
          <p className="text-body-md text-on-surface-variant">
            {results?.dimensions?.isValid 
              ? 'Aspect ratio and dimensions validated against limits.'
              : 'Dimensions failed validation criteria.'}
          </p>
        </div>

      </div>

      {/* Action Footer */}
      <footer className="mt-2xl pt-xl border-t border-outline-variant flex justify-between items-center">
        <div className="flex items-center gap-md">
          <div className="w-10 h-10 rounded-full bg-secondary-fixed flex items-center justify-center text-on-secondary-fixed-variant">
            <span className="material-symbols-outlined">verified_user</span>
          </div>
          <div>
            <p className="font-label-md text-primary font-bold">Pipeline Processed</p>
            <p className="text-label-md text-outline">ID: {job.id}</p>
          </div>
        </div>
        <div className="flex gap-md">
          <Link to="/jobs" className="px-lg py-md border border-primary rounded-lg text-primary font-label-md hover:bg-surface-container-high transition-colors">
            Back to Jobs
          </Link>
          <button className="px-lg py-md bg-primary text-on-primary rounded-lg font-label-md flex items-center gap-sm hover:opacity-90 transition-opacity">
            <span className="material-symbols-outlined text-[20px]">file_download</span>
            Export Report
          </button>
        </div>
      </footer>
    </div>
  );
};

export default JobResults;
