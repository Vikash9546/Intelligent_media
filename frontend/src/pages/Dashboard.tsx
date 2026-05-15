import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';

const Dashboard: React.FC = () => {
  const [stats, setStats] = useState({ total: 0, completed: 0, failed: 0, processing: 0 });

  useEffect(() => {
    // In a real app we would have an endpoint for aggregate stats.
    // Since our backend only provides a list of jobs with filters, we can just use total count from /jobs
    const fetchStats = async () => {
      try {
        const [allRes, compRes, failRes, procRes] = await Promise.all([
          axios.get('/api/v1/jobs?limit=1'),
          axios.get('/api/v1/jobs?status=completed&limit=1'),
          axios.get('/api/v1/jobs?status=failed&limit=1'),
          axios.get('/api/v1/jobs?status=processing&limit=1')
        ]);
        
        setStats({
          total: allRes.data.total || 0,
          completed: compRes.data.total || 0,
          failed: failRes.data.total || 0,
          processing: procRes.data.total || 0,
        });
      } catch (error) {
        console.error("Failed to fetch stats", error);
      }
    };
    fetchStats();
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
                {/* Placeholder rows matching design */}
                <tr className="hover:bg-surface-container-low/30 transition-colors">
                  <td className="px-lg py-md">
                    <div className="flex items-center gap-md">
                      <div className="p-xs bg-primary/5 rounded border border-outline-variant">
                        <span className="material-symbols-outlined text-primary text-[20px]" data-icon="image">image</span>
                      </div>
                      <div>
                        <p className="font-body-md font-semibold">campaign_hero_raw_01.jpg</p>
                        <p className="text-xs text-outline">4.2 MB • JPEG</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-lg py-md">
                    <div className="flex items-center gap-xs text-emerald-600 font-label-md">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                      Success
                    </div>
                  </td>
                  <td className="px-lg py-md">
                    <p className="font-label-md">100%</p>
                  </td>
                  <td className="px-lg py-md">
                    <button className="material-symbols-outlined text-outline hover:text-primary transition-colors" data-icon="more_vert">more_vert</button>
                  </td>
                </tr>
                <tr className="hover:bg-surface-container-low/30 transition-colors">
                  <td className="px-lg py-md">
                    <div className="flex items-center gap-md">
                      <div className="p-xs bg-primary/5 rounded border border-outline-variant">
                        <span className="material-symbols-outlined text-primary text-[20px]" data-icon="image">image</span>
                      </div>
                      <div>
                        <p className="font-body-md font-semibold">podcast_cover_art.png</p>
                        <p className="text-xs text-outline">1.2 MB • PNG</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-lg py-md">
                    <div className="flex items-center gap-xs text-secondary font-label-md">
                      <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse"></span>
                      Processing
                    </div>
                  </td>
                  <td className="px-lg py-md w-32">
                    <div className="w-full bg-surface-container-high h-1.5 rounded-full overflow-hidden">
                      <div className="progress-gradient h-full w-[45%]"></div>
                    </div>
                  </td>
                  <td className="px-lg py-md">
                    <button className="material-symbols-outlined text-outline hover:text-primary transition-colors" data-icon="more_vert">more_vert</button>
                  </td>
                </tr>
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
            {/* Activity Item 1 */}
            <div className="flex gap-md relative">
              <div className="absolute left-2.5 top-8 bottom-0 w-[1px] bg-outline-variant"></div>
              <div className="relative z-10 w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center border-2 border-white">
                <span className="material-symbols-outlined text-emerald-600 text-[12px]" data-icon="check">check</span>
              </div>
              <div className="pb-lg">
                <p className="font-body-md"><span className="font-bold">Project Alpha</span> metadata extraction finished.</p>
                <p className="text-xs text-outline mt-base">2 mins ago • Engine Node 4</p>
              </div>
            </div>
            {/* Activity Item 2 */}
            <div className="flex gap-md relative">
              <div className="absolute left-2.5 top-8 bottom-0 w-[1px] bg-outline-variant"></div>
              <div className="relative z-10 w-5 h-5 rounded-full bg-secondary-fixed flex items-center justify-center border-2 border-white">
                <span className="material-symbols-outlined text-secondary text-[12px] animate-spin" data-icon="autorenew">autorenew</span>
              </div>
              <div className="pb-lg">
                <p className="font-body-md"><span className="font-bold">Image_042</span> rendering analysis...</p>
                <p className="text-xs text-outline mt-base">12 mins ago • Worker Queue</p>
                <div className="mt-sm p-sm bg-surface-container-low rounded border border-outline-variant">
                  <div className="flex justify-between font-label-md mb-xs">
                    <span>45%</span>
                    <span>Processing</span>
                  </div>
                  <div className="w-full bg-surface-container-high h-1 rounded-full overflow-hidden">
                    <div className="bg-secondary h-full w-[45%]"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
