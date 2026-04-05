import { useState, useEffect } from "react";
import { api } from "../lib/api";
import StatusBadge from "../components/StatusBadge";
import LoadingSpinner from "../components/LoadingSpinner";

const currency = (n) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n || 0);

const formatDate = (d) => (d ? new Date(d).toLocaleDateString() : "");

function timeAgo(date) {
  if (!date) return "";
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return formatDate(date);
}

// --- Inline SVG Icons ---

function BuildingIcon() {
  return (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
    </svg>
  );
}

function GridIcon() {
  return (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zm0 9.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zm0 9.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
    </svg>
  );
}

function ChartIcon() {
  return (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
    </svg>
  );
}

function DoorOpenIcon() {
  return (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
    </svg>
  );
}

function DocumentIcon() {
  return (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function WrenchIcon() {
  return (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11.42 15.17l-5.66 5.66a2.12 2.12 0 01-3-3l5.66-5.66m3-3l2.12-2.12a3 3 0 014.24 0l.88.88a3 3 0 010 4.24l-2.12 2.12m-3-3l3 3M3.75 4.5h3m-3 3h3m11.25-3h3m-3 3h3" />
    </svg>
  );
}

function UserPlusIcon() {
  return (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM4 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 0110.374 21c-2.331 0-4.512-.645-6.374-1.766z" />
    </svg>
  );
}

function DollarIcon() {
  return (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function CheckCircleIcon() {
  return (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function ExclamationIcon() {
  return (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
    </svg>
  );
}

function PaymentIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
    </svg>
  );
}

function MaintenanceSmallIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11.42 15.17l-5.66 5.66a2.12 2.12 0 01-3-3l5.66-5.66m3-3l2.12-2.12a3 3 0 014.24 0l.88.88a3 3 0 010 4.24l-2.12 2.12m-3-3l3 3" />
    </svg>
  );
}

function EnvelopeIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
    </svg>
  );
}

// --- Stat Card ---

const STAT_CONFIGS = [
  // Row 1
  { key: "totalProperties", label: "Total Properties", icon: BuildingIcon, border: "border-l-blue-500", iconBg: "bg-blue-50", iconColor: "text-blue-600" },
  { key: "totalUnits", label: "Total Units", icon: GridIcon, border: "border-l-green-500", iconBg: "bg-green-50", iconColor: "text-green-600" },
  { key: "occupancyRate", label: "Occupancy Rate", icon: ChartIcon, border: "border-l-purple-500", iconBg: "bg-purple-50", iconColor: "text-purple-600", format: (v) => `${(v || 0).toFixed(1)}%` },
  { key: "vacantUnits", label: "Vacant Units", icon: DoorOpenIcon, border: "border-l-amber-500", iconBg: "bg-amber-50", iconColor: "text-amber-600" },
  // Row 2
  { key: "activeLeases", label: "Active Leases", icon: DocumentIcon, border: "border-l-blue-500", iconBg: "bg-blue-50", iconColor: "text-blue-600" },
  { key: "expiringSoon", label: "Expiring Soon", icon: ClockIcon, border: "border-l-orange-500", iconBg: "bg-orange-50", iconColor: "text-orange-600" },
  { key: "openMaintenance", label: "Open Maintenance", icon: WrenchIcon, border: "border-l-red-500", iconBg: "bg-red-50", iconColor: "text-red-600" },
  { key: "newLeads", label: "New Leads", icon: UserPlusIcon, border: "border-l-teal-500", iconBg: "bg-teal-50", iconColor: "text-teal-600" },
];

function StatCard({ config, value }) {
  const Icon = config.icon;
  const display = config.format ? config.format(value) : (value ?? 0);

  return (
    <div className={`rounded-xl border border-gray-200 border-l-4 ${config.border} bg-white p-5 flex items-center gap-4`}>
      <div className={`flex-shrink-0 rounded-lg p-2.5 ${config.iconBg} ${config.iconColor}`}>
        <Icon />
      </div>
      <div>
        <p className="text-sm font-medium text-gray-500">{config.label}</p>
        <p className="mt-1 text-2xl font-bold text-gray-900">{display}</p>
      </div>
    </div>
  );
}

// --- Main Component ---

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .getDashboard()
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner />;

  const stats = data?.stats || {};
  const financials = data?.financials || {};
  const recentActivity = data?.recentActivity || [];
  const leads = data?.leads || [];

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="space-y-8">
      {/* Greeting Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Welcome back, Will</h1>
        <p className="mt-1 text-sm text-gray-500">{today}</p>
      </div>

      {/* Stat Cards — Row 1 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {STAT_CONFIGS.slice(0, 4).map((config) => (
          <StatCard key={config.key} config={config} value={stats[config.key]} />
        ))}
      </div>

      {/* Stat Cards — Row 2 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {STAT_CONFIGS.slice(4).map((config) => (
          <StatCard key={config.key} config={config} value={stats[config.key]} />
        ))}
      </div>

      {/* Financial Summary */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Financial Summary</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Monthly Rent Expected */}
          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="rounded-lg bg-blue-50 p-2 text-blue-600">
                <DollarIcon />
              </div>
              <p className="text-sm font-medium text-gray-500">Monthly Rent Expected</p>
            </div>
            <p className="text-2xl font-bold text-gray-900">
              {currency(financials.monthlyRentExpected)}
            </p>
          </div>

          {/* Total Collected */}
          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="rounded-lg bg-green-50 p-2 text-green-600">
                <CheckCircleIcon />
              </div>
              <p className="text-sm font-medium text-gray-500">Total Collected</p>
            </div>
            <p className="text-2xl font-bold text-green-600">
              {currency(financials.totalCollected)}
            </p>
          </div>

          {/* Outstanding Balance */}
          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="rounded-lg bg-red-50 p-2 text-red-600">
                <ExclamationIcon />
              </div>
              <p className="text-sm font-medium text-gray-500">Outstanding Balance</p>
            </div>
            <p className={`text-2xl font-bold ${(financials.outstandingBalance || 0) > 0 ? "text-red-600" : "text-gray-900"}`}>
              {currency(financials.outstandingBalance)}
            </p>
          </div>
        </div>
      </div>

      {/* Two Column: Recent Activity + New Leads */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Activity — takes 2 cols */}
        <div className="lg:col-span-2 rounded-xl border border-gray-200 bg-white">
          <div className="border-b border-gray-200 px-6 py-4">
            <h2 className="text-lg font-semibold text-gray-900">Recent Activity</h2>
          </div>
          <div className="divide-y divide-gray-100">
            {recentActivity.length === 0 ? (
              <div className="px-6 py-12 text-center text-sm text-gray-400">
                No recent activity to display.
              </div>
            ) : (
              recentActivity.map((item, i) => (
                <div key={item.id || i} className="flex items-center gap-4 px-6 py-4 hover:bg-gray-50/50 transition-colors">
                  <div
                    className={`flex-shrink-0 rounded-lg p-2 ${
                      item.type === "transaction"
                        ? "bg-green-50 text-green-600"
                        : "bg-orange-50 text-orange-600"
                    }`}
                  >
                    {item.type === "transaction" ? <PaymentIcon /> : <MaintenanceSmallIcon />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 truncate">{item.description}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{timeAgo(item.date)}</p>
                  </div>
                  {item.status && <StatusBadge status={item.status} />}
                </div>
              ))
            )}
          </div>
        </div>

        {/* New Leads — takes 1 col */}
        <div className="rounded-xl border border-gray-200 bg-white">
          <div className="border-b border-gray-200 px-6 py-4">
            <h2 className="text-lg font-semibold text-gray-900">New Leads</h2>
          </div>
          <div className="divide-y divide-gray-100">
            {leads.length === 0 ? (
              <div className="px-6 py-12 text-center text-sm text-gray-400">
                No new leads yet.
              </div>
            ) : (
              leads.map((lead, i) => (
                <div key={lead.id || i} className="px-6 py-4 hover:bg-gray-50/50 transition-colors">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-semibold text-gray-900">{lead.name}</p>
                    <StatusBadge status={lead.status} />
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-gray-400">
                    <EnvelopeIcon />
                    <span className="truncate">{lead.email}</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">{timeAgo(lead.createdAt)}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
