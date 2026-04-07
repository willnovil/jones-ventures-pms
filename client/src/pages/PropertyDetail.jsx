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

export default function PropertyDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const addToast = useToast();

  const [property, setProperty] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const data = await api.getProperty(id);
        if (!cancelled) setProperty(data);
      } catch {
        if (!cancelled) addToast("Failed to load property", "error");
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

  if (!property) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-8 text-center">
        <p className="text-gray-500">Property not found.</p>
        <button
          onClick={() => navigate("/properties")}
          className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 cursor-pointer"
        >
          Back to Properties
        </button>
      </div>
    );
  }

  const units = property.units || [];
  const totalUnits = units.length;
  const occupiedUnits = units.filter((u) => u.status === "OCCUPIED").length;
  const vacantUnits = units.filter((u) => u.status === "VACANT").length;
  const occupancyPct = totalUnits > 0 ? Math.round((occupiedUnits / totalUnits) * 100) : 0;
  const monthlyRent = units.reduce((sum, u) => sum + (Number(u.rentAmount) || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/properties")}
            className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors cursor-pointer"
            title="Back"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{property.name}</h1>
            <p className="mt-1 text-sm text-gray-500">
              {property.address}, {property.city}, {property.state} {property.zip}
            </p>
          </div>
        </div>
        <span className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-sm font-medium text-gray-700">
          {property.type}
        </span>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <p className="text-sm font-medium text-gray-500">Total Units</p>
          <p className="mt-2 text-3xl font-bold text-gray-900">{totalUnits}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <p className="text-sm font-medium text-gray-500">Occupied</p>
          <p className="mt-2 text-3xl font-bold text-purple-700">{occupiedUnits}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <p className="text-sm font-medium text-gray-500">Vacant</p>
          <p className="mt-2 text-3xl font-bold text-amber-600">{vacantUnits}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <p className="text-sm font-medium text-gray-500">Occupancy</p>
          <p className="mt-2 text-3xl font-bold text-blue-700">{occupancyPct}%</p>
        </div>
      </div>

      {/* Two columns */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Units list (2/3) */}
        <div className="lg:col-span-2 rounded-xl border border-gray-200 bg-white">
          <div className="border-b border-gray-200 px-5 py-4">
            <h2 className="text-sm font-semibold text-gray-900">Units</h2>
          </div>
          {units.length === 0 ? (
            <div className="px-5 py-12 text-center text-sm text-gray-500">
              No units in this property yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50/50">
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Unit</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Bed/Bath</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Sq Ft</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Rent</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {units.map((unit) => (
                    <tr
                      key={unit.id}
                      onClick={() => navigate(`/units/${unit.id}`)}
                      className="cursor-pointer hover:bg-gray-50/50 transition-colors"
                    >
                      <td className="px-5 py-3.5 text-sm font-semibold text-gray-900">{unit.unitNumber}</td>
                      <td className="px-5 py-3.5 text-sm text-gray-600">
                        {unit.bedrooms} / {unit.bathrooms}
                      </td>
                      <td className="px-5 py-3.5 text-sm text-gray-600">
                        {unit.sqft ? Number(unit.sqft).toLocaleString() : "—"}
                      </td>
                      <td className="px-5 py-3.5 text-sm font-medium text-gray-900">
                        {formatCurrency(unit.rentAmount)}
                      </td>
                      <td className="px-5 py-3.5">
                        <StatusBadge status={unit.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Summary card (1/3) */}
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-gray-900">Summary</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-500">Type</dt>
              <dd className="font-medium text-gray-900">{property.type}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">City</dt>
              <dd className="font-medium text-gray-900">{property.city}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">State</dt>
              <dd className="font-medium text-gray-900">{property.state}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Zip</dt>
              <dd className="font-medium text-gray-900">{property.zip}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Monthly Rent (gross)</dt>
              <dd className="font-medium text-gray-900">{formatCurrency(monthlyRent)}</dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  );
}
