import { useEffect, useState } from "react";
import axios from "axios";
import { Link } from "react-router-dom";
import { 
  Sparkles, 
  UploadCloud, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Layers, 
  ArrowUpRight, 
  Zap,
  TrendingUp,
  Image
} from "lucide-react";

const Dashboard = () => {
  const [stats, setStats] = useState({ total: 0, completed: 0, failed: 0, processing: 0 });
  const [recentJobs, setRecentJobs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const [allRes, compRes, failRes, procRes, latestRes] = await Promise.all([
          axios.get("/api/v1/jobs?limit=1"),
          axios.get("/api/v1/jobs?status=completed&limit=1"),
          axios.get("/api/v1/jobs?status=failed&limit=1"),
          axios.get("/api/v1/jobs?status=processing&limit=1"),
          axios.get("/api/v1/jobs?limit=5")
        ]);
        setStats({
          total: allRes.data.total || 0,
          completed: compRes.data.total || 0,
          failed: failRes.data.total || 0,
          processing: procRes.data.total || 0
        });
        setRecentJobs(latestRes.data.jobs || []);
      } catch (error) {
        console.error("Failed to fetch dashboard data", error);
      } finally {
        setLoading(false);
      }
    };
    fetchDashboardData();
  }, []);

  return (
    <div className="max-w-[1400px] mx-auto grid grid-cols-12 gap-6">
      
      {/* Title & Headline Section */}
      <div className="col-span-12 mb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-purple-400 text-xs font-bold uppercase tracking-widest mb-1.5">
            <Sparkles className="w-3.5 h-3.5 text-purple-400 animate-pulse" />
            Active Surveillance
          </div>
          <h3 className="font-semibold text-3xl tracking-tight text-white flex items-center gap-2">
            System Overview
          </h3>
          <p className="text-sm text-zinc-400 mt-1">
            Monitor real-time image validation throughput and trust-scoring performance.
          </p>
        </div>
        
        {/* Dynamic overall stats badge */}
        <div className="flex items-center gap-2 px-3 py-1 bg-white/[0.03] border border-white/5 rounded-full text-xs text-zinc-400">
          <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
          <span>Analytics Latency: <strong>Optimal</strong></span>
        </div>
      </div>
      
      {/* Stats Bento Grid with Custom Shadows/Glows matching UI template */}
      
      {/* Card 1: Total Uploads */}
      <div className="col-span-12 sm:col-span-6 lg:col-span-3">
        <div className="glass-card p-6 rounded-2xl flex flex-col justify-between h-full relative overflow-hidden group glow-purple">
          <div className="absolute right-0 top-0 w-24 h-24 bg-purple-500/5 rounded-full blur-2xl group-hover:bg-purple-500/10 transition-colors" />
          
          <div>
            <div className="flex justify-between items-start mb-6">
              <div className="p-3 bg-white/5 border border-white/10 rounded-xl">
                <UploadCloud className="w-5 h-5 text-zinc-200" />
              </div>
              <span className="text-emerald-400 text-[10px] font-bold bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full flex items-center gap-1">
                +12% <ArrowUpRight className="w-2.5 h-2.5" />
              </span>
            </div>
            
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Total Uploads</p>
            <p className="text-4xl font-extrabold text-white tracking-tight mt-2 font-headline-lg">
              {stats.total}
            </p>
          </div>
        </div>
      </div>
      
      {/* Card 2: Completed / Validated */}
      <div className="col-span-12 sm:col-span-6 lg:col-span-3">
        <div className="glass-card p-6 rounded-2xl flex flex-col justify-between h-full relative overflow-hidden group glow-green">
          <div className="absolute right-0 top-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl group-hover:bg-emerald-500/10 transition-colors" />
          
          <div>
            <div className="flex justify-between items-start mb-6">
              <div className="p-3 bg-emerald-500/5 border border-emerald-500/10 rounded-xl">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              </div>
              <span className="text-zinc-400 text-[10px] font-bold bg-white/5 px-2 py-0.5 rounded-full">
                {stats.total > 0 ? (stats.completed / stats.total * 100).toFixed(0) : 0}% rate
              </span>
            </div>
            
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Completed</p>
            <p className="text-4xl font-extrabold text-white tracking-tight mt-2 font-headline-lg">
              {stats.completed}
            </p>
          </div>
        </div>
      </div>
      
      {/* Card 3: Failed / Flagged */}
      <div className="col-span-12 sm:col-span-6 lg:col-span-3">
        <div className="glass-card p-6 rounded-2xl flex flex-col justify-between h-full relative overflow-hidden group border-red-500/10">
          <div className="absolute right-0 top-0 w-24 h-24 bg-red-500/5 rounded-full blur-2xl" />
          
          <div>
            <div className="flex justify-between items-start mb-6">
              <div className="p-3 bg-red-500/5 border border-red-500/10 rounded-xl">
                <XCircle className="w-5 h-5 text-red-400" />
              </div>
              <span className="text-red-400 text-[10px] font-bold bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded-full">
                Attention Required
              </span>
            </div>
            
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Failed & Flagged</p>
            <p className="text-4xl font-extrabold text-white tracking-tight mt-2 font-headline-lg">
              {stats.failed}
            </p>
          </div>
        </div>
      </div>
      
      {/* Card 4: Processing Queue */}
      <div className="col-span-12 sm:col-span-6 lg:col-span-3">
        <div className="glass-card p-6 rounded-2xl flex flex-col h-full justify-between relative overflow-hidden group">
          <div className="absolute right-0 top-0 w-24 h-24 bg-purple-500/5 rounded-full blur-2xl" />
          
          <div>
            <div className="flex justify-between items-start mb-6">
              <div className="p-3 bg-purple-500/5 border border-purple-500/10 rounded-xl">
                <Clock className="w-5 h-5 text-purple-400 animate-spin" style={{ animationDuration: '4s' }} />
              </div>
            </div>
            
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Active Processing</p>
            <p className="text-4xl font-extrabold text-white tracking-tight mt-2 font-headline-lg">
              {stats.processing}
            </p>
            
            {/* Custom glowing progress bar */}
            <div className="mt-4 w-full bg-white/5 h-1.5 rounded-full overflow-hidden">
              <div className="progress-gradient h-full w-[65%]" />
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity Table Container */}
      <div className="col-span-12 lg:col-span-8">
        <div className="glass-card rounded-2xl overflow-hidden h-full flex flex-col justify-between border border-white/[0.04]">
          <div>
            <div className="px-6 py-5 border-b border-white/[0.04] flex justify-between items-center bg-white/[0.01]">
              <div>
                <h4 className="font-semibold text-lg text-white">Recent Pipeline Activity</h4>
                <p className="text-xs text-zinc-500 mt-0.5">Real-time status updates of visual asset scoring reports.</p>
              </div>
              <Link to="/jobs" className="text-purple-400 text-xs font-semibold hover:text-purple-300 transition-colors flex items-center gap-1">
                View All Jobs <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse dark-table">
                <thead>
                  <tr className="bg-white/[0.02] text-zinc-400 border-b border-white/[0.04] text-[10px] uppercase font-bold tracking-wider">
                    <th className="px-6 py-4">Name & Specs</th>
                    <th className="px-6 py-4">Pipeline Status</th>
                    <th className="px-6 py-4">Scoring Progress</th>
                    <th className="px-6 py-4">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.02]">
                  {recentJobs.map((job) => (
                    <tr key={job.id} className="hover:bg-white/[0.02] transition-all">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2.5 bg-white/5 border border-white/10 rounded-xl">
                            <Image className="w-4 h-4 text-zinc-300" />
                          </div>
                          <div className="max-w-[200px] sm:max-w-[300px]">
                            <p className="text-sm font-semibold text-white truncate">{job.originalFilename}</p>
                            <p className="text-[10px] text-zinc-500 font-medium mt-0.5">
                              {job.mimeType} • {(job.fileSizeBytes / 1024 / 1024).toFixed(1)} MB
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                          job.status === "completed" 
                            ? "bg-emerald-500/5 text-emerald-400 border-emerald-500/10" 
                            : job.status === "failed" 
                              ? "bg-red-500/5 text-red-400 border-red-500/10" 
                              : "bg-purple-500/5 text-purple-400 border-purple-500/10 animate-pulse"
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            job.status === "completed" ? "bg-emerald-400" : job.status === "failed" ? "bg-red-400" : "bg-purple-400 animate-ping"
                          }`} />
                          {job.status}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {job.status === "processing" ? (
                          <div className="w-24 bg-white/5 h-1.5 rounded-full overflow-hidden">
                            <div className="progress-gradient h-full w-[45%]" />
                          </div>
                        ) : (
                          <span className="text-[11px] font-bold text-zinc-300">
                            {job.status === "completed" ? "100%" : "0%"}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <Link 
                          to={`/jobs/${job.id}`} 
                          className="p-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-zinc-400 hover:text-white transition-all inline-flex"
                        >
                          <ArrowUpRight className="w-4 h-4" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                  {recentJobs.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-6 py-12 text-center text-sm text-zinc-500 italic">
                        No pipeline activity registered yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
          
          <div className="px-6 py-4 border-t border-white/[0.04] bg-white/[0.005] flex justify-between items-center text-[10px] font-semibold tracking-wider uppercase text-zinc-500">
            <span>Operational Realtime Monitoring</span>
            <span>Total Logged Records: {stats.total}</span>
          </div>
        </div>
      </div>

      {/* Sidebar Section */}
      <div className="col-span-12 lg:col-span-4 flex flex-col gap-6">
        
        {/* Quick Upload CTA - styled premium like the Google Search Console Connect block */}
        <div className="relative bg-gradient-to-br from-[#0F0A1A] to-[#04020A] border border-purple-500/10 rounded-2xl p-6 shadow-[0_4px_30px_rgba(0,0,0,0.4)] overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 rounded-full blur-[64px]" />
          
          <div className="relative z-10 flex flex-col gap-4">
            <div className="flex justify-between items-start">
              <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-xl shadow-[0_0_15px_rgba(168,85,247,0.15)]">
                <Zap className="w-5 h-5 text-purple-400" />
              </div>
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-purple-500/10 border border-purple-500/20 rounded-full text-[10px] font-bold uppercase tracking-wider text-purple-300">
                <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-ping" />
                Live Ingest
              </div>
            </div>
            
            <div>
              <h5 className="font-semibold text-lg text-white">Quick Processing</h5>
              <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                Immediately trigger high-fidelity validation checks including Laplacian blur detection, OCR, and tampering analysis.
              </p>
            </div>
            
            <Link 
              to="/upload" 
              className="w-full mt-2 py-3 bg-white text-[#030303] font-bold text-xs rounded-xl flex items-center justify-center gap-2 hover:bg-zinc-200 shadow-[0_4px_12px_rgba(255,255,255,0.15)] hover:scale-[1.01] active:scale-[0.99] transition-all"
            >
              Start Upload
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
        
        {/* Live Activity Feed */}
        <div className="glass-card rounded-2xl flex flex-col border border-white/[0.04]">
          <div className="px-6 py-4 border-b border-white/[0.04] flex justify-between items-center bg-white/[0.01]">
            <h4 className="font-semibold text-sm text-white">Live Activity</h4>
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.7)] animate-pulse" />
          </div>
          
          <div className="p-6 space-y-6 overflow-y-auto max-h-[350px] scrollbar-thin">
            {recentJobs.map((job, idx) => (
              <div key={job.id} className="flex gap-4 relative">
                {idx < recentJobs.length - 1 && (
                  <div className="absolute left-3 top-8 bottom-0 w-[1px] bg-white/[0.06]" />
                )}
                
                <div className={`relative z-10 w-6 h-6 rounded-full flex items-center justify-center border border-white/10 ${
                  job.status === "completed" 
                    ? "bg-emerald-500/10 text-emerald-400" 
                    : job.status === "failed" 
                      ? "bg-red-500/10 text-red-400" 
                      : "bg-purple-500/10 text-purple-400 animate-pulse"
                }`}>
                  {job.status === "completed" && <CheckCircle2 className="w-3.5 h-3.5" />}
                  {job.status === "failed" && <XCircle className="w-3.5 h-3.5" />}
                  {job.status === "processing" && <Clock className="w-3.5 h-3.5 animate-spin" style={{ animationDuration: '3s' }} />}
                </div>
                
                <div className="pb-4 flex-1">
                  <p className="text-xs font-semibold text-white leading-relaxed truncate max-w-[220px]" title={job.originalFilename}>
                    {job.originalFilename}
                  </p>
                  <p className="text-[10px] text-zinc-400 mt-0.5">
                    {job.status === "completed" 
                      ? "Ingestion and trust indexing successful." 
                      : job.status === "failed" 
                        ? "Pipeline execution terminated with errors." 
                        : "Compiling computer vision assessment..."}
                  </p>
                  <p className="text-[9px] text-zinc-500 font-medium font-code-sm mt-1.5 flex items-center gap-1.5">
                    {new Date(job.createdAt).toLocaleTimeString()} • ID: #{job.id.substring(0, 8).toUpperCase()}
                  </p>
                </div>
              </div>
            ))}
            {recentJobs.length === 0 && (
              <p className="text-center text-xs text-zinc-500 py-6 italic">
                Waiting for pipeline executions...
              </p>
            )}
          </div>
        </div>
        
      </div>
    </div>
  );
};

export default Dashboard;
