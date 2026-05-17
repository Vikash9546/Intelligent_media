import { useState, useRef } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { 
  UploadCloud, 
  Cpu, 
  Zap, 
  ShieldCheck, 
  Trash2, 
  CheckCircle2, 
  AlertCircle, 
  Sparkles,
  ArrowUpRight,
  FileImage,
  Loader2
} from "lucide-react";

const Upload = () => {
  const [file, setFile] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);
  const navigate = useNavigate();

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setFile(e.dataTransfer.files[0]);
      setError(null);
    }
  };

  const handleFileSelect = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
      setError(null);
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setIsUploading(true);
    setUploadProgress(0);
    setError(null);

    const formData = new FormData();
    formData.append("image", file);

    try {
      const response = await axios.post("/api/v1/upload", formData, {
        headers: {
          "Content-Type": "multipart/form-data"
        },
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const percentCompleted = Math.round(
              (progressEvent.loaded * 100) / progressEvent.total
            );
            setUploadProgress(percentCompleted);
          }
        }
      });

      if (response.data?.jobId) {
        setTimeout(() => {
          navigate(`/jobs/${response.data.jobId}`);
        }, 1500);
      }
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || "Upload failed. Please try again.");
      setIsUploading(false);
    }
  };

  const cancelUpload = () => {
    setFile(null);
    setUploadProgress(0);
    setError(null);
    setIsUploading(false);
  };

  return (
    <div className="max-w-[1200px] mx-auto space-y-8">
      
      {/* Page Header */}
      <div>
        <div className="flex items-center gap-2 text-purple-400 text-xs font-bold uppercase tracking-widest mb-1.5 animate-pulse">
          <Sparkles className="w-3.5 h-3.5" />
          Asset Intake
        </div>
        <h2 className="font-semibold text-3xl tracking-tight text-white">
          Ingest Assets
        </h2>
        <p className="text-sm text-zinc-400 mt-1 max-w-2xl leading-relaxed">
          Upload high-resolution vehicle media files for multi-dimensional neural trust scoring and metadata validation.
        </p>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-12 gap-6">
        
        {/* Dropzone Container */}
        <div className="col-span-12 lg:col-span-8">
          <div className="glass-card rounded-2xl p-6 h-full flex flex-col justify-between border border-white/[0.04]">
            
            <div
              className="dashed-border rounded-xl flex-grow flex flex-col items-center justify-center p-8 text-center border-2 border-transparent transition-all cursor-pointer group min-h-[350px] relative overflow-hidden"
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelect}
                className="hidden"
                accept="image/jpeg, image/png, image/webp"
              />
              
              {/* Backlight effect inside dropzone */}
              <div className="absolute inset-0 opacity-[0.02] bg-[radial-gradient(circle_at_center,rgba(168,85,247,0.4),transparent)] transition-all group-hover:opacity-[0.06] pointer-events-none" />

              <div className="w-16 h-16 rounded-full bg-white/[0.02] border border-white/10 flex items-center justify-center mb-6 group-hover:scale-105 group-hover:border-purple-500/30 group-hover:bg-purple-500/5 transition-all duration-300">
                <UploadCloud className="w-8 h-8 text-zinc-400 group-hover:text-purple-400 transition-colors" />
              </div>

              <h3 className="font-semibold text-lg text-white mb-1.5">
                Drag and drop your media file here
              </h3>
              <p className="text-xs text-zinc-500 max-w-xs leading-relaxed mb-6">
                Supports High-Resolution JPEG, PNG, and WEBP formats up to 10MB per file.
              </p>
              
              <button 
                type="button"
                className="px-6 py-2.5 bg-white text-[#030303] rounded-full text-xs font-bold shadow-[0_4px_12px_rgba(255,255,255,0.15)] hover:bg-zinc-200 transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                Browse File System
              </button>
            </div>
            
          </div>
        </div>

        {/* Status / Analyzer Panel */}
        <div className="col-span-12 lg:col-span-4 space-y-6">
          
          {/* Latency & Load Panel */}
          <div className="glass-card rounded-2xl p-6 border border-white/[0.04]">
            <div className="flex items-center justify-between mb-4">
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Pipeline Workload</span>
              <span className="px-2.5 py-0.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-bold rounded-full text-[9px] uppercase tracking-wider">
                Optimal
              </span>
            </div>
            
            <div className="flex items-end gap-1">
              <span className="text-3xl font-extrabold text-white leading-none font-headline-lg">14ms</span>
              <span className="text-xs text-zinc-500 mb-0.5">Average Ingest Latency</span>
            </div>
            
            <div className="mt-4 w-full bg-white/5 h-1 rounded-full overflow-hidden">
              <div className="w-[15%] h-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]" />
            </div>
          </div>

          {/* Active Analyzers Panel */}
          <div className="glass-card rounded-2xl p-6 border border-white/[0.04]">
            <div className="flex items-center gap-2 border-b border-white/[0.04] pb-3 mb-4">
              <Cpu className="w-4 h-4 text-purple-400" />
              <h4 className="font-semibold text-xs text-white uppercase tracking-wider">Active Trust Modules</h4>
            </div>
            
            <div className="space-y-3.5">
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-400">Blur Detection (Laplacian Coherence)</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-400">Neural OCR (Indian Plate Parser)</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-400">Perceptual Duplicate Hash matching</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-400">Metadata Authenticity Validator</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              </div>
            </div>
          </div>
          
        </div>

        {/* Upload Queue / Interactive Progress Container */}
        {file && (
          <div className="col-span-12 animate-in fade-in duration-300">
            <div className="glass-card rounded-2xl overflow-hidden border border-white/[0.04]">
              
              <div className="px-6 py-4 border-b border-white/[0.04] bg-white/[0.01] flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Ingestion Queue (1)</span>
                  <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                    isUploading 
                      ? "bg-purple-500/10 text-purple-400 border border-purple-500/20" 
                      : "bg-zinc-500/10 text-zinc-400 border border-zinc-500/20"
                  }`}>
                    {isUploading ? "Uploading" : "Staged"}
                  </span>
                </div>
                
                {!isUploading && (
                  <button 
                    onClick={cancelUpload}
                    className="text-zinc-500 hover:text-red-400 transition-colors p-1"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
              
              <div className="p-6">
                {error && (
                  <div className="mb-4 p-4 bg-red-500/5 border border-red-500/10 text-red-400 rounded-xl text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}
                
                <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
                  {/* File icon / preview */}
                  <div className="w-16 h-16 bg-white/5 border border-white/10 rounded-xl flex items-center justify-center relative overflow-hidden">
                    <FileImage className="w-7 h-7 text-zinc-400" />
                    <div className="absolute bottom-0 inset-x-0 bg-zinc-950/80 text-center text-[8px] font-bold text-zinc-400 uppercase tracking-wider py-0.5">
                      {file.name.split(".").pop()?.toUpperCase() || "IMG"}
                    </div>
                  </div>
                  
                  {/* Progress detail */}
                  <div className="flex-1 w-full min-w-0">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h5 className="text-sm font-semibold text-white truncate max-w-[300px] sm:max-w-[500px]">
                          {file.name}
                        </h5>
                        <p className="text-[10px] text-zinc-500 mt-0.5">
                          {(file.size / (1024 * 1024)).toFixed(2)} MB • {file.type}
                        </p>
                      </div>
                      
                      {isUploading && (
                        <span className="text-xs font-bold text-purple-400 flex items-center gap-1.5">
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          {uploadProgress}%
                        </span>
                      )}
                    </div>
                    
                    {/* Glowing progress line */}
                    {isUploading && (
                      <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden relative">
                        <div
                          className="progress-gradient h-full rounded-full transition-all duration-300"
                          style={{ width: `${uploadProgress}%` }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              {!isUploading && (
                <div className="px-6 py-4 bg-white/[0.005] border-t border-white/[0.04] flex justify-end gap-3">
                  <button 
                    onClick={cancelUpload} 
                    className="px-5 py-2 text-xs font-bold text-zinc-400 hover:text-white transition-colors rounded-full"
                  >
                    Cancel
                  </button>
                  
                  <button
                    onClick={handleUpload}
                    className="px-6 py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-full shadow-[0_0_15px_rgba(168,85,247,0.4)] transition-all flex items-center gap-1.5 hover:scale-[1.01] active:scale-[0.99]"
                  >
                    <Zap className="w-3.5 h-3.5" />
                    Initiate Processing
                  </button>
                </div>
              )}
              
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default Upload;
