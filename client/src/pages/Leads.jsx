import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import Modal from "../components/Modal";
import ConfirmDialog from "../components/ConfirmDialog";
import StatusBadge from "../components/StatusBadge";
import EmptyState from "../components/EmptyState";
import LoadingSpinner from "../components/LoadingSpinner";
import { useToast } from "../components/Toast";

const STATUSES = ["NEW", "CONTACTED", "SHOWING", "APPLIED", "CONVERTED", "LOST"];
const SOURCES = ["Website", "Zillow", "Apartments.com", "Referral", "Walk-in", "Social Media", "Other"];
const PER_PAGE = 10;

const PIPELINE_COLORS = {
  NEW: { active: "bg-blue-100 text-blue-700 ring-blue-600/20", dot: "bg-blue-500" },
  CONTACTED: { active: "bg-purple-100 text-purple-700 ring-purple-600/20", dot: "bg-purple-500" },
  SHOWING: { active: "bg-yellow-100 text-yellow-700 ring-yellow-600/20", dot: "bg-yellow-500" },
  APPLIED: { active: "bg-orange-100 text-orange-700 ring-orange-600/20", dot: "bg-orange-500" },
  CONVERTED: { active: "bg-green-100 text-green-700 ring-green-600/20", dot: "bg-green-500" },
  LOST: { active: "bg-gray-200 text-gray-600 ring-gray-500/20", dot: "bg-gray-400" },
};

const EMPTY_FORM = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  unitInterest: "",
  source: "",
  status: "NEW",
  notes: "",
};

const formatDate = (dateStr) => {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const getInitials = (firstName, lastName) => {
  const f = (firstName || "").charAt(0).toUpperCase();
  const l = (lastName || "").charAt(0).toUpperCase();
  return f + l || "?";
};

const isWithinLastWeek = (dateStr) => {
  if (!dateStr) return false;
  const date = new Date(dateStr);
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  return date >= weekAgo;
};

export default function Leads() {
  const toast = useToast();
  const navigate = useNavigate();

  // Data state
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);

  // UI state
  const [search, setSearch] = useState("");
  const [pipelineFilter, setPipelineFilter] = useState("ALL");
  const [page, setPage] = useState(1);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState(null);

  // ── Fetch data ──────────────────────────────────────────────
  const fetchLeads = async () => {
    try {
      const data = await api.getLeads();
      setLeads(data);
    } catch (err) {
      toast("Failed to load leads", "error");
    }
  };

  useEffect(() => {
    fetchLeads().finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Derived data ────────────────────────────────────────────
  const statusCounts = STATUSES.reduce((acc, s) => {
    acc[s] = leads.filter((l) => l.status === s).length;
    return acc;
  }, {});

  const newThisWeek = leads.filter((l) => isWithinLastWeek(l.createdAt)).length;
  const conversionRate =
    leads.length > 0
      ? ((statusCounts.CONVERTED / leads.length) * 100).toFixed(1)
      : "0.0";

  const stats = [
    { label: "Total Leads", value: leads.length, color: "bg-blue-50 text-blue-700" },
    { label: "New This Week", value: newThisWeek, color: "bg-green-50 text-green-700" },
    { label: "Conversion Rate", value: `${conversionRate}%`, color: "bg-purple-50 text-purple-700" },
    { label: "Lost", value: statusCounts.LOST || 0, color: "bg-gray-100 text-gray-600" },
  ];

  // ── Filtering + Pagination ──────────────────────────────────
  const filtered = leads
    .filter((l) => {
      if (pipelineFilter === "ALL") return true;
      return l.status === pipelineFilter;
    })
    .filter((l) => {
      if (!search) return true;
      const q = search.toLowerCase();
      const fullName = `${l.firstName || ""} ${l.lastName || ""}`.toLowerCase();
      return (
        fullName.includes(q) ||
        (l.email || "").toLowerCase().includes(q) ||
        (l.phone || "").toLowerCase().includes(q)
      );
    });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const safePage = Math.min(page, totalPages);
  const paginated = filtered.slice((safePage - 1) * PER_PAGE, safePage * PER_PAGE);

  // Reset page when filter/search changes
  useEffect(() => {
    setPage(1);
  }, [search, pipelineFilter]);

  // ── Modal helpers ───────────────────────────────────────────
  const openAdd = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  };

  const openEdit = (lead) => {
    setEditing(lead);
    setForm({
      firstName: lead.firstName || "",
      lastName: lead.lastName || "",
      email: lead.email || "",
      phone: lead.phone || "",
      unitInterest: lead.unitInterest || "",
      source: lead.source || "",
      status: lead.status || "NEW",
      notes: lead.notes || "",
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditing(null);
    setForm(EMPTY_FORM);
  };

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing) {
        await api.updateLead(editing.id, form);
        toast("Lead updated successfully");
      } else {
        await api.createLead(form);
        toast("Lead created successfully");
      }
      closeModal();
      await fetchLeads();
    } catch (err) {
      toast(err.message || "Failed to save lead", "error");
    } finally {
      setSaving(false);
    }
  };

  // ── Delete ──────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.deleteLead(deleteTarget.id);
      toast("Lead deleted successfully");
      setDeleteTarget(null);
      await fetchLeads();
    } catch (err) {
      toast(err.message || "Failed to delete lead", "error");
    }
  };

  // ── Render ──────────────────────────────────────────────────
  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Leads</h1>
          <p className="mt-1 text-sm text-gray-500">
            Track prospective tenants through your leasing pipeline
          </p>
        </div>
        <button
          onClick={openAdd}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700 transition-colors cursor-pointer"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Lead
        </button>
      </div>

      {/* Pipeline Summary Bar */}
      <div className="rounded-xl border border-gray-200 bg-white px-5 py-3">
        <div className="flex items-center gap-2 overflow-x-auto">
          <button
            onClick={() => setPipelineFilter("ALL")}
            className={`inline-flex items-center gap-2 whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-medium ring-1 ring-inset transition-colors cursor-pointer ${
              pipelineFilter === "ALL"
                ? "bg-blue-100 text-blue-700 ring-blue-600/20"
                : "bg-gray-50 text-gray-500 ring-gray-200 hover:bg-gray-100"
            }`}
          >
            All
            <span className={`inline-flex items-center justify-center rounded-full px-1.5 text-xs font-semibold ${
              pipelineFilter === "ALL" ? "bg-blue-200/60 text-blue-800" : "bg-gray-200 text-gray-600"
            }`}>
              {leads.length}
            </span>
          </button>
          {STATUSES.map((status) => {
            const isActive = pipelineFilter === status;
            const colors = PIPELINE_COLORS[status];
            return (
              <button
                key={status}
                onClick={() => setPipelineFilter(status)}
                className={`inline-flex items-center gap-2 whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-medium ring-1 ring-inset transition-colors cursor-pointer ${
                  isActive
                    ? colors.active
                    : "bg-gray-50 text-gray-500 ring-gray-200 hover:bg-gray-100"
                }`}
              >
                <span className={`h-2 w-2 rounded-full ${isActive ? colors.dot : "bg-gray-300"}`} />
                {status.charAt(0) + status.slice(1).toLowerCase()}
                <span className={`inline-flex items-center justify-center rounded-full px-1.5 text-xs font-semibold ${
                  isActive ? "bg-white/40 text-current" : "bg-gray-200 text-gray-600"
                }`}>
                  {statusCounts[status] || 0}
                </span>
              </button>
            );
          })}
        </div>
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
      {leads.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white">
          <EmptyState
            icon="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
            title="No leads yet"
            description="Start tracking prospective tenants by adding your first lead to the pipeline."
            action="Add your first lead"
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
                placeholder="Search by name, email, or phone..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-80 rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <p className="text-sm text-gray-500">
              {filtered.length} {filtered.length === 1 ? "lead" : "leads"}
            </p>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50/50">
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Name
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Email
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Phone
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Interested In
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Source
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Status
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Added
                  </th>
                  <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {paginated.map((lead) => (
                  <tr
                    key={lead.id}
                    onClick={() => navigate(`/leads/${lead.id}`)}
                    className="cursor-pointer hover:bg-gray-50/50 transition-colors"
                  >
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-700">
                          {getInitials(lead.firstName, lead.lastName)}
                        </div>
                        <p className="text-sm font-semibold text-gray-900">
                          {lead.firstName} {lead.lastName}
                        </p>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <p className="text-sm text-gray-600">{lead.email || "—"}</p>
                    </td>
                    <td className="px-5 py-4">
                      <p className="text-sm text-gray-600">{lead.phone || "—"}</p>
                    </td>
                    <td className="px-5 py-4">
                      <p className="text-sm text-gray-600">{lead.unitInterest || "—"}</p>
                    </td>
                    <td className="px-5 py-4">
                      {lead.source ? (
                        <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700">
                          {lead.source}
                        </span>
                      ) : (
                        <span className="text-sm text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <StatusBadge status={lead.status} />
                    </td>
                    <td className="px-5 py-4">
                      <p className="text-sm text-gray-500">{formatDate(lead.createdAt)}</p>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openEdit(lead);
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
                            setDeleteTarget(lead);
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
              <p className="text-sm text-gray-500">No leads match your search.</p>
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
              {" "}of <span className="font-medium">{filtered.length}</span> leads
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
      <Modal open={modalOpen} onClose={closeModal} title={editing ? "Edit Lead" : "Add Lead"} wide>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Row 1: First Name, Last Name */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
              <input
                type="text"
                value={form.firstName}
                onChange={(e) => handleChange("firstName", e.target.value)}
                required
                placeholder="John"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
              <input
                type="text"
                value={form.lastName}
                onChange={(e) => handleChange("lastName", e.target.value)}
                required
                placeholder="Doe"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Row 2: Email, Phone */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => handleChange("email", e.target.value)}
                required
                placeholder="john@example.com"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => handleChange("phone", e.target.value)}
                placeholder="(555) 123-4567"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Row 3: Unit Interest, Source */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Unit Interest</label>
              <input
                type="text"
                value={form.unitInterest}
                onChange={(e) => handleChange("unitInterest", e.target.value)}
                placeholder="e.g. 2BR in Sunset Ridge"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Source</label>
              <select
                value={form.source}
                onChange={(e) => handleChange("source", e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">Select source</option>
                {SOURCES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Row 4: Status */}
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

          {/* Row 5: Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              value={form.notes}
              onChange={(e) => handleChange("notes", e.target.value)}
              rows={3}
              placeholder="Any additional details about this lead..."
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
            />
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
              {saving ? "Saving..." : editing ? "Update Lead" : "Save Lead"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Lead"
        message={`Are you sure you want to delete "${deleteTarget?.firstName} ${deleteTarget?.lastName}"? This action cannot be undone.`}
      />
    </div>
  );
}
