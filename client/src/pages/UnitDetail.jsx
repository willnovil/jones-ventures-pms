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

export default function UnitDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const addToast = useToast();

  const [unit, setUnit] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const data = await api.getUnit(id);
        if (!cancelled) setUnit(data);
      } catch {
        if (!cancelled) addToast("Failed to load unit", "error");
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

  if (!unit) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-8 text-center">
        <p className="text-gray-500">Unit not found.</p>
        <button
          onClick={() => navigate("/units")}
          className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 cursor-pointer"
        >
          Back to Units
        </button>
      </div>
    );
  }

  const leases = unit.leases || [];
  const maintenance = unit.maintenanceRequests || [];
  const activeLease = leases.find((l) => l.status === "ACTIVE");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/units")}
            className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors cursor-pointer"
            title="Back"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Unit {unit.unitNumber}</h1>
            <p className="mt-1 text-sm text-gray-500">
              {unit.property ? (
                <button
                  onClick={() => navigate(`/properties/${unit.property.id}`)}
                  className="hover:text-blue-600 hover:underline cursor-pointer"
                >
                  {unit.property.name}
                </button>
              ) : (
                "—"
              )}
            </p>
          </div>
        </div>
        <StatusBadge status={unit.status} />
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Main content (2/3) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Active Lease card */}
          {activeLease && (
            <div className="rounded-xl border border-gray-200 bg-white">
              <div className="border-b border-gray-200 px-5 py-4 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-900">Current Lease</h2>
                <StatusBadge status={activeLease.status} />
              </div>
              <div className="p-5">
                <button
                  onClick={() => navigate(`/leases/${activeLease.id}`)}
                  className="text-base font-semibold text-blue-600 hover:underline cursor-pointer"
                >
                  {activeLease.tenant
                    ? `${activeLease.tenant.firstName} ${activeLease.tenant.lastName}`
                    : "Unknown tenant"}
                </button>
                <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt className="text-gray-500">Term</dt>
                    <dd className="text-gray-900">
                      {formatDate(activeLease.startDate)} — {formatDate(activeLease.endDate)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-gray-500">Rent</dt>
                    <dd className="font-medium text-gray-900">{formatCurrency(activeLease.rentAmount)}</dd>
                  </div>
                  <div>
                    <dt className="text-gray-500">Deposit</dt>
                    <dd className="text-gray-900">
                      {formatCurrency(activeLease.depositAmount)}{" "}
                      <span className={`text-xs font-semibold ${activeLease.depositPaid ? "text-green-600" : "text-red-600"}`}>
                        {activeLease.depositPaid ? "Paid" : "Unpaid"}
                      </span>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-gray-500">Signature</dt>
                    <dd>
                      <StatusBadge status={activeLease.signatureStatus} />
                    </dd>
                  </div>
                </dl>
              </div>
            </div>
          )}

          {/* Lease History */}
          <div className="rounded-xl border border-gray-200 bg-white">
            <div className="border-b border-gray-200 px-5 py-4">
              <h2 className="text-sm font-semibold text-gray-900">Lease History</h2>
            </div>
            {leases.length === 0 ? (
              <div className="px-5 py-12 text-center text-sm text-gray-500">No leases yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50/50">
                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Tenant</th>
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
                          {lease.tenant ? `${lease.tenant.firstName} ${lease.tenant.lastName}` : "—"}
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

          {/* Maintenance History */}
          <div className="rounded-xl border border-gray-200 bg-white">
            <div className="border-b border-gray-200 px-5 py-4">
              <h2 className="text-sm font-semibold text-gray-900">Maintenance History</h2>
            </div>
            {maintenance.length === 0 ? (
              <div className="px-5 py-12 text-center text-sm text-gray-500">No maintenance requests.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50/50">
                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Title</th>
                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Tenant</th>
                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Priority</th>
                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Status</th>
                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Created</th>
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
                        <td className="px-5 py-3.5 text-sm text-gray-600">
                          {m.tenant ? `${m.tenant.firstName} ${m.tenant.lastName}` : "—"}
                        </td>
                        <td className="px-5 py-3.5">
                          <StatusBadge status={m.priority} />
                        </td>
                        <td className="px-5 py-3.5">
                          <StatusBadge status={m.status} />
                        </td>
                        <td className="px-5 py-3.5 text-sm text-gray-600">{formatDate(m.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Summary card (1/3) */}
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-gray-900">Details</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-500">Bedrooms</dt>
              <dd className="font-medium text-gray-900">{unit.bedrooms}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Bathrooms</dt>
              <dd className="font-medium text-gray-900">{unit.bathrooms}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Sq Ft</dt>
              <dd className="font-medium text-gray-900">
                {unit.sqft ? Number(unit.sqft).toLocaleString() : "—"}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Listed Rent</dt>
              <dd className="font-medium text-gray-900">{formatCurrency(unit.rentAmount)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Status</dt>
              <dd>
                <StatusBadge status={unit.status} />
              </dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  );
}
