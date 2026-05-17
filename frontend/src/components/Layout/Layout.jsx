import { NavLink, Outlet } from "react-router-dom";
const Layout = () => {
  const navLinkClass = ({ isActive }) => `flex items-center gap-md rounded-lg p-md transition-colors duration-200 ${isActive ? "bg-secondary-fixed text-on-secondary-fixed-variant scale-[0.98]" : "text-on-surface-variant hover:bg-surface-container-high"}`;
  return <div className="bg-background text-on-surface font-body-md min-h-screen">
      {
    /* SideNavBar */
  }
      <aside className="fixed left-0 top-0 h-full w-[280px] border-r border-outline-variant bg-surface/70 backdrop-blur-md z-50 flex flex-col p-md space-y-base shadow-sm">
        <div className="mb-xl px-sm pt-sm">
          <h1 className="font-headline-md text-headline-md font-bold text-primary">MediaPipe</h1>
        </div>
        <nav className="flex-grow space-y-xs">
          <NavLink to="/" className={navLinkClass}>
            <span className="material-symbols-outlined" data-icon="dashboard">dashboard</span>
            <span className="font-body-md text-body-md">Dashboard</span>
          </NavLink>
          <NavLink to="/upload" className={navLinkClass}>
            <span className="material-symbols-outlined" data-icon="upload_file">upload_file</span>
            <span className="font-body-md text-body-md">Upload</span>
          </NavLink>
          <NavLink to="/jobs" className={navLinkClass}>
            <span className="material-symbols-outlined" data-icon="format_list_bulleted">format_list_bulleted</span>
            <span className="font-body-md text-body-md">Jobs</span>
          </NavLink>
        </nav>
      </aside>

      {
    /* TopAppBar */
  }
      <header className="fixed top-0 right-0 left-[280px] h-16 z-40 border-b border-outline-variant bg-surface/70 backdrop-blur-md flex justify-between items-center px-margin shadow-sm">
        <div className="flex items-center gap-xl w-1/2">
          <h2 className="font-headline-md text-headline-md font-black tracking-tight text-primary">Pipeline Dashboard</h2>
          <div className="relative flex-grow max-w-md">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-sm" data-icon="search">search</span>
            <input
    className="w-full bg-surface-container-lowest border border-outline-variant rounded-full pl-10 pr-4 py-1.5 text-body-md focus:ring-2 focus:ring-secondary/20 focus:border-secondary outline-none transition-all"
    placeholder="Search pipeline jobs..."
    type="text"
  />
          </div>
        </div>
        <div className="flex items-center gap-lg">
          <button className="material-symbols-outlined text-on-surface-variant hover:text-secondary transition-colors" data-icon="notifications">notifications</button>
          <button className="material-symbols-outlined text-on-surface-variant hover:text-secondary transition-colors" data-icon="help_outline">help_outline</button>
          <div className="h-6 w-[1px] bg-outline-variant mx-2" />
          <button className="material-symbols-outlined text-on-surface-variant hover:text-secondary transition-colors" data-icon="account_circle">account_circle</button>
        </div>
      </header>

      {
    /* Main Content */
  }
      <main className="ml-[280px] pt-16 p-margin min-h-screen pb-10">
        <Outlet />
      </main>
      
      {
    /* Contextual FAB */
  }
      <button className="fixed bottom-margin right-margin w-14 h-14 bg-primary text-on-primary rounded-full shadow-2xl flex items-center justify-center hover:scale-110 active:scale-95 transition-transform z-50">
          <span className="material-symbols-outlined text-2xl" data-icon="add">add</span>
      </button>
    </div>;
};
var Layout_default = Layout;
export {
  Layout_default as default
};
