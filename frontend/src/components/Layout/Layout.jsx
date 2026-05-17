import { NavLink, Outlet } from "react-router-dom";
import { Sparkles, Upload, Activity, Layers, Bell, ShieldCheck, Cpu } from "lucide-react";

const Layout = () => {
  const navLinkClass = ({ isActive }) =>
    `relative py-2 px-4 text-sm font-medium transition-all duration-300 rounded-full flex items-center gap-2 ${
      isActive
        ? "text-white bg-white/5 border border-white/10 shadow-[0_0_15px_rgba(255,255,255,0.05)]"
        : "text-zinc-400 hover:text-white hover:bg-white/[0.02]"
    }`;

  return (
    <div className="relative min-h-screen bg-[#030303] text-zinc-100 selection:bg-purple-500/30">
      {/* Glow Effects in Background */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-purple-900/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute top-[20%] right-1/4 w-[600px] h-[600px] bg-indigo-900/5 rounded-full blur-[150px] pointer-events-none" />

      {/* Floating Sparkles/Chrome Stars matching the template */}
      <div className="absolute top-24 left-[10%] opacity-20 pointer-events-none animate-pulse sparkle-slow">
        <Sparkles className="w-8 h-8 text-zinc-300" />
      </div>
      <div className="absolute top-48 right-[8%] opacity-35 pointer-events-none animate-bounce sparkle-slow" style={{ animationDuration: '6s' }}>
        <Sparkles className="w-12 h-12 text-zinc-400" />
      </div>
      <div className="absolute bottom-[20%] left-[5%] opacity-15 pointer-events-none sparkle-slow" style={{ animationDuration: '8s' }}>
        <Sparkles className="w-10 h-10 text-zinc-500" />
      </div>

      {/* Top Premium Navigation Header */}
      <header className="fixed top-0 left-0 right-0 h-20 z-50 border-b border-white/[0.04] bg-[#030303]/60 backdrop-blur-md flex justify-between items-center px-8">
        <div className="flex items-center gap-12">
          {/* Logo / Brand */}
          <NavLink to="/" className="flex items-center gap-3 group">
            <div className="relative w-9 h-9 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-700 flex items-center justify-center shadow-[0_0_15px_rgba(168,85,247,0.3)] transition-transform group-hover:scale-105">
              <Cpu className="w-5 h-5 text-white" />
              <div className="absolute inset-0 rounded-xl border border-white/20" />
            </div>
            <div className="flex flex-col">
              <span className="font-semibold text-lg tracking-tight bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent">
                MediaPipe
              </span>
              <span className="text-[9px] text-purple-400 font-bold uppercase tracking-widest leading-none">
                Trust Engine
              </span>
            </div>
          </NavLink>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center gap-1">
            <NavLink to="/" className={navLinkClass}>
              <Layers className="w-4 h-4" />
              Overview
            </NavLink>
            <NavLink to="/upload" className={navLinkClass}>
              <Upload className="w-4 h-4" />
              Ingest Asset
            </NavLink>
            <NavLink to="/jobs" className={navLinkClass}>
              <Activity className="w-4 h-4" />
              Pipeline Jobs
            </NavLink>
          </nav>
        </div>

        {/* Right Actions & Health Badge */}
        <div className="flex items-center gap-6">
          {/* Health Badge */}
          <div className="hidden lg:flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/5 border border-emerald-500/10 text-emerald-400 text-xs font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Engine Operational
          </div>

          <div className="flex items-center gap-4 border-l border-white/5 pl-6">
            <button className="relative p-2 text-zinc-400 hover:text-white transition-colors">
              <Bell className="w-4 h-4" />
              <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-purple-500 rounded-full" />
            </button>
            
            {/* Quick Upload CTA - Button styled like premium Pill in UI template */}
            <NavLink
              to="/upload"
              className="hidden sm:flex items-center gap-2 px-5 py-2 rounded-full bg-white text-[#030303] text-xs font-bold shadow-[0_4px_12px_rgba(255,255,255,0.15)] hover:bg-zinc-200 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <Upload className="w-3.5 h-3.5" />
              Upload Image
            </NavLink>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-[1400px] mx-auto pt-32 px-6 pb-24 min-h-screen">
        <Outlet />
      </main>

      {/* Premium Footer matching the template footer styling */}
      <footer className="border-t border-white/[0.04] bg-[#030303] px-8 py-16">
        <div className="max-w-[1400px] mx-auto flex flex-col gap-12">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div>
              <p className="text-zinc-500 text-xs">
                © {new Date().getFullYear()} MediaPipe.io. All rights reserved.
              </p>
              <p className="text-zinc-600 text-[10px] mt-1">
                Calibrated multi-modal vehicle data trust assessment.
              </p>
            </div>
            
            <div className="flex flex-wrap gap-8 text-xs text-zinc-500">
              <a href="#" className="hover:text-white transition-colors">Documentation</a>
              <a href="#" className="hover:text-white transition-colors">API Reference</a>
              <a href="#" className="hover:text-white transition-colors">Privacy Policy</a>
              <a href="#" className="hover:text-white transition-colors">Terms of Service</a>
            </div>
          </div>
          
          {/* Big stylized outlined footer logo similar to "SEOtalos" in the template */}
          <div className="mt-6 border-t border-white/[0.02] pt-8 flex justify-center">
            <h2 className="text-[6vw] md:text-[8vw] font-black tracking-tighter text-center leading-none select-none bg-gradient-to-b from-white/[0.06] to-transparent bg-clip-text text-transparent uppercase font-headline-lg">
              MediaPipe
            </h2>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Layout;
