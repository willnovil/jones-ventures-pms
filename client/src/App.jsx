import { Routes, Route } from "react-router-dom";
import { ToastProvider } from "./components/Toast";
import Sidebar from "./components/Sidebar";
import Dashboard from "./pages/Dashboard";
import Properties from "./pages/Properties";
import Units from "./pages/Units";
import Tenants from "./pages/Tenants";
import Leases from "./pages/Leases";
import LeaseDetail from "./pages/LeaseDetail";
import Transactions from "./pages/Transactions";
import Maintenance from "./pages/Maintenance";
import Leads from "./pages/Leads";

export default function App() {
  return (
    <ToastProvider>
      <div className="flex h-screen bg-gray-50">
        <Sidebar />
        <main className="flex-1 overflow-auto p-8">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/properties" element={<Properties />} />
            <Route path="/units" element={<Units />} />
            <Route path="/tenants" element={<Tenants />} />
            <Route path="/leases" element={<Leases />} />
            <Route path="/leases/:id" element={<LeaseDetail />} />
            <Route path="/transactions" element={<Transactions />} />
            <Route path="/maintenance" element={<Maintenance />} />
            <Route path="/leads" element={<Leads />} />
          </Routes>
        </main>
      </div>
    </ToastProvider>
  );
}
