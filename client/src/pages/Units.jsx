import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import Modal from "../components/Modal";
import ConfirmDialog from "../components/ConfirmDialog";
import StatusBadge from "../components/StatusBadge";
import EmptyState from "../components/EmptyState";
import LoadingSpinner from "../components/LoadingSpinner";
import { useToast } from "../components/Toast";

const STATUSES = ["VACANT", "OCCUPIED", "MAINTENANCE"];
const TABS = ["All", "Vacant", "Occupied", "Maintenance"];
const PER_PAGE = 10;

const formatCurrency = (n) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

const emptyForm = {
  propertyId: "",
  unitNumber: "",
  bedrooms: "",
  bathrooms: "",
  sqft: "",
  rentAmount: "",
  status: "VACANT",
};

export default function Units() {
  const toast = useToast();
  const navigate = useNavigate();

  // Data state
  const [units, setUnits] = useState([]);
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);

  // UI state
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("All");
  const [page, setPage] = useState(1);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState(null);

  // ── Fetch data ──────────────────────────────────────────────
  const fetchUnits = async () => {
    try {
      const data = await api.getUnits();
      setUnits(data);
    } catch (err) {
      toast("Failed to load units", "error");
    }
  };

  const fetchProperties = async () => {
    try {
      const data = await api.getProperties();
      setProperties(data);
    } catch (err) {
      toast("Failed to load properties", "error");
    }
  };

  useEffect(() => {
    Promise.all([fetchUnits(), fetchProperties()]).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Derived data ────────────────────────────────────────────
  const counts = {
    All: units.length,
    Vacant: units.filter((u) => u.status === "VACANT").length,
    Occupied: units.filter((u) => u.status === "OCCUPIED").length,
    Maintenance: units.filter((u) => u.status === "MAINTENANCE").length,
  };

  const avgRent =
    units.length > 0
      ? units.reduce((sum, u) => sum + (Number(u.rentAmount) || 0), 0) / units.length
      : 0;

  const stats = [
    { label: "Total Units", value: units.length, color: "bg-blue-50 text-blue-700" },
    { label: "Vacant", value: counts.Vacant, color: "bg-green-50 text-green-700" },
    { label: "Occupied", value: counts.Occupied, color: "bg-purple-50 text-purple-700" },
    { label: "Average Rent", value: formatCurrency(avgRent), color: "bg-amber-50 text-amber-700" },
  ];

  // ── Filtering + Pagination ──────────────────────────────────
  const filtered = units
    .filter((u) => {
      if (activeTab === "Vacant") return u.status === "VACANT";
      if (activeTab === "Occupied") return u.status === "OCCUPIED";
      if (activeTab === "Maintenance") return u.status === "MAINTENANCE";
      return true;
    })
    .filter((u) => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        (u.unitNumber || "").toLowerCase().includes(q) ||
        (u.property?.name || "").toLowerCase().includes(q)
      );
    });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const safePage = Math.min(page, totalPages);
  const paginated = filtered.slice((safePage - 1) * PER_PAGE, safePage * PER_PAGE);

  // Reset page when filter/search changes
  useEffect(() => {
    setPage(1);
  }, [search, activeTab]);

  // ── Modal helpers ───────────────────────────────────────────
  const openAdd = () => {
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (unit) => {
    setEditing(unit);
    setForm({
      propertyId: unit.propertyId || unit.property?.id || "",
      unitNumber: unit.unitNumber || "",
      bedrooms: unit.bedrooms ?? "",
      bathrooms: unit.bathrooms ?? "",
      sqft: unit.sqft ?? "",
      rentAmount: unit.rentAmount ?? "",
      status: unit.status || "VACANT",
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditing(null);
    setForm(emptyForm);
  };

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        propertyId: form.propertyId,
        unitNumber: form.unitNumber,
        bedrooms: Number(form.bedrooms),
        bathrooms: Number(form.bathrooms),
        sqft: Number(form.sqft),
        rentAmount: Number(form.rentAmount),
        status: form.status,
      };

      if (editing) {
        await api.updateUnit(editing.id, payload);
        toast("Unit updated successfully");
      } else {
        await api.createUnit(payload);
        toast("Unit created successfully");
      }
      closeModal();
      await fetchUnits();
    } catch (err) {
      toast(err.message || "Failed to save unit", "error");
    } finally {
      setSaving(false);
    }
  };

  // ── Delete ──────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.deleteUnit(deleteTarget.id);
      toast("Unit deleted successfully");
      setDeleteTarget(null);
      await fetchUnits();
    } catch (err) {
      toast(err.message || "Failed to delete unit", "error");
    }
  };

  // ── Render ──────────────────────────────────────────────────
  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Units</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage individual rental units across all properties
          </p>
        </div>
        <button
          onClick={openAdd}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700 transition-colors cursor-pointer"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Unit
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1 border-b border-gray-200">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`inline-flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors cursor-pointer ${
              activeTab === tab
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
            }`}
          >
            {tab}
            <span
              className={`inline-flex items-center justify-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                activeTab === tab
                  ? "bg-blue-100 text-blue-700"
                  : "bg-gray-100 text-gray-500"
              }`}
            >
              {counts[tab]}
            </span>
          </button>
        ))}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-xl border border-gray-200 bg-white p-5">
            <p className="text-sm font-medium text-gray-500">{stat.label}</p>
            <p className="mt-2 text-3xl font-bold text-gray-900">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Table Card */}
      {units.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white">
          <EmptyState
            title="No units yet"
            description="Get started by adding your first rental unit."
            action="Add Unit"
            onAction={openAdd}
          />
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white">
          {/* Search Bar */}
          <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
            <div className="relative">
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              <input
                type="text"
                placeholder="Search by unit number or property..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-80 rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <p className="text-sm text-gray-500">
              {filtered.length} {filtered.length === 1 ? "unit" : "units"}
            </p>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50/50">
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Unit Number
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Property
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Bed / Bath
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Sq Ft
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Rent
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Status
                  </th>
                  <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {paginated.map((unit) => (
                  <tr
                    key={unit.id}
                    onClick={() => navigate(`/units/${unit.id}`)}
                    className="cursor-pointer hover:bg-gray-50/50 transition-colors"
                  >
                    <td className="px-5 py-4">
                      <p className="text-sm font-semibold text-gray-900">{unit.unitNumber}</p>
                    </td>
                    <td className="px-5 py-4">
                      <p className="text-sm text-gray-600">{unit.property?.name || "—"}</p>
                    </td>
                    <td className="px-5 py-4">
                      <p className="text-sm text-gray-600">
                        {unit.bedrooms} bed / {unit.bathrooms} bath
                      </p>
                    </td>
                    <td className="px-5 py-4">
                      <p className="text-sm text-gray-600">
                        {unit.sqft ? Number(unit.sqft).toLocaleString() : "—"}
                      </p>
                    </td>
                    <td className="px-5 py-4">
                      <p className="text-sm font-medium text-gray-900">
                        {formatCurrency(unit.rentAmount)}
                      </p>
                    </td>
                    <td className="px-5 py-4">
                      <StatusBadge status={unit.status} />
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openEdit(unit);
                          }}
                          className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors cursor-pointer"
                          title="Edit"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                            />
                          </svg>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteTarget(unit);
                          }}
                          className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors cursor-pointer"
                          title="Delete"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                            />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filtered.length === 0 && (
            <div className="py-12 text-center">
              <p className="text-sm text-gray-500">No units match your search.</p>
            </div>
          )}

          {/* Pagination Footer */}
          <div className="flex items-center justify-between border-t border-gray-200 px-5 py-3">
            <p className="text-sm text-gray-500">
              Showing{" "}
              <span className="font-medium">
                {filtered.length === 0 ? 0 : (safePage - 1) * PER_PAGE + 1}
              </span>
              {" "}to{" "}
              <span className="font-medium">
                {Math.min(safePage * PER_PAGE, filtered.length)}
              </span>
              {" "}of <span className="font-medium">{filtered.length}</span> units
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={safePage === 1}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                Previous
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  onClick={() => setPage(n)}
                  className={`rounded-lg border px-3 py-1.5 text-sm cursor-pointer ${
                    n === safePage
                      ? "border-blue-600 bg-blue-600 text-white"
                      : "border-gray-300 text-gray-500 hover:bg-gray-50"
                  }`}
                >
                  {n}
                </button>
              ))}
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage === totalPages}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Modal */}
      <Modal open={modalOpen} onClose={closeModal} title={editing ? "Edit Unit" : "Add Unit"}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Property</label>
            <select
              value={form.propertyId}
              onChange={(e) => handleChange("propertyId", e.target.value)}
              required
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">Select a property</option>
              {properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Unit Number</label>
            <input
              type="text"
              value={form.unitNumber}
              onChange={(e) => handleChange("unitNumber", e.target.value)}
              required
              placeholder="e.g. A-101"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Bedrooms</label>
              <input
                type="number"
                min="0"
                value={form.bedrooms}
                onChange={(e) => handleChange("bedrooms", e.target.value)}
                required
                placeholder="2"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Bathrooms</label>
              <input
                type="number"
                min="0"
                step="0.5"
                value={form.bathrooms}
                onChange={(e) => handleChange("bathrooms", e.target.value)}
                required
                placeholder="1"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Sq Ft</label>
              <input
                type="number"
                min="0"
                value={form.sqft}
                onChange={(e) => handleChange("sqft", e.target.value)}
                placeholder="850"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Rent Amount</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">$</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.rentAmount}
                onChange={(e) => handleChange("rentAmount", e.target.value)}
                required
                placeholder="1,200.00"
                className="w-full rounded-lg border border-gray-300 py-2 pl-7 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={form.status}
              onChange={(e) => handleChange("status", e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s.charAt(0) + s.slice(1).toLowerCase()}
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={closeModal}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
            >
              {saving ? "Saving..." : editing ? "Update Unit" : "Save Unit"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Unit"
        message={`Are you sure you want to delete unit "${deleteTarget?.unitNumber}"? This action cannot be undone.`}
      />
    </div>
  );
}
