import { Route, Routes } from "react-router-dom";
import Sidebar from "./components/Sidebar";
import Dashboard from "./pages/Dashboard";
import Invoices from "./pages/Invoices";
import Buyers from "./pages/Buyers";
import Approvals from "./pages/Approvals";
import QuickBooksPage from "./pages/QuickBooks";
import ProcessMonitor from "./pages/ProcessMonitor";

export default function App() {
  return (
    <div className="h-full flex bg-slate-50 text-slate-900">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-[1400px] mx-auto p-6">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/invoices" element={<Invoices />} />
            <Route path="/buyers" element={<Buyers />} />
            <Route path="/approvals" element={<Approvals />} />
            <Route path="/quickbooks" element={<QuickBooksPage />} />
            <Route path="/process" element={<ProcessMonitor />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}
