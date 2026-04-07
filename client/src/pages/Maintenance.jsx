import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import Modal from "../components/Modal";
import ConfirmDialog from "../components/ConfirmDialog";
import StatusBadge from "../components/StatusBadge";
import EmptyState from "../components/EmptyState";
import LoadingSpinner from "../components/LoadingSpinner";
import { useToast } from "../components/Toast";

const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "EMERGENCY"];
const STATUSES = ["OPEN", "IN_PROGRESS", "COMPLETED"];
const TABS = ["All", "Open", "In Progress", "Completed"];
const TAB_STATUS_MAP = { Open: "OPEN", "In Progress": "IN_PROGRESS", Completed: "COMPLETED" };

const EMPTY_FORM = {
  unitId: "",
  tenantId: "",
  title: "",
  description: "",
  priority: "MEDIUM",
  status: "OPEN",
  vendorNotes: "",
};

const PAGE_SIZE = 10;

function formatDate(dateStr) {
  if (!dateStr) return null;
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function truncate(str, max) {
  if (!str) return "";
  return str.length > max ? str.slice(0, max) + "..." : str;
}

function getInitials(firstName, lastName) {
  return ((firstName?.[0] || "") + (lastName?.[0] || "")).toUpperCase();
}

export default function Maintenance() {
  const toast = useToast();
  const navigate = useNavigate();

  const [requests, setRequests] = useState([]);
  const [units, setUnits] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("All");
  const [page, setPage] = useState(1);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState(null);

  // ---- Data fetching ----
  const fetchRequests = async () => {
    try {
      const data = await api.getMaintenanceRequests();
      setRequests(data);
    } catch (err) {
      toast("Failed to load maintenance requests", "error");
    } finally {
      setLoading(false);
    }
  };

  const fetchDropdownData = async () => {
    try {
      const [unitData, tenantData] = await Promise.all([
        api.getUnits(),
        api.getTenants(),
      ]);
      setUnits(unitData);
      setTenants(tenantData);
    } catch {
      // silently fail — dropdowns will be empty
    }
  };

  useEffect(() => {
    fetchRequests();
    fetchDropdownData();
  }, []);

  // ---- Computed stats ----
  const openCount = requests.filter((r) => r.status === "OPEN").length;
  const inProgressCount = requests.filter((r) => r.status === "IN_PROGRESS").length;
  const completedCount = requests.filter((r) => r.status === "COMPLETED").length;
  const emergencyCount = requests.filter((r) => r.priority === "EMERGENCY").length;

  const tabCounts = {
    All: requests.length,
    Open: openCount,
    "In Progress": inProgressCount,
    Completed: completedCount,
  };

  const stats = [
    { label: "Open Requests", value: openCount, accent: "border-l-red-500", textColor: "text-red-700" },
    { label: "In Progress", value: inProgressCount, accent: "border-l-yellow-500", textColor: "text-yellow-700" },
    { label: "Completed", value: completedCount, accent: "border-l-green-500", textColor: "text-green-700" },
    { label: "Emergency", value: emergencyCount, accent: "border-l-red-500", textColor: "text-red-700", bold: true },
  ];

  // ---- Filtering ----
  const tabFiltered = activeTab === "All"
    ? requests
    : requests.filter((r) => r.status === TAB_STATUS_MAP[activeTab]);

  const filtered = tabFiltered.filter((r) => {
    const q = search.toLowerCase();
    if (!q) return true;
    const tenantName = `${r.tenant?.firstName || ""} ${r.tenant?.lastName || ""}`.toLowerCase();
    const unitNumber = (r.unit?.unitNumber || "").toLowerCase();
    const title = (r.title || "").toLowerCase();
    return title.includes(q) || tenantName.includes(q) || unitNumber.includes(q);
  });

  // ---- Pagination ----
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginated = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [activeTab, search]);

  // ---- Form helpers ----
  const openAdd = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  };

  const openEdit = (request) => {
    setEditing(request);
    setForm({
      unitId: request.unitId || "",
      tenantId: request.tenantId || "",
      title: request.title || "",
      description: request.description || "",
      priority: request.priority || "MEDIUM",
      status: request.status || "OPEN",
      vendorNotes: request.vendorNotes || "",
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
      const payload = { ...form };

      // Auto-set completedAt when status changes to COMPLETED
      if (payload.status === "COMPLETED" && editing?.status !== "COMPLETED") {
        payload.completedAt = new Date().toISOString();
      }
      // Clear completedAt if moving away from COMPLETED
      if (payload.status !== "COMPLETED") {
        payload.completedAt = null;
      }

      if (editing) {
        await api.updateMaintenanceRequest(editing.id, payload);
        toast("Maintenance request updated successfully", "success");
      } else {
        await api.createMaintenanceRequest(payload);
        toast("Maintenance request created successfully", "success");
      }
      closeModal();
      await fetchRequests();
    } catch (err) {
      toast(err.message || "Failed to save maintenance request", "error");
    } finally {
      setSaving(false);
    }
  };

  // ---- Delete helpers ----
  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.deleteMaintenanceRequest(deleteTarget.id);
      toast("Maintenance request deleted successfully", "success");
      setDeleteTarget(null);
      await fetchRequests();
    } catch (err) {
      toast(err.message || "Failed to delete maintenance request", "error");
    }
  };

  // ---- Loading state ----
  if (loading) return <LoadingSpinner />;

  // ---- Empty state ----
  if (requests.length === 0 && !search) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Maintenance</h1>
            <p className="mt-1 text-sm text-gray-500">Track and manage work orders and maintenance requests</p>
          </div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white">
          <EmptyState
            icon="M11.42 15.17l-5.1-5.1m0 0L11.42 5m-5.1 5.07h11.27M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            title="No maintenance requests yet"
            description="Get started by creating your first maintenance request to track work orders."
            action="Create first request"
            onAction={openAdd}
          />
        </div>

        {/* Add Modal (available even from empty state) */}
        <Modal open={modalOpen} onClose={closeModal} title="New Maintenance Request" wide>
          <RequestForm
            form={form}
            onChange={handleChange}
            onSubmit={handleSubmit}
            onCancel={closeModal}
            saving={saving}
            editing={editing}
            units={units}
            tenants={tenants}
          />
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
          <h1 className="text-2xl font-bold text-gray-900">Maintenance</h1>
          <p className="mt-1 text-sm text-gray-500">Track and manage work orders and maintenance requests</p>
        </div>
        <button
          onClick={openAdd}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700 transition-colors cursor-pointer"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Request
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors cursor-pointer ${
              activeTab === tab
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            {tab}
            <span
              className={`inline-flex items-center justify-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                activeTab === tab
                  ? "bg-blue-100 text-blue-700"
                  : "bg-gray-200 text-gray-600"
              }`}
            >
              {tabCounts[tab]}
            </span>
          </button>
        ))}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className={`rounded-xl border border-gray-200 border-l-4 ${stat.accent} bg-white p-5`}
          >
            <p className="text-sm font-medium text-gray-500">{stat.label}</p>
            <p className={`mt-2 text-3xl ${stat.bold ? "font-extrabold" : "font-bold"} ${stat.textColor}`}>
              {stat.value}
            </p>
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
              placeholder="Search by title, tenant, or unit..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-80 rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50/50">
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Title</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Unit</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Tenant</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Priority</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Status</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Submitted</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Completed</th>
                <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {paginated.map((request) => (
                <tr
                  key={request.id}
                  onClick={() => navigate(`/maintenance/${request.id}`)}
                  className={`cursor-pointer hover:bg-gray-50/50 transition-colors ${
                    request.priority === "EMERGENCY" ? "bg-red-50/50" : ""
                  }`}
                >
                  <td className="px-5 py-4">
                    <p className="text-sm font-semibold text-gray-900">{request.title}</p>
                    {request.description && (
                      <p className="text-xs text-gray-400 mt-0.5">{truncate(request.description, 60)}</p>
                    )}
                  </td>
                  <td className="px-5 py-4 text-sm text-gray-600">
                    {request.unit?.unitNumber || "\u2014"}
                  </td>
                  <td className="px-5 py-4">
                    {request.tenant ? (
                      <div className="flex items-center gap-2">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-700">
                          {getInitials(request.tenant.firstName, request.tenant.lastName)}
                        </div>
                        <span className="text-sm text-gray-600">
                          {request.tenant.firstName} {request.tenant.lastName}
                        </span>
                      </div>
                    ) : (
                      <span className="text-sm text-gray-400">{"\u2014"}</span>
                    )}
                  </td>
                  <td className="px-5 py-4">
                    <StatusBadge status={request.priority} />
                  </td>
                  <td className="px-5 py-4">
                    <StatusBadge status={request.status} />
                  </td>
                  <td className="px-5 py-4 text-sm text-gray-600">
                    {formatDate(request.createdAt) || "\u2014"}
                  </td>
                  <td className="px-5 py-4 text-sm text-gray-600">
                    {formatDate(request.completedAt) || "\u2014"}
                  </td>
                  <td className="px-5 py-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openEdit(request);
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
                          setDeleteTarget(request);
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
              ))}
            </tbody>
          </table>
        </div>

        {/* Table Footer / Pagination */}
        <div className="flex items-center justify-between border-t border-gray-200 px-5 py-3">
          <p className="text-sm text-gray-500">
            Showing{" "}
            <span className="font-medium">
              {filtered.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1}
            </span>{" "}
            to{" "}
            <span className="font-medium">
              {Math.min(safePage * PAGE_SIZE, filtered.length)}
            </span>{" "}
            of <span className="font-medium">{filtered.length}</span> requests
          </p>
          {totalPages > 1 && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={safePage <= 1}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                Previous
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium cursor-pointer ${
                    p === safePage
                      ? "bg-blue-600 text-white"
                      : "text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  {p}
                </button>
              ))}
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage >= totalPages}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                Next
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Add / Edit Modal */}
      <Modal open={modalOpen} onClose={closeModal} title={editing ? "Edit Maintenance Request" : "New Maintenance Request"} wide>
        <RequestForm
          form={form}
          onChange={handleChange}
          onSubmit={handleSubmit}
          onCancel={closeModal}
          saving={saving}
          editing={editing}
          units={units}
          tenants={tenants}
        />
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Request"
        message={`Are you sure you want to delete "${deleteTarget?.title}"? This action cannot be undone.`}
      />
    </div>
  );
}

// ---- Extracted form component ----
function RequestForm({ form, onChange, onSubmit, onCancel, saving, editing, units, tenants }) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {/* Row 1: Unit + Tenant */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
          <select
            name="unitId"
            value={form.unitId}
            onChange={onChange}
            required
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">Select a unit</option>
            {units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.unitNumber} {u.property?.name ? `\u2014 ${u.property.name}` : ""}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Tenant</label>
          <select
            name="tenantId"
            value={form.tenantId}
            onChange={onChange}
            required
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">Select a tenant</option>
            {tenants.map((t) => (
              <option key={t.id} value={t.id}>
                {t.firstName} {t.lastName}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Row 2: Title */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
        <input
          type="text"
          name="title"
          value={form.title}
          onChange={onChange}
          required
          placeholder="e.g. Leaking kitchen faucet"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      {/* Row 3: Description */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
        <textarea
          name="description"
          value={form.description}
          onChange={onChange}
          rows={3}
          placeholder="Describe the issue in detail..."
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
        />
      </div>

      {/* Row 4: Priority + Status */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
          <select
            name="priority"
            value={form.priority}
            onChange={onChange}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {p.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
          <select
            name="status"
            value={form.status}
            onChange={onChange}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Row 5: Vendor Notes */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Vendor Notes <span className="text-gray-400 font-normal">(optional)</span>
        </label>
        <textarea
          name="vendorNotes"
          value={form.vendorNotes}
          onChange={onChange}
          rows={2}
          placeholder="Internal notes for vendor coordination..."
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
        />
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 cursor-pointer"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
        >
          {saving ? "Saving..." : editing ? "Update Request" : "Create Request"}
        </button>
      </div>
    </form>
  );
}
