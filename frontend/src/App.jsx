import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/Layout/Layout";
import Dashboard from "./pages/Dashboard";
import Upload from "./pages/Upload";
import Jobs from "./pages/Jobs";
import JobResults from "./pages/JobResults";
const App = () => {
  return <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="upload" element={<Upload />} />
          <Route path="jobs" element={<Jobs />} />
          <Route path="jobs/:id" element={<JobResults />} />
          <Route path="settings" element={<div className="p-xl text-center font-headline-md text-outline">Settings Comming Soon...</div>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>;
};
var App_default = App;
export {
  App_default as default
};
