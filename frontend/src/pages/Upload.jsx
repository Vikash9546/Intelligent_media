import { useState, useRef } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
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
            const percentCompleted = Math.round(progressEvent.loaded * 100 / progressEvent.total);
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
  return <div className="max-w-6xl mx-auto">
      {
    /* Header Section */
  }
      <div className="mb-xl">
        <h2 className="font-headline-xl text-headline-xl text-primary">Ingest Assets</h2>
        <p className="font-body-lg text-body-lg text-on-surface-variant mt-sm">Upload high-resolution media for automated pipeline processing and analysis.</p>
      </div>

      {
    /* Upload Bento Grid */
  }
      <div className="grid grid-cols-12 gap-gutter">
        
        {
    /* Main Upload Area */
  }
        <div className="col-span-12 lg:col-span-8">
          <div className="glass-card rounded-xl p-xl h-full flex flex-col">
            <div
    className="dashed-border rounded-xl flex-grow flex flex-col items-center justify-center p-2xl text-center border-2 border-transparent hover:border-secondary/20 transition-all cursor-pointer group min-h-[300px]"
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
              <div className="w-20 h-20 rounded-full bg-secondary-fixed flex items-center justify-center mb-lg group-hover:scale-110 transition-transform">
                <span className="material-symbols-outlined text-secondary text-4xl" data-icon="cloud_upload">cloud_upload</span>
              </div>
              <h3 className="font-headline-md text-headline-md text-primary mb-xs">Drag and drop your media files</h3>
              <p className="font-body-md text-body-md text-outline mb-xl">Supports JPG, PNG, WEBP up to 10MB per file</p>
              
              <button className="px-xl py-md bg-secondary text-on-secondary rounded-lg font-bold shadow-md hover:shadow-lg transition-all active:scale-[0.98]">
                Browse Local Storage
              </button>
            </div>
          </div>
        </div>

        {
    /* Pipeline Status Card */
  }
        <div className="col-span-12 lg:col-span-4 space-y-gutter">
          <div className="glass-card rounded-xl p-lg">
            <div className="flex items-center justify-between mb-md">
              <span className="font-label-md text-label-md uppercase tracking-widest text-outline">Pipeline Load</span>
              <span className="px-sm py-xs bg-emerald-100 text-emerald-700 font-bold rounded-sm text-[10px]">OPTIMAL</span>
            </div>
            <div className="flex items-end gap-base">
              <span className="font-headline-xl text-headline-xl text-primary">14ms</span>
              <span className="font-body-md text-body-md text-outline mb-1.5">Latency</span>
            </div>
            <div className="mt-md w-full bg-surface-container h-1.5 rounded-full overflow-hidden">
              <div className="w-1/4 h-full bg-emerald-500" />
            </div>
          </div>

          <div className="glass-card rounded-xl p-lg">
            <h4 className="font-label-md text-label-md font-bold mb-md">ACTIVE ANALYZERS</h4>
            <div className="space-y-sm">
              <div className="flex items-center justify-between">
                <span className="font-body-md text-body-md">Blur Detection (Laplacian)</span>
                <span className="material-symbols-outlined text-emerald-500 text-sm" data-icon="check_circle">check_circle</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-body-md text-body-md">OCR Plate Extraction</span>
                <span className="material-symbols-outlined text-emerald-500 text-sm" data-icon="check_circle">check_circle</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-body-md text-body-md">Perceptual Hashing</span>
                <span className="material-symbols-outlined text-emerald-500 text-sm" data-icon="check_circle">check_circle</span>
              </div>
            </div>
          </div>
        </div>

        {
    /* File Preview & Progress */
  }
        {file && <div className="col-span-12">
            <div className="glass-card rounded-xl overflow-hidden">
              <div className="p-lg border-b border-outline-variant bg-surface-container-low flex items-center justify-between">
                <div className="flex items-center gap-md">
                  <span className="font-label-md text-label-md font-bold text-primary">UPLOAD QUEUE (1)</span>
                  <span className="px-sm py-xs bg-secondary-fixed text-on-secondary-fixed-variant rounded-full text-[10px] font-bold">
                    {isUploading ? "UPLOADING" : "STAGED"}
                  </span>
                </div>
                {!isUploading && <button className="text-outline hover:text-error transition-colors" onClick={cancelUpload}>
                    <span className="material-symbols-outlined" data-icon="delete_sweep">delete_sweep</span>
                  </button>}
              </div>
              
              <div className="p-lg">
                {error && <div className="mb-4 p-md bg-error-container text-on-error-container rounded-lg font-body-md">
                    {error}
                  </div>}
                
                <div className="flex flex-col md:flex-row items-start md:items-center gap-lg">
                  {
    /* File Icon/Thumbnail */
  }
                  <div className="w-16 h-16 bg-surface-container-highest rounded-lg flex items-center justify-center relative overflow-hidden border border-outline-variant">
                    <span className="material-symbols-outlined text-outline text-3xl" data-icon="image">image</span>
                    <div className="absolute bottom-0 right-0 px-1 bg-primary text-white text-[8px] font-bold">
                      {file.name.split(".").pop()?.toUpperCase() || "IMG"}
                    </div>
                  </div>
                  
                  {
    /* Metadata */
  }
                  <div className="flex-grow min-w-0">
                    <div className="flex justify-between items-start mb-base">
                      <div>
                        <h5 className="font-body-md text-body-md font-bold truncate">{file.name}</h5>
                        <p className="font-label-md text-label-md text-outline">
                          {(file.size / (1024 * 1024)).toFixed(2)} MB • {file.type}
                        </p>
                      </div>
                      {isUploading && <span className="font-code-sm text-code-sm text-secondary font-bold">{uploadProgress}%</span>}
                    </div>
                    
                    {
    /* Progress Bar */
  }
                    {isUploading && <div className="w-full bg-surface-container h-2 rounded-full overflow-hidden mb-sm relative">
                        <div
    className="progress-gradient h-full rounded-full shadow-[0_0_8px_rgba(139,92,246,0.5)] transition-all duration-300"
    style={{ width: `${uploadProgress}%` }}
  />
                      </div>}
                  </div>

                  {
    /* Action */
  }
                  {!isUploading && <div className="flex gap-sm">
                      <button
    onClick={cancelUpload}
    className="w-10 h-10 border border-outline-variant rounded-lg flex items-center justify-center hover:bg-error-container hover:text-on-error-container transition-colors"
  >
                        <span className="material-symbols-outlined" data-icon="close">close</span>
                      </button>
                    </div>}
                </div>
              </div>

              {
    /* Footer Action */
  }
              {!isUploading && <div className="p-lg bg-surface-container-lowest border-t border-outline-variant flex justify-end gap-md">
                  <button onClick={cancelUpload} className="px-lg py-sm text-on-surface-variant font-bold hover:bg-surface-container transition-colors rounded-lg">
                    Cancel
                  </button>
                  <button
    onClick={handleUpload}
    className="px-xl py-sm bg-[#4648d4] text-white font-bold rounded-lg shadow-lg hover:brightness-110 active:scale-[0.98] transition-all flex items-center gap-sm"
  >
                    <span className="material-symbols-outlined text-sm" data-icon="bolt">bolt</span>
                    Initiate Processing
                  </button>
                </div>}
            </div>
          </div>}

      </div>
    </div>;
};
var Upload_default = Upload;
export {
  Upload_default as default
};
