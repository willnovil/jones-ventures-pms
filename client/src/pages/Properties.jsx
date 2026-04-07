import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import Modal from "../components/Modal";
import ConfirmDialog from "../components/ConfirmDialog";
import EmptyState from "../components/EmptyState";
import LoadingSpinner from "../components/LoadingSpinner";
import { useToast } from "../components/Toast";

const PROPERTY_TYPES = [
  "Apartment",
  "Townhome",
  "Duplex",
  "Villa",
  "Single Family",
  "Condo",
  "Mixed Use",
];

const EMPTY_FORM = {
  name: "",
  address: "",
  city: "",
  state: "",
  zip: "",
  type: "Apartment",
};

export default function Properties() {
  const toast = useToast();
  const navigate = useNavigate();

  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null); // null = add, object = edit
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState(null);

  // ---- Data fetching ----
  const fetchProperties = async () => {
    try {
      const data = await api.getProperties();
      setProperties(data);
    } catch (err) {
      toast("Failed to load properties", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProperties();
  }, []);

  // ---- Computed stats ----
  const totalUnits = properties.reduce((sum, p) => sum + (p.units?.length || 0), 0);
  const occupiedUnits = properties.reduce(
    (sum, p) => sum + (p.units?.filter((u) => u.status === "OCCUPIED").length || 0),
    0
  );
  const vacancyRate = totalUnits > 0 ? (((totalUnits - occupiedUnits) / totalUnits) * 100).toFixed(1) : "0.0";

  const stats = [
    { label: "Total Properties", value: properties.length, color: "bg-blue-50 text-blue-700" },
    { label: "Total Units", value: totalUnits, color: "bg-green-50 text-green-700" },
    { label: "Occupied", value: occupiedUnits, color: "bg-purple-50 text-purple-700" },
    { label: "Vacancy Rate", value: `${vacancyRate}%`, color: "bg-amber-50 text-amber-700" },
  ];

  // ---- Filtering ----
  const filtered = properties
    .filter((p) => {
      if (typeFilter && p.type !== typeFilter) return false;
      return true;
    })
    .filter(
      (p) =>
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.city.toLowerCase().includes(search.toLowerCase())
    );

  // ---- Form helpers ----
  const openAdd = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  };

  const openEdit = (property) => {
    setEditing(property);
    setForm({
      name: property.name,
      address: property.address,
      city: property.city,
      state: property.state,
      zip: property.zip,
      type: property.type,
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditing(null);
    setForm(EMPTY_FORM);
  };

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing) {
        await api.updateProperty(editing.id, form);
        toast("Property updated successfully", "success");
      } else {
        await api.createProperty(form);
        toast("Property created successfully", "success");
      }
      closeModal();
      await fetchProperties();
    } catch (err) {
      toast(err.message || "Failed to save property", "error");
    } finally {
      setSaving(false);
    }
  };

  // ---- Delete helpers ----
  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.deleteProperty(deleteTarget.id);
      toast("Property deleted successfully", "success");
      setDeleteTarget(null);
      await fetchProperties();
    } catch (err) {
      toast(err.message || "Failed to delete property", "error");
    }
  };

  // ---- Occupancy helpers ----
  const getOccupancy = (property) => {
    const total = property.units?.length || 0;
    const occupied = property.units?.filter((u) => u.status === "OCCUPIED").length || 0;
    const pct = total > 0 ? Math.round((occupied / total) * 100) : 0;
    return { total, occupied, pct };
  };

  // ---- Loading state ----
  if (loading) return <LoadingSpinner />;

  // ---- Empty state ----
  if (properties.length === 0 && !search) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Properties</h1>
            <p className="mt-1 text-sm text-gray-500">Manage your rental properties across all locations.</p>
          </div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white">
          <EmptyState
            icon="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
            title="No properties yet"
            description="Get started by adding your first property to manage units, tenants, and leases."
            action="Add your first property"
            onAction={openAdd}
          />
        </div>

        {/* Add Modal (available even from empty state) */}
        <Modal open={modalOpen} onClose={closeModal} title="Add Property">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Property Name</label>
              <input
                type="text"
                name="name"
                value={form.name}
                onChange={handleChange}
                required
                placeholder="e.g. Sunset Ridge Apartments"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
              <input
                type="text"
                name="address"
                value={form.address}
                onChange={handleChange}
                required
                placeholder="Street address"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                <input
                  type="text"
                  name="city"
                  value={form.city}
                  onChange={handleChange}
                  required
                  placeholder="City"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                <input
                  type="text"
                  name="state"
                  value={form.state}
                  onChange={handleChange}
                  required
                  placeholder="TX"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Zip</label>
                <input
                  type="text"
                  name="zip"
                  value={form.zip}
                  onChange={handleChange}
                  required
                  placeholder="78701"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Property Type</label>
              <select
                name="type"
                value={form.type}
                onChange={handleChange}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {PROPERTY_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
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
                {saving ? "Saving..." : "Save Property"}
              </button>
            </div>
          </form>
        </Modal>
      </div>
    );
  }

  // ---- Main render ----
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Properties</h1>
          <p className="mt-1 text-sm text-gray-500">Manage your rental properties across all locations.</p>
        </div>
        <button
          onClick={openAdd}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700 transition-colors cursor-pointer"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Property
        </button>
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
      <div className="rounded-xl border border-gray-200 bg-white">
        {/* Table Toolbar */}
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search properties..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-72 rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">All Types</option>
              {PROPERTY_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <button
              onClick={() => {
                const headers = ["Name", "Address", "City", "State", "Zip", "Type", "Units", "Occupied"];
                const rows = filtered.map((p) => {
                  const occ = getOccupancy(p);
                  return [p.name, p.address, p.city, p.state, p.zip, p.type, occ.total, occ.occupied];
                });
                const csv = [headers, ...rows].map((r) => r.map((v) => `"${v}"`).join(",")).join("\n");
                const blob = new Blob([csv], { type: "text/csv" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = "properties.csv";
                a.click();
                URL.revokeObjectURL(url);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Export
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50/50">
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Property Name</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Address</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Type</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Units</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Occupancy</th>
                <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((property) => {
                const { total, occupied, pct } = getOccupancy(property);
                return (
                  <tr
                    key={property.id}
                    onClick={() => navigate(`/properties/${property.id}`)}
                    className="cursor-pointer hover:bg-gray-50/50 transition-colors"
                  >
                    <td className="px-5 py-4">
                      <p className="text-sm font-semibold text-gray-900">{property.name}</p>
                    </td>
                    <td className="px-5 py-4">
                      <p className="text-sm text-gray-600">{property.address}</p>
                      <p className="text-xs text-gray-400">{property.city}, {property.state} {property.zip}</p>
                    </td>
                    <td className="px-5 py-4">
                      <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700">
                        {property.type}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-sm text-gray-600">{total}</td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-2 w-24 overflow-hidden rounded-full bg-gray-100">
                          <div
                            className="h-full rounded-full bg-green-500 transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-xs font-medium text-gray-600">
                          {occupied}/{total}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openEdit(property);
                          }}
                          className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors cursor-pointer"
                          title="Edit"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteTarget(property);
                          }}
                          className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors cursor-pointer"
                          title="Delete"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Table Footer */}
        <div className="flex items-center justify-between border-t border-gray-200 px-5 py-3">
          <p className="text-sm text-gray-500">
            Showing <span className="font-medium">{filtered.length}</span> of{" "}
            <span className="font-medium">{properties.length}</span> properties
          </p>
        </div>
      </div>

      {/* Add / Edit Modal */}
      <Modal open={modalOpen} onClose={closeModal} title={editing ? "Edit Property" : "Add Property"}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Property Name</label>
            <input
              type="text"
              name="name"
              value={form.name}
              onChange={handleChange}
              required
              placeholder="e.g. Sunset Ridge Apartments"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
            <input
              type="text"
              name="address"
              value={form.address}
              onChange={handleChange}
              required
              placeholder="Street address"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
              <input
                type="text"
                name="city"
                value={form.city}
                onChange={handleChange}
                required
                placeholder="City"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
              <input
                type="text"
                name="state"
                value={form.state}
                onChange={handleChange}
                required
                placeholder="TX"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Zip</label>
              <input
                type="text"
                name="zip"
                value={form.zip}
                onChange={handleChange}
                required
                placeholder="78701"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Property Type</label>
            <select
              name="type"
              value={form.type}
              onChange={handleChange}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {PROPERTY_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
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
              {saving ? "Saving..." : editing ? "Update Property" : "Save Property"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Property"
        message={`Are you sure you want to delete "${deleteTarget?.name}"? This action cannot be undone and will remove all associated units and data.`}
      />
    </div>
  );
}
