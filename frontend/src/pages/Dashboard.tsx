import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';

const Dashboard: React.FC = () => {
  const [stats, setStats] = useState({ total: 0, completed: 0, failed: 0, processing: 0 });
  const [recentJobs, setRecentJobs] = useState<any[]>([]);

  useEffect(() => {
    // In a real app we would have an endpoint for aggregate stats.
    // Since our backend only provides a list of jobs with filters, we can just use total count from /jobs
    const fetchDashboardData = async () => {
      try {
        const [allRes, compRes, failRes, procRes, latestRes] = await Promise.all([
          axios.get('/api/v1/jobs?limit=1'),
          axios.get('/api/v1/jobs?status=completed&limit=1'),
          axios.get('/api/v1/jobs?status=failed&limit=1'),
          axios.get('/api/v1/jobs?status=processing&limit=1'),
          axios.get('/api/v1/jobs?limit=5')
        ]);
        
        setStats({
          total: allRes.data.total || 0,
          completed: compRes.data.total || 0,
          failed: failRes.data.total || 0,
          processing: procRes.data.total || 0,
        });

        setRecentJobs(latestRes.data.jobs || []);
      } catch (error) {
        console.error("Failed to fetch dashboard data", error);
      }
    };
    fetchDashboardData();
  }, []);

  return (
    <div className="max-w-[1400px] mx-auto grid grid-cols-12 gap-gutter">
      {/* Welcome Header */}
      <div className="col-span-12 mb-sm">
        <h3 className="font-headline-lg text-headline-lg">System Overview</h3>
        <p className="font-body-md text-body-md text-on-surface-variant">Monitor real-time throughput and processing health.</p>
      </div>
      
      {/* Stats Bento Grid */}
      <div className="col-span-12 lg:col-span-3">
        <div className="glass-card p-lg rounded-xl flex flex-col h-full relative overflow-hidden">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-primary/5 rounded-full blur-2xl"></div>
          <div className="flex justify-between items-start mb-md">
            <span className="material-symbols-outlined text-primary p-sm bg-surface-container-high rounded-lg" data-icon="cloud_upload">cloud_upload</span>
            <span className="text-emerald-600 font-label-md bg-emerald-50 px-2 py-0.5 rounded-full">+12%</span>
          </div>
          <p className="font-label-md text-label-md text-outline uppercase tracking-wider">Total Uploads</p>
          <p className="font-headline-xl text-headline-xl mt-base">{stats.total}</p>
        </div>
      </div>
      
      <div className="col-span-12 lg:col-span-3">
        <div className="glass-card p-lg rounded-xl flex flex-col h-full relative overflow-hidden">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-secondary/5 rounded-full blur-2xl"></div>
          <div className="flex justify-between items-start mb-md">
            <span className="material-symbols-outlined text-secondary p-sm bg-secondary-fixed rounded-lg" data-icon="check_circle">check_circle</span>
            <span className="text-on-surface-variant font-label-md">
              {stats.total > 0 ? ((stats.completed / stats.total) * 100).toFixed(1) : 0}% rate
            </span>
          </div>
          <p className="font-label-md text-label-md text-outline uppercase tracking-wider">Completed</p>
          <p className="font-headline-xl text-headline-xl mt-base">{stats.completed}</p>
        </div>
      </div>
      
      <div className="col-span-12 lg:col-span-3">
        <div className="glass-card p-lg rounded-xl flex flex-col h-full relative overflow-hidden border-error/20">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-error/5 rounded-full blur-2xl"></div>
          <div className="flex justify-between items-start mb-md">
            <span className="material-symbols-outlined text-error p-sm bg-error-container rounded-lg" data-icon="error">error</span>
          </div>
          <p className="font-label-md text-label-md text-outline uppercase tracking-wider">Failed</p>
          <p className="font-headline-xl text-headline-xl mt-base">{stats.failed}</p>
        </div>
      </div>
      
      <div className="col-span-12 lg:col-span-3">
        <div className="glass-card p-lg rounded-xl flex flex-col h-full bg-gradient-to-br from-white to-surface-container-lowest">
          <div className="flex justify-between items-start mb-md">
            <span className="material-symbols-outlined text-on-secondary-fixed-variant p-sm bg-secondary-fixed rounded-lg" data-icon="pending">pending</span>
          </div>
          <p className="font-label-md text-label-md text-outline uppercase tracking-wider">Processing</p>
          <p className="font-headline-xl text-headline-xl mt-base">{stats.processing}</p>
          <div className="mt-md w-full bg-surface-container-high h-1 rounded-full overflow-hidden">
            <div className="progress-gradient h-full w-[65%]"></div>
          </div>
        </div>
      </div>

      {/* Recent Uploads Table */}
      <div className="col-span-12 lg:col-span-8">
        <div className="glass-card rounded-xl overflow-hidden h-full">
          <div className="px-lg py-md border-b border-outline-variant flex justify-between items-center bg-surface-container-low/50">
            <h4 className="font-headline-md text-headline-md">Recent Pipeline Activity</h4>
            <Link to="/jobs" className="text-secondary font-label-md hover:underline">View All Jobs</Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-lowest text-outline font-label-md border-b border-outline-variant">
                  <th className="px-lg py-md font-medium">NAME</th>
                  <th className="px-lg py-md font-medium">STATUS</th>
                  <th className="px-lg py-md font-medium">PROGRESS</th>
                  <th className="px-lg py-md font-medium">ACTIONS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant">
                {recentJobs.map((job) => (
                  <tr key={job.id} className="hover:bg-surface-container-low/30 transition-colors">
                    <td className="px-lg py-md">
                      <div className="flex items-center gap-md">
                        <div className="p-xs bg-primary/5 rounded border border-outline-variant">
                          <span className="material-symbols-outlined text-primary text-[20px]" data-icon="image">image</span>
                        </div>
                        <div>
                          <p className="font-body-md font-semibold">{job.originalFilename}</p>
                          <p className="text-xs text-outline">{job.mimeType} • {(job.fileSizeBytes / 1024 / 1024).toFixed(1)} MB</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-lg py-md">
                      <div className={`flex items-center gap-xs font-label-md ${
                        job.status === 'completed' ? 'text-emerald-600' : 
                        job.status === 'failed' ? 'text-error' : 'text-secondary'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${
                          job.status === 'completed' ? 'bg-emerald-600' : 
                          job.status === 'failed' ? 'bg-error' : 'bg-secondary animate-pulse'
                        }`}></span>
                        {job.status.charAt(0).toUpperCase() + job.status.slice(1)}
                      </div>
                    </td>
                    <td className="px-lg py-md">
                      {job.status === 'processing' ? (
                        <div className="w-full bg-surface-container-high h-1.5 rounded-full overflow-hidden">
                          <div className="progress-gradient h-full w-[45%]"></div>
                        </div>
                      ) : (
                        <p className="font-label-md">{job.status === 'completed' ? '100%' : '0%'}</p>
                      )}
                    </td>
                    <td className="px-lg py-md">
                      <Link to={`/jobs/${job.id}`} className="material-symbols-outlined text-outline hover:text-primary transition-colors" data-icon="chevron_right">chevron_right</Link>
                    </td>
                  </tr>
                ))}
                {recentJobs.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-lg py-xl text-center text-outline">No activity yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Activity Feed Sidebar */}
      <div className="col-span-12 lg:col-span-4 flex flex-col gap-gutter">
        {/* Quick Upload CTA */}
        <div className="bg-[#2e1065] rounded-xl p-lg text-white shadow-xl relative overflow-hidden group">
          <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.4),transparent)] transition-transform group-hover:scale-150"></div>
          <h5 className="font-headline-md text-headline-md mb-xs relative z-10">Quick Pipeline</h5>
          <p className="font-body-md opacity-80 mb-lg relative z-10">Immediately start standard processing workflows.</p>
          <Link to="/upload" className="w-full bg-white text-[#2e1065] font-bold py-md rounded-lg flex items-center justify-center gap-md hover:bg-opacity-90 transition-all relative z-10">
            <span className="material-symbols-outlined" data-icon="bolt">bolt</span>
            Start Upload
          </Link>
        </div>
        
        {/* Processing Activity Feed */}
        <div className="glass-card rounded-xl flex flex-col flex-grow">
          <div className="px-lg py-md border-b border-outline-variant flex justify-between items-center">
            <h4 className="font-headline-md text-headline-md">Live Activity</h4>
            <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]"></span>
          </div>
          <div className="p-lg space-y-lg overflow-y-auto max-h-[400px]">
            {recentJobs.map((job, idx) => (
              <div key={job.id} className="flex gap-md relative">
                {idx < recentJobs.length - 1 && (
                  <div className="absolute left-2.5 top-8 bottom-0 w-[1px] bg-outline-variant"></div>
                )}
                <div className={`relative z-10 w-5 h-5 rounded-full flex items-center justify-center border-2 border-white ${
                  job.status === 'completed' ? 'bg-emerald-100' : 
                  job.status === 'failed' ? 'bg-red-100' : 'bg-secondary-fixed'
                }`}>
                  <span className={`material-symbols-outlined text-[12px] ${
                    job.status === 'completed' ? 'text-emerald-600' : 
                    job.status === 'failed' ? 'text-error' : 'text-secondary animate-spin'
                  }`} data-icon={
                    job.status === 'completed' ? 'check' : 
                    job.status === 'failed' ? 'close' : 'autorenew'
                  }>
                    {job.status === 'completed' ? 'check' : job.status === 'failed' ? 'close' : 'autorenew'}
                  </span>
                </div>
                <div className="pb-lg">
                  <p className="font-body-md">
                    <span className="font-bold">{job.originalFilename}</span> {
                      job.status === 'completed' ? 'processing finished.' : 
                      job.status === 'failed' ? 'processing failed.' : 'being analyzed...'
                    }
                  </p>
                  <p className="text-xs text-outline mt-base">
                    {new Date(job.createdAt).toLocaleTimeString()} • ID: {job.id.substring(0, 8)}
                  </p>
                </div>
              </div>
            ))}
            {recentJobs.length === 0 && (
              <p className="text-center text-outline font-body-md py-lg">No activity yet.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
