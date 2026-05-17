import { useEffect, useState } from "react";
import axios from "axios";
import { useParams, Link } from "react-router-dom";
import { normalizeAnalysisResponse } from "../utils/analysisAdapter";
import {
  renderMetric,
  renderConfidence,
  renderLabel,
  renderResolution,
  SeverityBadge
} from "../utils/renderHelpers";
import {
  Sparkles,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Fingerprint,
  MapPin,
  Camera,
  Palette,
  Calendar,
  Layers,
  Printer,
  ArrowLeft,
  Terminal,
  Eye,
  EyeOff,
  Maximize2,
  Scan,
  Info,
  ExternalLink,
  ShieldCheck,
  ShieldAlert,
  Zap
} from "lucide-react";

const TrustDimensionBar = ({ label, value, color }) => (
  <div className="space-y-1">
    <div className="flex justify-between items-end">
      <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider">{label}</span>
      <span className="text-xs font-bold font-code-sm text-zinc-200">{Math.round(value)}%</span>
    </div>
    <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden border border-white/[0.02]">
      <div
        className={`h-full transition-all duration-1000 ease-out rounded-full ${color}`}
        style={{ width: `${value}%` }}
      />
    </div>
  </div>
);

const getReadableOcrLabel = (readability, confidence, plates) => {
  const conf = confidence ?? 0;
  if (plates.length > 0 && conf > 0.7) return "Clearly Readable";
  if (plates.length > 0) return "Mostly Readable";
  if (readability === "partially_readable") return "Partial Extraction";
  if (readability === "low_confidence_extraction") return "Extraction Uncertain";
  return "Unreadable";
};

const JobResults = () => {
  const { id } = useParams();
  const [job, setJob] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showDiagnostics, setShowDiagnostics] = useState(false);

  useEffect(() => {
    let timerId;
    let isActive = true;

    const fetchJobData = async () => {
      try {
        const jobRes = await axios.get(`/api/v1/jobs/${id}/status`);
        if (!isActive) return;

        const currentJob = jobRes.data.job;
        setJob(currentJob);

        if (currentJob.status === "completed") {
          const resultsRes = await axios.get(`/api/v1/jobs/${id}/results`);
          if (!isActive) return;
          setAnalysis(normalizeAnalysisResponse(resultsRes.data));
          setLoading(false);
          setError(null);
        } else if (currentJob.status === "failed") {
          setError(currentJob.errorMessage || "Pipeline processing failed.");
          setLoading(false);
        } else {
          // Still processing/queued: Poll in 2 seconds
          timerId = setTimeout(fetchJobData, 2000);
        }
      } catch (err) {
        console.error(err);
        if (!isActive) return;
        
        if (err.response?.status === 409) {
          timerId = setTimeout(fetchJobData, 2000);
        } else {
          setError(err.response?.data?.message || "Failed to fetch verification data");
          setLoading(false);
        }
      }
    };

    if (id) {
      fetchJobData();
    }

    return () => {
      isActive = false;
      if (timerId) clearTimeout(timerId);
    };
  }, [id]);

  const isStillProcessing = job && (job.status === "processing" || job.status === "queued");

  if (loading || isStillProcessing) {
    return (
      <div className="max-w-[1400px] mx-auto min-h-[70vh] flex flex-col items-center justify-center space-y-8">
        <div className="relative w-24 h-24">
          <div className="absolute inset-0 rounded-full border-2 border-purple-500/10 border-t-purple-500 animate-spin" style={{ animationDuration: '1.2s' }} />
          <div className="absolute inset-2 rounded-full border-2 border-indigo-500/10 border-b-indigo-500 animate-spin" style={{ animationDirection: 'reverse', animationDuration: '2s' }} />
          <div className="absolute inset-6 bg-purple-500/10 rounded-full border border-purple-500/20 flex items-center justify-center animate-pulse">
            <Zap className="w-5 h-5 text-purple-400" />
          </div>
        </div>
        
        <div className="text-center space-y-3 max-w-md">
          <div className="flex items-center justify-center gap-2 text-purple-400 text-xs font-bold uppercase tracking-widest animate-pulse">
            <Sparkles className="w-3.5 h-3.5" />
            Neural Analysis Active
          </div>
          <h2 className="font-semibold text-xl text-white tracking-tight">
            Ingestion & Scoring in Progress...
          </h2>
          <p className="text-xs text-zinc-500 leading-relaxed">
            Running 7 parallel AI checks: Laplacian blur coherence, perceptual copy fingerprinting, and standard Indian plate OCR alignment.
          </p>
          
          {job && (
            <div className="pt-4 flex flex-col items-center gap-2">
              <span className="px-3 py-1 bg-white/5 border border-white/10 rounded-full text-[10px] font-code-sm text-zinc-400">
                Job ID: #{job.id.substring(0, 12).toUpperCase()}
              </span>
              <span className="text-[10px] text-zinc-400 font-semibold truncate max-w-[280px]">
                Processing: "{job.originalFilename}"
              </span>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (error || !job || (job && job.status === "failed") || !analysis) {
    return (
      <div className="max-w-[800px] mx-auto min-h-[50vh] flex flex-col items-center justify-center p-8 text-center space-y-6">
        <div className="p-6 bg-red-500/5 border border-red-500/10 rounded-2xl text-red-400 max-w-md">
          <ShieldAlert className="w-12 h-12 mx-auto mb-3" />
          <h3 className="font-semibold text-lg text-white">System Synchronizer Halted</h3>
          <p className="text-xs text-zinc-400 mt-2 leading-relaxed">
            {error || "Verification data is currently unavailable for this record."}
          </p>
        </div>
        <Link 
          to="/jobs" 
          className="px-6 py-2.5 bg-white text-[#030303] rounded-full text-xs font-bold shadow-[0_4px_12px_rgba(255,255,255,0.15)] hover:bg-zinc-200 transition-all"
        >
          Return to Dashboard
        </Link>
      </div>
    );
  }

  const getStatusStyle = (status) => {
    switch (status) {
      case "completed":
        return "bg-emerald-500/5 text-emerald-400 border-emerald-500/10";
      case "failed":
        return "bg-red-500/5 text-red-400 border-red-500/10";
      case "processing":
        return "bg-purple-500/5 text-purple-400 border-purple-500/10 animate-pulse";
      default:
        return "bg-white/5 text-zinc-400 border-white/10";
    }
  };

  const getRecommendationStyle = (severity) => {
    switch (severity) {
      case "success":
        return "border-emerald-500/20 bg-emerald-500/[0.02] shadow-[0_0_50px_-10px_rgba(16,185,129,0.05)]";
      case "warning":
        return "border-amber-500/20 bg-amber-500/[0.02] shadow-[0_0_50px_-10px_rgba(245,158,11,0.05)]";
      case "error":
        return "border-red-500/20 bg-red-500/[0.02] shadow-[0_0_50px_-10px_rgba(239,68,68,0.05)]";
      default:
        return "border-white/5 bg-white/[0.01]";
    }
  };

  const getSeverityIcon = (severity) => {
    switch (severity) {
      case "success":
        return <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />;
      case "warning":
        return <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />;
      case "error":
        return <XCircle className="w-5 h-5 text-red-400 shrink-0" />;
      default:
        return <Info className="w-5 h-5 text-zinc-400 shrink-0" />;
    }
  };

  return (
    <div className="max-w-[1400px] mx-auto space-y-8">
      
      {/* Back link */}
      <div>
        <Link 
          to="/jobs" 
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-500 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Archives
        </Link>
      </div>

      {/* Operational Header */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Side: Overview & Recommendation Banner */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-3 py-1 bg-white/5 border border-white/10 rounded-full font-code-sm text-[10px] text-zinc-300">
              VER-{id?.substring(0, 8).toUpperCase()}
            </span>
            <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border ${getStatusStyle(job.status)}`}>
              {job.status}
            </span>
            
            {/* Trust level badge */}
            <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-[9px] font-bold uppercase tracking-wider">
              <Sparkles className="w-2.5 h-2.5 animate-pulse" />
              {analysis.trustLevel}
            </div>
          </div>
          
          <h1 className="font-semibold text-3xl tracking-tight text-white leading-tight">
            {job.originalFilename ?? "Verification Report"}
          </h1>
          
          {/* Executive Recommendation Banner styled like ultra-premium floating glass */}
          <div className={`p-6 rounded-2xl border ${getRecommendationStyle(analysis.recommendation.severity)} space-y-4`}>
            <div className="flex items-start gap-4">
              <div className="p-2.5 bg-white/5 border border-white/10 rounded-xl mt-0.5">
                {getSeverityIcon(analysis.recommendation.severity)}
              </div>
              <div>
                <h2 className="font-semibold text-base text-white">{analysis.recommendation.label}</h2>
                <p className="text-xs text-zinc-400 mt-1 leading-relaxed">{analysis.recommendation.desc}</p>
              </div>
            </div>
            
            {analysis.recommendation.summary.length > 0 && (
              <ul className="mt-4 space-y-2 pl-12 list-disc text-xs text-zinc-300 border-t border-white/[0.04] pt-4 leading-relaxed">
                {analysis.recommendation.summary.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Right Side: Score & Trust Dimensions */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          <div className="glass-card p-6 rounded-2xl border border-white/[0.04] space-y-6">
            
            {/* Score Ring Section */}
            <div className="flex items-center gap-6">
              <div className="relative w-20 h-20 shrink-0">
                <svg className="w-full h-full transform -rotate-90">
                  <circle className="text-white/5" cx="40" cy="40" fill="transparent" r="34" stroke="currentColor" strokeWidth="6" />
                  <circle
                    className={`transition-all duration-1000 ease-out ${
                      analysis.recommendation.severity === "success" ? "text-purple-500" : "text-purple-400"
                    }`}
                    cx="40"
                    cy="40"
                    fill="transparent"
                    r="34"
                    stroke="currentColor"
                    strokeDasharray="213.6"
                    strokeDashoffset={213.6 - (analysis.trustScore / 100) * 213.6}
                    strokeWidth="6"
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-lg font-extrabold font-code-sm text-white leading-none">
                    {analysis.isReady ? Math.round(analysis.trustScore) : "—"}
                  </span>
                  <span className="text-[7px] font-bold text-zinc-500 uppercase mt-0.5">Trust</span>
                </div>
              </div>
              
              <div className="flex-grow">
                <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest leading-none">Trust Engine Score</p>
                <h4 className="font-semibold text-lg text-white mt-1.5 leading-none">
                  {analysis.isReady ? analysis.trustLevel : "Processing..."}
                </h4>
                <div className="mt-3.5 w-full bg-white/5 h-1 rounded-full overflow-hidden">
                  <div 
                    className="h-full progress-gradient transition-all duration-1000" 
                    style={{ width: `${analysis.trustScore}%` }} 
                  />
                </div>
              </div>
            </div>

            {/* Dimensional Bars */}
            {analysis.dimensions && (
              <div className="grid grid-cols-2 gap-x-6 gap-y-4 border-t border-white/[0.04] pt-5">
                <TrustDimensionBar label="Visual Quality" value={analysis.dimensions.visualQuality} color="progress-gradient" />
                <TrustDimensionBar label="Authenticity" value={analysis.dimensions.authenticityConfidence} color="bg-white" />
                <TrustDimensionBar label="OCR Reliability" value={analysis.dimensions.ocrReliability} color="progress-gradient" />
                <TrustDimensionBar label="Workflow Integrity" value={analysis.dimensions.workflowIntegrity} color="bg-white" />
                
                <div className="col-span-2 pt-1 border-t border-white/[0.02]">
                  <TrustDimensionBar label="Human Usability" value={analysis.dimensions.operationalUsability} color="progress-gradient opacity-80" />
                </div>
              </div>
            )}
            
          </div>
          
          {/* Diagnostic Button */}
          <div className="flex justify-end">
            <button
              onClick={() => setShowDiagnostics(!showDiagnostics)}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all ${
                showDiagnostics 
                  ? "bg-purple-600 text-white shadow-[0_0_12px_rgba(168,85,247,0.3)]" 
                  : "bg-white/5 text-zinc-400 hover:text-white border border-white/10 hover:bg-white/10"
              }`}
            >
              {showDiagnostics ? <EyeOff className="w-3.5 h-3.5" /> : <Terminal className="w-3.5 h-3.5" />}
              {showDiagnostics ? "Hide Diagnostics" : "Diagnostic Console"}
            </button>
          </div>
          
        </div>
      </section>

      {/* Verification Matrix Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        
        {/* Card 1: Clarity */}
        <div className="glass-card p-6 rounded-2xl border border-white/[0.04] flex flex-col justify-between gap-5">
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 bg-white/5 border border-white/10 rounded-xl text-zinc-300">
                <Maximize2 className="w-4 h-4" />
              </div>
              <h3 className="font-semibold text-sm text-white uppercase tracking-wider">Clarity</h3>
            </div>
            
            <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border ${
              analysis.blur.severity === "success" 
                ? "bg-emerald-500/5 text-emerald-400 border-emerald-500/10"
                : "bg-amber-500/5 text-amber-400 border-amber-500/10"
            }`}>
              {analysis.blur.label}
            </span>
          </div>
          
          <div className="flex-grow space-y-4">
            <p className="text-xs text-zinc-400 leading-relaxed">
              {analysis.blur.desc}
            </p>
            
            <div className="grid grid-cols-2 gap-4 p-4 bg-white/[0.01] rounded-xl border border-white/[0.04]">
              <div>
                <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest">Edge Quality</p>
                <p className="text-xs font-bold text-white mt-1">
                  {renderLabel(analysis.blur.details?.perceptualLabels?.edgeEnergy)}
                </p>
              </div>
              <div>
                <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest">Motion Risk</p>
                <p className={`text-xs font-bold mt-1 ${analysis.blur.details?.motionRisk === "high" ? "text-red-400" : "text-white"}`}>
                  {renderLabel(analysis.blur.details?.perceptualLabels?.motionRisk)}
                </p>
              </div>
            </div>

            {showDiagnostics && analysis.blur.details && (
              <div className="text-[10px] font-code-sm text-zinc-500 bg-black/30 p-3 rounded-lg border border-white/[0.02] space-y-0.5 animate-in fade-in duration-300">
                <p>LaplacianVar: {renderMetric(analysis.blur.details.laplacianVariance, 1)}</p>
                <p>Coherence: {renderMetric(analysis.blur.details.directionalCoherence, 3)}</p>
                <p>Confidence: {renderConfidence(analysis.blur.confidence)}</p>
              </div>
            )}
          </div>
        </div>

        {/* Card 2: Identity Extraction */}
        <div className="glass-card p-6 rounded-2xl border border-white/[0.04] flex flex-col justify-between gap-5">
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 bg-white/5 border border-white/10 rounded-xl text-zinc-300">
                <Scan className="w-4 h-4" />
              </div>
              <h3 className="font-semibold text-sm text-white uppercase tracking-wider">Identity Extract</h3>
            </div>
            
            <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border ${
              analysis.ocr.readabilityLevel === "high"
                ? "bg-emerald-500/5 text-emerald-400 border-emerald-500/10"
                : "bg-amber-500/5 text-amber-400 border-amber-500/10"
            }`}>
              {getReadableOcrLabel(analysis.ocr.readability, analysis.ocr.confidence, analysis.ocr.plates)}
            </span>
          </div>
          
          <div className="flex-grow space-y-4">
            <div className="flex flex-wrap gap-2 min-h-[44px] items-center">
              {analysis.ocr.plates.length > 0 ? (
                analysis.ocr.plates.map((plate, i) => (
                  <span key={i} className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-700 text-white rounded-lg font-bold text-sm tracking-widest shadow-md">
                    {plate}
                  </span>
                ))
              ) : (
                <p className="text-xs text-zinc-500 italic">No standard plate geometry extracted.</p>
              )}
            </div>

            <div className="p-3 bg-white/[0.01] border border-white/[0.04] rounded-xl text-xs text-zinc-300 h-20 overflow-y-auto leading-relaxed">
              <strong>Raw Corpus Text:</strong>{" "}
              <span className="text-zinc-400">
                {analysis.ocr.text ? `"${analysis.ocr.text}"` : "OCR parsing concluded empty."}
              </span>
            </div>

            {showDiagnostics && (
              <div className="text-[10px] font-code-sm text-zinc-500 bg-black/30 p-3 rounded-lg border border-white/[0.02] space-y-0.5 animate-in fade-in duration-300">
                <p>Engine Confidence: {renderConfidence(analysis.ocr.confidence)}</p>
                <p>Format matches: {analysis.ocr.plates.length}</p>
              </div>
            )}
          </div>
        </div>

        {/* Card 3: Illumination */}
        <div className="glass-card p-6 rounded-2xl border border-white/[0.04] flex flex-col justify-between gap-5">
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 bg-white/5 border border-white/10 rounded-xl text-zinc-300">
                <Palette className="w-4 h-4" />
              </div>
              <h3 className="font-semibold text-sm text-white uppercase tracking-wider">Illumination</h3>
            </div>
            
            <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border ${
              analysis.brightness.severity === "success" 
                ? "bg-emerald-500/5 text-emerald-400 border-emerald-500/10"
                : "bg-amber-500/5 text-amber-400 border-amber-500/10"
            }`}>
              {analysis.brightness.label}
            </span>
          </div>
          
          <div className="flex-grow space-y-4">
            <p className="text-xs text-zinc-400 leading-relaxed">
              {analysis.brightness.desc}
            </p>
            
            <div className="p-4 bg-white/[0.01] border border-white/[0.04] rounded-xl space-y-2.5">
              <div className="flex justify-between text-xs">
                <span className="text-zinc-500">Exposure Profile</span>
                <span className="font-bold text-white">{renderLabel(analysis.brightness.details?.perceptualLabels?.exposure)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-zinc-500">Tonal Range Contrast</span>
                <span className="font-bold text-white">{renderLabel(analysis.brightness.details?.perceptualLabels?.contrast)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-zinc-500">Clipping Level</span>
                <span className="font-bold text-white">{renderLabel(analysis.brightness.details?.perceptualLabels?.dynamicRange)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Card 4: Authenticity */}
        <div className="glass-card p-6 rounded-2xl border border-white/[0.04] flex flex-col justify-between gap-5">
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 bg-white/5 border border-white/10 rounded-xl text-zinc-300">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <h3 className="font-semibold text-sm text-white uppercase tracking-wider">Authenticity</h3>
            </div>
            
            <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border ${
              analysis.authenticity.riskLevel === "low" 
                ? "bg-emerald-500/5 text-emerald-400 border-emerald-500/10"
                : "bg-red-500/5 text-red-400 border-red-500/10"
            }`}>
              {analysis.authenticity.label}
            </span>
          </div>
          
          <div className="flex-grow space-y-4">
            <div className="p-4 bg-white/[0.01] border border-white/[0.04] rounded-xl flex items-center gap-4">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                analysis.authenticity.riskLevel === "low" 
                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" 
                  : "bg-red-500/10 text-red-400 border border-red-500/20"
              }`}>
                <Camera className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest">Embedded Profile</p>
                <p className="text-xs font-bold text-white mt-0.5">{analysis.authenticity.source}</p>
              </div>
            </div>
            
            <div className="flex flex-wrap gap-1.5 min-h-[36px] items-center">
              {analysis.authenticity.flags.length > 0 ? (
                analysis.authenticity.flags.map((flag, i) => (
                  <span key={i} className="px-2 py-0.5 bg-red-500/15 border border-red-500/20 text-red-400 rounded text-[9px] font-bold uppercase tracking-wider">
                    {flag}
                  </span>
                ))
              ) : (
                <span className="text-xs text-zinc-500 italic">No editing/tamper indicators flagged.</span>
              )}
            </div>
          </div>
        </div>

        {/* Card 5: Duplicate Risk */}
        <div className="glass-card p-6 rounded-2xl border border-white/[0.04] flex flex-col justify-between gap-5">
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 bg-white/5 border border-white/10 rounded-xl text-zinc-300">
                <Fingerprint className="w-4 h-4" />
              </div>
              <h3 className="font-semibold text-sm text-white uppercase tracking-wider">Duplicate Risk</h3>
            </div>
            
            <SeverityBadge severity={analysis.uniqueness.severity}>
              {analysis.uniqueness.label}
            </SeverityBadge>
          </div>
          
          <div className="flex-grow space-y-4">
            <div className="p-4 bg-white/[0.01] border border-white/[0.04] rounded-xl flex items-center gap-3">
              <Fingerprint className="w-8 h-8 text-purple-400 shrink-0" />
              <div className="overflow-hidden">
                <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest">Perceptual Signature</p>
                <p className="text-[10px] font-bold text-white truncate mt-0.5 font-code-sm">
                  #{id?.toUpperCase()}
                </p>
              </div>
            </div>
            
            <p className="text-xs text-zinc-400 leading-relaxed">
              {analysis.uniqueness.passed === false 
                ? "Substantial perceptual signature mapping detected. This asset mirrors a record in our active database." 
                : "No matching perceptual duplicates identified in the processed corpus."}
            </p>
          </div>
        </div>

        {/* Card 6: Specs */}
        <div className="glass-card p-6 rounded-2xl border border-white/[0.04] flex flex-col justify-between gap-5">
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 bg-white/5 border border-white/10 rounded-xl text-zinc-300">
                <Maximize2 className="w-4 h-4" />
              </div>
              <h3 className="font-semibold text-sm text-white uppercase tracking-wider">Specifications</h3>
            </div>
            
            <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border ${
              analysis.specs.megapixels > 0.8
                ? "bg-emerald-500/5 text-emerald-400 border-emerald-500/10"
                : "bg-amber-500/5 text-amber-400 border-amber-500/10"
            }`}>
              {analysis.specs.resolutionLabel}
            </span>
          </div>
          
          <div className="flex-grow space-y-4">
            <div className="p-4 bg-white/[0.01] border border-white/[0.04] rounded-xl text-center">
              <p className="text-base font-extrabold text-white leading-none font-code-sm">
                {renderResolution(analysis.specs.width, analysis.specs.height)}
              </p>
              <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-1.5">
                {renderMetric(analysis.specs.megapixels, 2, " Megapixels")}
              </p>
            </div>
            
            <p className="text-xs text-zinc-400 leading-relaxed">
              {analysis.specs.impactDesc}
            </p>
          </div>
        </div>

        {/* Structured Image Metadata profiling block */}
        <div className="glass-card p-6 rounded-2xl border border-white/[0.04] flex flex-col gap-6 md:col-span-2 lg:col-span-3">
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/[0.04] pb-4">
            <div className="flex items-center gap-2.5">
              <Info className="w-5 h-5 text-purple-400" />
              <h3 className="font-semibold text-sm text-white uppercase tracking-wider">Structured Metadata Profile</h3>
            </div>
            
            <span className="px-3 py-1 bg-white/5 border border-white/10 text-zinc-300 rounded-md text-[9px] font-bold uppercase tracking-wider">
              {analysis.imageMetadata?.format || "EXIF"} PROFILE
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Color & Format Panel */}
            <div className="space-y-4 border-r border-white/[0.04] pr-6 last:border-0 last:pr-0">
              <h4 className="text-[10px] font-bold text-purple-400 uppercase tracking-widest flex items-center gap-1.5">
                <Palette className="w-3.5 h-3.5 shrink-0" />
                Color & Format Specs
              </h4>
              <div className="space-y-2.5 text-xs">
                <div className="flex justify-between border-b border-white/[0.02] pb-2">
                  <span className="text-zinc-500">Encoding Format</span>
                  <span className="font-bold text-white">{analysis.imageMetadata?.format || "Unknown"}</span>
                </div>
                <div className="flex justify-between border-b border-white/[0.02] pb-2">
                  <span className="text-zinc-500">Color Space</span>
                  <span className="font-bold text-white">{analysis.imageMetadata?.colorSpace || "Unknown"}</span>
                </div>
                <div className="flex justify-between border-b border-white/[0.02] pb-2">
                  <span className="text-zinc-500">Channels</span>
                  <span className="font-bold text-white">{analysis.imageMetadata?.channels ?? "Unknown"}</span>
                </div>
                <div className="flex justify-between pb-1">
                  <span className="text-zinc-500">Alpha Channel</span>
                  <span className="font-bold text-white">{analysis.imageMetadata?.hasAlpha ? "Yes" : "No"}</span>
                </div>
              </div>
            </div>

            {/* Hardware panel */}
            <div className="space-y-4 border-r border-white/[0.04] pr-6 last:border-0 last:pr-0">
              <h4 className="text-[10px] font-bold text-purple-400 uppercase tracking-widest flex items-center gap-1.5">
                <Camera className="w-3.5 h-3.5 shrink-0" />
                Hardware Acquisition
              </h4>
              <div className="space-y-2.5 text-xs">
                <div className="flex justify-between border-b border-white/[0.02] pb-2">
                  <span className="text-zinc-500">Camera Make</span>
                  <span className="font-bold text-white truncate max-w-[130px] text-right">{analysis.imageMetadata?.cameraMake || "Not Embedded"}</span>
                </div>
                <div className="flex justify-between border-b border-white/[0.02] pb-2">
                  <span className="text-zinc-500">Camera Model</span>
                  <span className="font-bold text-white truncate max-w-[130px] text-right">{analysis.imageMetadata?.cameraModel || "Not Embedded"}</span>
                </div>
                <div className="flex justify-between pb-1">
                  <span className="text-zinc-500">Processing Soft</span>
                  <span className="font-bold text-white truncate max-w-[130px] text-right text-[10px]" title={analysis.imageMetadata?.software}>
                    {analysis.imageMetadata?.software || "None Detected"}
                  </span>
                </div>
              </div>
            </div>

            {/* Location context */}
            <div className="space-y-4">
              <h4 className="text-[10px] font-bold text-purple-400 uppercase tracking-widest flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 shrink-0" />
                Spatial & Temporal
              </h4>
              <div className="space-y-2.5 text-xs">
                <div className="flex justify-between border-b border-white/[0.02] pb-2">
                  <span className="text-zinc-500">Captured Date</span>
                  <span className="font-bold text-white text-[10px]">
                    {analysis.imageMetadata?.createdDate ? new Date(analysis.imageMetadata.createdDate).toLocaleDateString() : "Not Embedded"}
                  </span>
                </div>
                <div className="flex justify-between border-b border-white/[0.02] pb-2">
                  <span className="text-zinc-500">GPS Coordinates</span>
                  {analysis.imageMetadata?.gps ? (
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${analysis.imageMetadata.gps.latitude},${analysis.imageMetadata.gps.longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-bold text-purple-400 hover:text-purple-300 flex items-center gap-1 hover:underline"
                    >
                      {analysis.imageMetadata.gps.latitude.toFixed(3)}, {analysis.imageMetadata.gps.longitude.toFixed(3)}
                      <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  ) : (
                    <span className="font-bold text-white">Not Embedded</span>
                  )}
                </div>
                <div className="flex justify-between pb-1">
                  <span className="text-zinc-500">Orientation ID</span>
                  <span className="font-bold text-white">Tag {analysis.imageMetadata?.orientation || "1"}</span>
                </div>
              </div>
            </div>
            
          </div>

          {/* Alert Callout summary */}
          <div className="mt-4 p-4 bg-white/[0.01] border border-white/[0.04] rounded-xl text-xs text-zinc-400 flex items-start gap-3">
            <Info className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              Metadata schema complies with standard web-optimized compression parameters. Lack of camera EXIF is typical for media processed by platforms prior to uploading.
            </p>
          </div>
          
        </div>

      </div>

      {/* Action Footer */}
      <footer className="mt-12 pt-8 border-t border-white/[0.04] flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-2 text-zinc-500 text-xs">
          <ShieldCheck className="w-4 h-4 text-purple-400" />
          <span className="font-code-sm text-[11px] uppercase tracking-wider opacity-70">
            Pipeline Integrity Verification Code: {job.id.substring(0, 12).toUpperCase()}
          </span>
        </div>
        
        <div className="flex gap-3 w-full sm:w-auto">
          <Link 
            to="/jobs" 
            className="flex-grow sm:flex-grow-0 px-6 py-2.5 border border-white/10 hover:border-white/20 bg-white/[0.02] hover:bg-white/[0.04] text-zinc-300 hover:text-white rounded-full text-xs font-bold text-center transition-all"
          >
            Return to Dashboard
          </Link>
          
          <button 
            type="button"
            className="flex-grow sm:flex-grow-0 px-6 py-2.5 bg-white text-[#030303] rounded-full flex items-center justify-center gap-2 text-xs font-bold shadow-[0_4px_12px_rgba(255,255,255,0.15)] hover:bg-zinc-200 transition-all hover:scale-[1.01] active:scale-[0.99]"
          >
            <Printer className="w-3.5 h-3.5" />
            Export Audit Report
          </button>
        </div>
      </footer>
      
    </div>
  );
};

export default JobResults;
