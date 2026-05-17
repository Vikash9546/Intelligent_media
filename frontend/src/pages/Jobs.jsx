import { useEffect, useState } from "react";
import axios from "axios";
import { Link } from "react-router-dom";
import { 
  Search, 
  Filter, 
  Download, 
  RefreshCw, 
  ChevronLeft, 
  ChevronRight, 
  ArrowUpRight, 
  Sparkles,
  Layers,
  CheckCircle2,
  XCircle,
  Clock,
  ShieldAlert,
  Image,
  Video
} from "lucide-react";

const Jobs = () => {
  const [jobs, setJobs] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const limit = 10;

  const fetchJobs = async () => {
    try {
      setIsRefreshing(true);
      const offset = (page - 1) * limit;
      let url = `/api/v1/jobs?limit=${limit}&offset=${offset}`;
      
      if (statusFilter && statusFilter !== "All") {
        url += `&status=${statusFilter.toLowerCase()}`;
      }
      
      const response = await axios.get(url);
      setJobs(response.data.jobs || []);
      setTotal(response.data.total || 0);
    } catch (error) {
      console.error("Failed to fetch jobs", error);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchJobs();
  }, [page, statusFilter]);

  const totalPages = Math.ceil(total / limit) || 1;

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

  return (
    <div className="max-w-[1400px] mx-auto space-y-8">
      
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 text-purple-400 text-xs font-bold uppercase tracking-widest mb-1.5">
            <Sparkles className="w-3.5 h-3.5 text-purple-400 animate-pulse" />
            Ingest Archives
          </div>
          <h3 className="font-semibold text-3xl tracking-tight text-white">
            Recent Jobs
          </h3>
          <p className="text-sm text-zinc-400 mt-1">
            Monitor, inspect, and manage historical asset analysis pipeline workloads.
          </p>
        </div>
        
        {/* Top-Right CTA Actions */}
        <div className="flex gap-3">
          <button 
            type="button"
            className="px-4 py-2 border border-white/10 hover:border-white/20 bg-white/[0.02] hover:bg-white/[0.04] rounded-full flex items-center gap-2 text-xs font-bold text-zinc-300 hover:text-white transition-all"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>
          
          <button 
            onClick={fetchJobs} 
            disabled={isRefreshing}
            className="px-5 py-2 bg-white text-[#030303] rounded-full flex items-center gap-2 text-xs font-bold shadow-[0_4px_12px_rgba(255,255,255,0.15)] hover:bg-zinc-200 disabled:opacity-50 transition-all hover:scale-[1.01] active:scale-[0.99]"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            {isRefreshing ? 'Refreshing...' : 'Refresh List'}
          </button>
        </div>
      </div>

      {/* Modern Sleek Filter / Search Controls */}
      <div className="glass-card rounded-2xl p-4 flex flex-col md:flex-row items-center gap-4 border border-white/[0.04] bg-white/[0.01]">
        
        {/* Left: Dropdown Filter */}
        <div className="flex items-center gap-3 w-full md:w-auto md:border-r border-white/[0.06] pr-6">
          <Filter className="w-4 h-4 text-zinc-500" />
          <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest shrink-0">Filter Status</span>
          
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="bg-white/5 border border-white/10 rounded-full px-4 py-1.5 text-xs text-white outline-none focus:border-purple-500/50 hover:bg-white/[0.08] transition-all cursor-pointer w-full md:w-44"
          >
            <option value="" className="bg-[#0f0f10]">All Workloads</option>
            <option value="processing" className="bg-[#0f0f10]">Processing</option>
            <option value="completed" className="bg-[#0f0f10]">Completed</option>
            <option value="failed" className="bg-[#0f0f10]">Failed</option>
          </select>
        </div>
        
        {/* Right: Search Box */}
        <div className="w-full md:w-auto md:ml-auto flex items-center gap-3">
          <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest shrink-0 hidden md:inline">Search Corpus</span>
          <div className="relative w-full md:w-64">
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-full pl-4 pr-10 py-1.5 text-xs text-white outline-none focus:border-purple-500/50 hover:bg-white/[0.08] transition-all"
              placeholder="Job ID or filename..."
              type="text"
            />
            <Search className="w-4 h-4 text-zinc-500 absolute right-3.5 top-1/2 -translate-y-1/2" />
          </div>
        </div>
        
      </div>

      {/* Main Glass Data Grid */}
      <div className="glass-card rounded-2xl overflow-hidden border border-white/[0.04] shadow-2xl">
        <table className="w-full text-left border-collapse dark-table">
          <thead>
            <tr className="bg-white/[0.02] border-b border-white/[0.04] text-[10px] uppercase font-bold tracking-wider text-zinc-400">
              <th className="px-6 py-4">Job ID</th>
              <th className="px-6 py-4">Filename</th>
              <th className="px-6 py-4 text-center">Pipeline Status</th>
              <th className="px-6 py-4 text-center">Megapixel Rating</th>
              <th className="px-6 py-4">Created Time</th>
              <th className="px-6 py-4" />
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.02]">
            {jobs
              .filter(job => 
                job.id.toLowerCase().includes(searchQuery.toLowerCase()) || 
                job.originalFilename.toLowerCase().includes(searchQuery.toLowerCase())
              )
              .map((job) => (
                <tr key={job.id} className="hover:bg-white/[0.02] transition-all">
                  
                  {/* Job ID */}
                  <td className="px-6 py-4 font-code-sm text-xs font-semibold text-purple-400">
                    <Link to={`/jobs/${job.id}`} className="hover:underline">
                      #{job.id.substring(0, 8).toUpperCase()}
                    </Link>
                  </td>
                  
                  {/* Filename */}
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 bg-white/5 border border-white/10 rounded-lg shrink-0">
                        <Image className="w-3.5 h-3.5 text-zinc-300" />
                      </div>
                      <Link 
                        to={`/jobs/${job.id}`} 
                        className="text-xs font-semibold text-white hover:text-purple-400 hover:underline truncate max-w-[200px] sm:max-w-[300px]"
                      >
                        {job.originalFilename}
                      </Link>
                    </div>
                  </td>
                  
                  {/* Pipeline Status */}
                  <td className="px-6 py-4 text-center">
                    <div className="flex flex-col items-center gap-1.5">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border ${getStatusStyle(job.status)}`}>
                        <span className={`w-1 h-1 rounded-full ${
                          job.status === "completed" ? "bg-emerald-400" : job.status === "failed" ? "bg-red-400" : "bg-purple-400"
                        }`} />
                        {job.status}
                      </span>
                      {job.status === "processing" && (
                        <div className="w-20 h-1 bg-white/5 rounded-full overflow-hidden">
                          <div className="h-full progress-gradient w-[65%]" />
                        </div>
                      )}
                    </div>
                  </td>
                  
                  {/* MegaPixel Rating (aka Quality Score in our adapter) */}
                  <td className="px-6 py-4 text-center">
                    {job.status === "completed" ? (
                      <div className="flex items-center justify-center gap-1.5">
                        <span className={`text-xs font-extrabold font-code-sm ${
                          job.qualityScore > 75 
                            ? "text-emerald-400 drop-shadow-[0_0_6px_rgba(52,211,153,0.2)]" 
                            : "text-amber-400"
                        }`}>
                          {Math.round(job.qualityScore || 0)}%
                        </span>
                        {job.qualityScore > 90 && (
                          <Sparkles className="w-3 h-3 text-purple-400" />
                        )}
                      </div>
                    ) : job.status === "failed" ? (
                      <span className="text-[10px] text-zinc-600 font-bold uppercase tracking-wider">N/A</span>
                    ) : (
                      <span className="text-zinc-500 animate-pulse text-xs font-bold">---</span>
                    )}
                  </td>
                  
                  {/* Created Time */}
                  <td className="px-6 py-4 text-xs text-zinc-400">
                    {new Date(job.createdAt).toLocaleString()}
                  </td>
                  
                  {/* Actions Link */}
                  <td className="px-6 py-4 text-right">
                    <Link 
                      to={`/jobs/${job.id}`} 
                      className="p-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-zinc-400 hover:text-white transition-all inline-flex"
                    >
                      <ArrowUpRight className="w-4 h-4" />
                    </Link>
                  </td>
                  
                </tr>
              ))}
            
            {jobs.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-16 text-center text-sm text-zinc-500 italic">
                  No execution reports matched the criteria.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        
        {/* Pagination Controls */}
        <div className="bg-white/[0.01] px-6 py-4 flex items-center justify-between border-t border-white/[0.04]">
          <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
            Displaying <span className="font-extrabold text-white">{(page - 1) * limit + 1} - {Math.min(page * limit, total)}</span> of {total} operations
          </p>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-2 border border-white/10 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-400 disabled:opacity-30 disabled:pointer-events-none transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            
            <div className="flex gap-1">
              <button className="w-8 h-8 flex items-center justify-center rounded-lg bg-white text-[#030303] text-xs font-bold shadow-[0_0_12px_rgba(255,255,255,0.15)]">
                {page}
              </button>
            </div>
            
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages || total === 0}
              className="p-2 border border-white/10 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-400 disabled:opacity-30 disabled:pointer-events-none transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
        
      </div>
    </div>
  );
};

export default Jobs;
