import { Routes, Route, Outlet } from "react-router-dom";
import { ToastProvider } from "./components/Toast";
import Sidebar from "./components/Sidebar";
import RequireAuth from "./components/RequireAuth";
import Dashboard from "./pages/Dashboard";
import Properties from "./pages/Properties";
import Units from "./pages/Units";
import Tenants from "./pages/Tenants";
import Leases from "./pages/Leases";
import LeaseDetail from "./pages/LeaseDetail";
import Transactions from "./pages/Transactions";
import Maintenance from "./pages/Maintenance";
import Leads from "./pages/Leads";
import Templates from "./pages/Templates";
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
          <Route path="/units" element={<Units />} />
          <Route path="/tenants" element={<Tenants />} />
          <Route path="/leases" element={<Leases />} />
          <Route path="/leases/:id" element={<LeaseDetail />} />
          <Route path="/transactions" element={<Transactions />} />
          <Route path="/maintenance" element={<Maintenance />} />
          <Route path="/leads" element={<Leads />} />
          <Route path="/templates" element={<Templates />} />
        </Route>
      </Routes>
    </ToastProvider>
  );
}
