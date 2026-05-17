import { useEffect, useState } from "react";
import axios from "axios";
import { Link } from "react-router-dom";
const Jobs = () => {
  const [jobs, setJobs] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const limit = 10;
  const fetchJobs = async () => {
    try {
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
    }
  };
  useEffect(() => {
    fetchJobs();
  }, [page, statusFilter]);
  const totalPages = Math.ceil(total / limit) || 1;
  const getStatusColor = (status) => {
    switch (status) {
      case "completed":
        return "bg-emerald-100 text-emerald-700 border-emerald-200";
      case "failed":
        return "bg-red-100 text-red-700 border-red-200";
      case "processing":
        return "bg-amber-100 text-amber-700 border-amber-200";
      default:
        return "bg-surface-container text-outline border-outline-variant";
    }
  };
  const getStatusIcon = (status) => {
    switch (status) {
      case "failed":
        return "audio_file";
      // just mapping icons for visuals
      case "processing":
        return "movie";
      case "completed":
        return "image";
      default:
        return "video_file";
    }
  };
  return <div className="max-w-7xl mx-auto">
      {
    /* Header Section */
  }
      <div className="mb-xl flex items-end justify-between">
        <div>
          <h3 className="font-headline-lg text-headline-lg text-primary mb-1">Recent Jobs</h3>
          <p className="font-body-md text-body-md text-on-surface-variant">Monitor and manage your active media processing workloads.</p>
        </div>
        <div className="flex gap-sm">
          <button className="bg-surface border border-outline-variant px-md py-2 rounded-lg flex items-center gap-sm font-label-md text-on-surface-variant hover:bg-surface-container-low transition-colors shadow-sm">
            <span className="material-symbols-outlined text-[18px]" data-icon="file_download">file_download</span>
            Export CSV
          </button>
          <button onClick={fetchJobs} className="bg-secondary text-white px-md py-2 rounded-lg flex items-center gap-sm font-label-md hover:opacity-90 transition-opacity shadow-sm">
            <span className="material-symbols-outlined text-[18px]" data-icon="refresh">refresh</span>
            Refresh List
          </button>
        </div>
      </div>

      {
    /* Filter Bar */
  }
      <div className="glass-card rounded-xl p-md mb-lg flex flex-wrap items-center gap-lg">
        <div className="flex items-center gap-md border-r border-outline-variant pr-lg">
          <span className="font-label-md text-label-md text-outline">FILTER BY</span>
          <div className="flex gap-2">
            <select
    value={statusFilter}
    onChange={(e) => {
      setStatusFilter(e.target.value);
      setPage(1);
    }}
    className="bg-surface border border-outline-variant rounded-lg px-md py-1.5 text-body-md outline-none focus:border-secondary transition-colors"
  >
              <option value="">Status: All</option>
              <option value="processing">Status: Processing</option>
              <option value="completed">Status: Completed</option>
              <option value="failed">Status: Failed</option>
            </select>
          </div>
        </div>
        
        <div className="ml-auto flex items-center gap-base">
          <span className="font-label-md text-label-md text-outline">SEARCH</span>
          <div className="relative">
            <input
    className="bg-surface border border-outline-variant rounded-lg pl-3 pr-8 py-1.5 text-body-md outline-none focus:border-secondary transition-colors w-64"
    placeholder="Job ID or filename..."
    type="text"
  />
            <span className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 text-outline text-[18px]" data-icon="search">search</span>
          </div>
        </div>
      </div>

      {
    /* Data Grid */
  }
      <div className="glass-card rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-surface-container-low border-b border-outline-variant">
              <th className="px-lg py-md font-label-md text-label-md text-outline uppercase tracking-wider">Job ID</th>
              <th className="px-lg py-md font-label-md text-label-md text-outline uppercase tracking-wider">Filename</th>
              <th className="px-lg py-md font-label-md text-label-md text-outline uppercase tracking-wider text-center">Status</th>
              <th className="px-lg py-md font-label-md text-label-md text-outline uppercase tracking-wider">Quality Score</th>
              <th className="px-lg py-md font-label-md text-label-md text-outline uppercase tracking-wider">Created At</th>
              <th className="px-lg py-md" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {jobs.map((job) => <tr key={job.id} className="hover:bg-surface-container-lowest transition-colors">
                <td className="px-lg py-md font-code-sm text-code-sm text-secondary font-medium">
                  <Link to={`/jobs/${job.id}`}>#{job.id.substring(0, 8).toUpperCase()}</Link>
                </td>
                <td className="px-lg py-md">
                  <div className="flex items-center gap-sm">
                    <span className="material-symbols-outlined text-secondary" data-icon={getStatusIcon(job.status)}>
                      {getStatusIcon(job.status)}
                    </span>
                    <Link to={`/jobs/${job.id}`} className="font-body-md text-body-md font-semibold hover:text-secondary hover:underline">
                      {job.originalFilename}
                    </Link>
                  </div>
                </td>
                <td className="px-lg py-md">
                  <div className="flex flex-col items-center gap-1">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest border ${getStatusColor(job.status)}`}>
                      {job.status}
                    </span>
                    {job.status === "processing" && <div className="w-24 h-1 bg-surface-container-highest rounded-full overflow-hidden mt-1">
                        <div className="h-full progress-gradient w-[65%]" />
                      </div>}
                  </div>
                </td>
                <td className="px-lg py-md">
                  {job.status === "completed" ? <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1">
                        <span className={`font-code-sm text-code-sm font-bold ${job.qualityScore > 70 ? "text-emerald-600" : "text-amber-600"}`}>
                          {Math.round(job.qualityScore || 0)}
                        </span>
                        {job.qualityScore > 90 && <span className="material-symbols-outlined text-[16px] text-emerald-500" data-icon="verified">verified</span>}
                      </div>
                    </div> : job.status === "failed" ? <span className="text-on-surface-variant italic opacity-50">N/A</span> : <span className="font-code-sm text-code-sm">--</span>}
                </td>
                <td className="px-lg py-md font-body-md text-body-md text-on-surface-variant">
                  {new Date(job.createdAt).toLocaleString()}
                </td>
                <td className="px-lg py-md text-right">
                  <Link to={`/jobs/${job.id}`} className="p-1 hover:bg-surface-container-high rounded text-outline transition-colors inline-block">
                    <span className="material-symbols-outlined" data-icon="chevron_right">chevron_right</span>
                  </Link>
                </td>
              </tr>)}
            {jobs.length === 0 && <tr>
                <td colSpan={6} className="px-lg py-3xl text-center text-outline font-body-md">
                  No jobs found.
                </td>
              </tr>}
          </tbody>
        </table>
        
        {
    /* Pagination Controls */
  }
        <div className="bg-surface-container-low px-lg py-md flex items-center justify-between border-t border-outline-variant">
          <p className="font-label-md text-label-md text-on-surface-variant">
            Showing <span className="font-bold text-primary">{(page - 1) * limit + 1} - {Math.min(page * limit, total)}</span> of {total} jobs
          </p>
          <div className="flex items-center gap-sm">
            <button
    onClick={() => setPage((p) => Math.max(1, p - 1))}
    disabled={page === 1}
    className="p-2 border border-outline-variant rounded-lg bg-surface hover:bg-surface-container-high text-outline disabled:opacity-30 disabled:pointer-events-none transition-colors"
  >
              <span className="material-symbols-outlined text-[20px]" data-icon="chevron_left">chevron_left</span>
            </button>
            <div className="flex gap-1">
              <button className="w-9 h-9 flex items-center justify-center rounded-lg bg-primary text-on-primary font-label-md">
                {page}
              </button>
            </div>
            <button
    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
    disabled={page === totalPages || total === 0}
    className="p-2 border border-outline-variant rounded-lg bg-surface hover:bg-surface-container-high text-outline disabled:opacity-30 disabled:pointer-events-none transition-colors"
  >
              <span className="material-symbols-outlined text-[20px]" data-icon="chevron_right">chevron_right</span>
            </button>
          </div>
        </div>
      </div>
    </div>;
};
var Jobs_default = Jobs;
export {
  Jobs_default as default
};
