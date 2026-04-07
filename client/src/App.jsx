import { Routes, Route, Outlet } from "react-router-dom";
import { ToastProvider } from "./components/Toast";
import Sidebar from "./components/Sidebar";
import RequireAuth from "./components/RequireAuth";
import Dashboard from "./pages/Dashboard";
import Properties from "./pages/Properties";
import PropertyDetail from "./pages/PropertyDetail";
import Units from "./pages/Units";
import UnitDetail from "./pages/UnitDetail";
import Tenants from "./pages/Tenants";
import TenantDetail from "./pages/TenantDetail";
import Leases from "./pages/Leases";
import LeaseDetail from "./pages/LeaseDetail";
import AddExistingLease from "./pages/AddExistingLease";
import Transactions from "./pages/Transactions";
import Maintenance from "./pages/Maintenance";
import MaintenanceDetail from "./pages/MaintenanceDetail";
import Leads from "./pages/Leads";
import LeadDetail from "./pages/LeadDetail";
import Templates from "./pages/Templates";
import ImportUnits from "./pages/ImportUnits";
import ImportRentRoll from "./pages/ImportRentRoll";
import Login from "./pages/auth/Login";
import Signup from "./pages/auth/Signup";
import ForgotPassword from "./pages/auth/ForgotPassword";

function AppLayout() {
  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 overflow-auto p-8">
        <Outlet />
      </main>
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <Routes>
        {/* Public auth routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />

        {/* Protected app routes */}
        <Route
          element={
            <RequireAuth>
              <AppLayout />
            </RequireAuth>
          }
        >
          <Route path="/" element={<Dashboard />} />
          <Route path="/properties" element={<Properties />} />
          <Route path="/properties/:id" element={<PropertyDetail />} />
          <Route path="/units" element={<Units />} />
          <Route path="/units/:id" element={<UnitDetail />} />
          <Route path="/tenants" element={<Tenants />} />
          <Route path="/tenants/:id" element={<TenantDetail />} />
          <Route path="/leases" element={<Leases />} />
          <Route path="/leases/add-existing" element={<AddExistingLease />} />
          <Route path="/leases/:id" element={<LeaseDetail />} />
          <Route path="/transactions" element={<Transactions />} />
          <Route path="/maintenance" element={<Maintenance />} />
          <Route path="/maintenance/:id" element={<MaintenanceDetail />} />
          <Route path="/leads" element={<Leads />} />
          <Route path="/leads/:id" element={<LeadDetail />} />
          <Route path="/templates" element={<Templates />} />
          <Route path="/import" element={<ImportUnits />} />
          <Route path="/import/rentroll" element={<ImportRentRoll />} />
        </Route>
      </Routes>
    </ToastProvider>
  );
}
