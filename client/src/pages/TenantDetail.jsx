import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import StatusBadge from "../components/StatusBadge";
import LoadingSpinner from "../components/LoadingSpinner";
import { useToast } from "../components/Toast";

function formatCurrency(n) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(Number(n) || 0);
}

function formatDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function initials(first, last) {
  return `${(first || "")[0] || ""}${(last || "")[0] || ""}`.toUpperCase();
}

export default function TenantDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const addToast = useToast();

  const [tenant, setTenant] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const data = await api.getTenant(id);
        if (!cancelled) setTenant(data);
      } catch {
        if (!cancelled) addToast("Failed to load tenant", "error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) return <LoadingSpinner />;

  if (!tenant) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-8 text-center">
        <p className="text-gray-500">Tenant not found.</p>
        <button
          onClick={() => navigate("/tenants")}
          className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 cursor-pointer"
        >
          Back to Tenants
        </button>
      </div>
    );
  }

  const leases = tenant.leases || [];
  const transactions = tenant.transactions || [];
  const maintenance = tenant.maintenanceRequests || [];

  // Computed financial summary
  const totalCharges = transactions
    .filter((t) => t.type === "CHARGE")
    .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
  const totalPaid = transactions
    .filter((t) => t.type === "PAYMENT")
    .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
  const outstanding = transactions
    .filter((t) => t.type === "CHARGE" && !t.paidDate)
    .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/tenants")}
            className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors cursor-pointer"
            title="Back"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-blue-100 text-blue-700 text-sm font-semibold flex items-center justify-center">
              {initials(tenant.firstName, tenant.lastName)}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {tenant.firstName} {tenant.lastName}
              </h1>
              <p className="mt-1 text-sm text-gray-500">{tenant.email}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Financial summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <p className="text-sm font-medium text-gray-500">Total Charges</p>
          <p className="mt-2 text-2xl font-bold text-red-600">{formatCurrency(totalCharges)}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <p className="text-sm font-medium text-gray-500">Total Paid</p>
          <p className="mt-2 text-2xl font-bold text-green-600">{formatCurrency(totalPaid)}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <p className="text-sm font-medium text-gray-500">Outstanding</p>
          <p className={`mt-2 text-2xl font-bold ${outstanding > 0 ? "text-amber-600" : "text-gray-900"}`}>
            {formatCurrency(outstanding)}
          </p>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Main content (2/3) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Leases */}
          <div className="rounded-xl border border-gray-200 bg-white">
            <div className="border-b border-gray-200 px-5 py-4">
              <h2 className="text-sm font-semibold text-gray-900">Leases</h2>
            </div>
            {leases.length === 0 ? (
              <div className="px-5 py-12 text-center text-sm text-gray-500">No leases yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50/50">
                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Unit</th>
                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Term</th>
                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Rent</th>
                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {leases.map((lease) => (
                      <tr
                        key={lease.id}
                        onClick={() => navigate(`/leases/${lease.id}`)}
                        className="cursor-pointer hover:bg-gray-50/50 transition-colors"
                      >
                        <td className="px-5 py-3.5 text-sm font-medium text-gray-900">
                          {lease.unit?.unitNumber || "—"}
                          {lease.unit?.property && (
                            <span className="ml-2 text-xs text-gray-500">
                              {lease.unit.property.name}
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-sm text-gray-600">
                          {formatDate(lease.startDate)} — {formatDate(lease.endDate)}
                        </td>
                        <td className="px-5 py-3.5 text-sm font-medium text-gray-900">
                          {formatCurrency(lease.rentAmount)}
                        </td>
                        <td className="px-5 py-3.5">
                          <StatusBadge status={lease.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Transactions */}
          <div className="rounded-xl border border-gray-200 bg-white">
            <div className="border-b border-gray-200 px-5 py-4">
              <h2 className="text-sm font-semibold text-gray-900">Transactions</h2>
            </div>
            {transactions.length === 0 ? (
              <div className="px-5 py-12 text-center text-sm text-gray-500">No transactions yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50/50">
                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Date</th>
                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Type</th>
                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Description</th>
                      <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">Amount</th>
                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Paid</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {transactions.map((t) => (
                      <tr key={t.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-5 py-3.5 text-sm text-gray-600">{formatDate(t.createdAt)}</td>
                        <td className="px-5 py-3.5">
                          <StatusBadge status={t.type} />
                        </td>
                        <td className="px-5 py-3.5 text-sm text-gray-600">{t.description || "—"}</td>
                        <td
                          className={`px-5 py-3.5 text-sm font-semibold text-right ${
                            t.type === "PAYMENT" || t.type === "CREDIT" ? "text-green-600" : "text-red-600"
                          }`}
                        >
                          {formatCurrency(t.amount)}
                        </td>
                        <td className="px-5 py-3.5 text-sm text-gray-600">
                          {t.paidDate ? formatDate(t.paidDate) : <span className="text-red-600 font-medium">Unpaid</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Maintenance */}
          <div className="rounded-xl border border-gray-200 bg-white">
            <div className="border-b border-gray-200 px-5 py-4">
              <h2 className="text-sm font-semibold text-gray-900">Maintenance Requests</h2>
            </div>
            {maintenance.length === 0 ? (
              <div className="px-5 py-12 text-center text-sm text-gray-500">No maintenance requests.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50/50">
                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Title</th>
                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Unit</th>
                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Priority</th>
                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {maintenance.map((m) => (
                      <tr
                        key={m.id}
                        onClick={() => navigate(`/maintenance/${m.id}`)}
                        className="cursor-pointer hover:bg-gray-50/50 transition-colors"
                      >
                        <td className="px-5 py-3.5 text-sm font-medium text-gray-900">{m.title}</td>
                        <td className="px-5 py-3.5 text-sm text-gray-600">{m.unit?.unitNumber || "—"}</td>
                        <td className="px-5 py-3.5">
                          <StatusBadge status={m.priority} />
                        </td>
                        <td className="px-5 py-3.5">
                          <StatusBadge status={m.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Contact card (1/3) */}
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-gray-900">Contact</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div>
              <dt className="text-gray-500">Email</dt>
              <dd className="font-medium text-gray-900 break-all">{tenant.email}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Phone</dt>
              <dd className="font-medium text-gray-900">{tenant.phone}</dd>
            </div>
            <div className="border-t border-gray-100 pt-3">
              <dt className="text-gray-500">Emergency Contact</dt>
              <dd className="font-medium text-gray-900">
                {tenant.emergencyContact || <span className="text-gray-400">—</span>}
              </dd>
            </div>
            <div>
              <dt className="text-gray-500">Emergency Phone</dt>
              <dd className="font-medium text-gray-900">
                {tenant.emergencyPhone || <span className="text-gray-400">—</span>}
              </dd>
            </div>
            <div className="border-t border-gray-100 pt-3">
              <dt className="text-gray-500">Tenant since</dt>
              <dd className="font-medium text-gray-900">{formatDate(tenant.createdAt)}</dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  );
}
