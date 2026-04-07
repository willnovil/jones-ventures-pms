import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import Modal from "../components/Modal";
import ConfirmDialog from "../components/ConfirmDialog";
import StatusBadge from "../components/StatusBadge";
import EmptyState from "../components/EmptyState";
import LoadingSpinner from "../components/LoadingSpinner";
import { useToast } from "../components/Toast";

const ITEMS_PER_PAGE = 10;

const TABS = ["All", "Draft", "Review", "Approved", "Sent", "Active", "Archived"];

const TAB_STATUSES = {
  All: null,
  Draft: ["DRAFT"],
  Review: ["PENDING_REVIEW"],
  Approved: ["APPROVED"],
  Sent: ["SENT"],
  Active: ["ACTIVE"],
  Archived: ["EXPIRED", "TERMINATED"],
};

const INITIAL_FORM = {
  tenantId: "",
  unitId: "",
  startDate: "",
  endDate: "",
  rentAmount: "",
  depositAmount: "",
  depositPaid: false,
  status: "DRAFT",
  signatureStatus: "PENDING",
};

function formatDate(d) {
  return new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatCurrency(n) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(n);
}

function getInitials(firstName, lastName) {
  return `${(firstName || "")[0] || ""}${(lastName || "")[0] || ""}`.toUpperCase();
}

export default function Leases() {
  const addToast = useToast();
  const navigate = useNavigate();

  const [leases, setLeases] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("All");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(INITIAL_FORM);
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState(null);

  // --- Data fetching ---

  async function fetchLeases() {
    try {
      const data = await api.getLeases();
      setLeases(data);
    } catch {
      addToast("Failed to load leases", "error");
    }
  }

  async function fetchDropdowns() {
    try {
      const [t, u] = await Promise.all([api.getTenants(), api.getUnits()]);
      setTenants(t);
      setUnits(u);
    } catch {
      // silent — dropdowns will be empty
    }
  }

  useEffect(() => {
    async function load() {
      setLoading(true);
      await Promise.all([fetchLeases(), fetchDropdowns()]);
      setLoading(false);
    }
    load();
  }, []);

  // --- Filtering & search ---

  const filtered = leases.filter((l) => {
    const allowed = TAB_STATUSES[activeTab];
    if (allowed && !allowed.includes(l.status)) return false;
    if (search) {
      const q = search.toLowerCase();
      const tenantName = l.tenant
        ? `${l.tenant.firstName} ${l.tenant.lastName}`.toLowerCase()
        : "";
      const unitNum = l.unit ? l.unit.unitNumber?.toLowerCase() : "";
      if (!tenantName.includes(q) && !unitNum.includes(q)) return false;
    }
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const paginated = filtered.slice(
    (page - 1) * ITEMS_PER_PAGE,
    page * ITEMS_PER_PAGE
  );

  // Reset page when filter/search changes
  useEffect(() => {
    setPage(1);
  }, [activeTab, search]);

  // --- Stats ---

  const totalLeases = leases.length;
  const activeLeases = leases.filter((l) => l.status === "ACTIVE");
  const activeCount = activeLeases.length;

  const now = new Date();
  const thirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const expiringCount = activeLeases.filter((l) => {
    const end = new Date(l.endDate);
    return end >= now && end <= thirtyDays;
  }).length;

  const totalMonthlyRent = activeLeases.reduce(
    (sum, l) => sum + (Number(l.rentAmount) || 0),
    0
  );

  // --- Tab counts ---

  const tabCounts = TABS.reduce((acc, tab) => {
    const allowed = TAB_STATUSES[tab];
    acc[tab] = allowed
      ? leases.filter((l) => allowed.includes(l.status)).length
      : leases.length;
    return acc;
  }, {});

  // --- Modal handlers ---

  function openNew() {
    setEditing(null);
    setForm(INITIAL_FORM);
    setModalOpen(true);
  }

  function openEdit(lease) {
    setEditing(lease);
    setForm({
      tenantId: lease.tenantId || "",
      unitId: lease.unitId || "",
      startDate: lease.startDate ? lease.startDate.slice(0, 10) : "",
      endDate: lease.endDate ? lease.endDate.slice(0, 10) : "",
      rentAmount: lease.rentAmount ?? "",
      depositAmount: lease.depositAmount ?? "",
      depositPaid: lease.depositPaid ?? false,
      status: lease.status || "DRAFT",
      signatureStatus: lease.signatureStatus || "PENDING",
    });
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditing(null);
    setForm(INITIAL_FORM);
  }

  function handleChange(e) {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...form,
        rentAmount: Number(form.rentAmount),
        depositAmount: Number(form.depositAmount),
        startDate: new Date(form.startDate).toISOString(),
        endDate: new Date(form.endDate).toISOString(),
      };
      if (editing) {
        await api.updateLease(editing.id, payload);
        addToast("Lease updated successfully");
      } else {
        await api.createLease(payload);
        addToast("Lease created successfully");
      }
      await fetchLeases();
      closeModal();
    } catch {
      addToast(editing ? "Failed to update lease" : "Failed to create lease", "error");
    } finally {
      setSaving(false);
    }
  }

  // --- Delete handlers ---

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await api.deleteLease(deleteTarget.id);
      addToast("Lease deleted successfully");
      await fetchLeases();
    } catch {
      addToast("Failed to delete lease", "error");
    } finally {
      setDeleteTarget(null);
    }
  }

  // --- Render ---

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Leases</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage lease agreements and track signatures.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate("/leases/add-existing")}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
            title="For leases signed outside this system"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            Add Existing
          </button>
          <button
            onClick={openNew}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors cursor-pointer"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
            New Lease
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors cursor-pointer ${
              activeTab === tab
                ? "border-b-2 border-blue-600 text-blue-600"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab}
            <span
              className={`ml-2 inline-flex items-center justify-center rounded-full px-2 py-0.5 text-xs font-medium ${
                activeTab === tab
                  ? "bg-blue-100 text-blue-700"
                  : "bg-gray-100 text-gray-600"
              }`}
            >
              {tabCounts[tab]}
            </span>
          </button>
        ))}
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            label: "Total Leases",
            value: totalLeases,
            color: "text-gray-900",
            bg: "bg-gray-50",
          },
          {
            label: "Active",
            value: activeCount,
            color: "text-green-700",
            bg: "bg-green-50",
          },
          {
            label: "Expiring in 30 Days",
            value: expiringCount,
            color: "text-orange-700",
            bg: "bg-orange-50",
          },
          {
            label: "Total Monthly Rent",
            value: formatCurrency(totalMonthlyRent),
            color: "text-blue-700",
            bg: "bg-blue-50",
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl border border-gray-200 bg-white p-5"
          >
            <p className="text-sm font-medium text-gray-500">{stat.label}</p>
            <p className={`mt-1 text-2xl font-bold ${stat.color}`}>
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      {/* Table Card */}
      {leases.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white">
          <EmptyState
            title="No leases yet"
            description="Create your first lease to start tracking agreements and signatures."
            action="New Lease"
            onAction={openNew}
          />
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white">
          {/* Search */}
          <div className="border-b border-gray-200 px-5 py-4">
            <div className="relative max-w-sm">
              <svg
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
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
                placeholder="Search by tenant or unit..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-4 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50/50">
                  <th className="px-5 py-3 font-medium text-gray-500">Tenant</th>
                  <th className="px-5 py-3 font-medium text-gray-500">Unit</th>
                  <th className="px-5 py-3 font-medium text-gray-500">Lease Term</th>
                  <th className="px-5 py-3 font-medium text-gray-500">Rent</th>
                  <th className="px-5 py-3 font-medium text-gray-500">Deposit</th>
                  <th className="px-5 py-3 font-medium text-gray-500">Status</th>
                  <th className="px-5 py-3 font-medium text-gray-500">Signature</th>
                  <th className="px-5 py-3 font-medium text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {paginated.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-5 py-10 text-center text-sm text-gray-500">
                      No leases match your search.
                    </td>
                  </tr>
                ) : (
                  paginated.map((lease) => {
                    const tenantFirst = lease.tenant?.firstName || "";
                    const tenantLast = lease.tenant?.lastName || "";
                    const tenantName = `${tenantFirst} ${tenantLast}`.trim() || "—";
                    const initials = getInitials(tenantFirst, tenantLast);
                    const unitNum = lease.unit?.unitNumber || "—";

                    return (
                      <tr
                        key={lease.id}
                        onClick={() => navigate(`/leases/${lease.id}`)}
                        className="cursor-pointer hover:bg-gray-50/50 transition-colors"
                      >
                        {/* Tenant */}
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">
                              {initials}
                            </div>
                            <span className="font-medium text-gray-900">{tenantName}</span>
                          </div>
                        </td>

                        {/* Unit */}
                        <td className="px-5 py-3.5 text-gray-700">{unitNum}</td>

                        {/* Lease Term */}
                        <td className="px-5 py-3.5 text-gray-700">
                          {lease.startDate && lease.endDate
                            ? `${formatDate(lease.startDate)} — ${formatDate(lease.endDate)}`
                            : "—"}
                        </td>

                        {/* Rent */}
                        <td className="px-5 py-3.5 font-medium text-gray-900">
                          {formatCurrency(lease.rentAmount || 0)}
                        </td>

                        {/* Deposit */}
                        <td className="px-5 py-3.5">
                          <div>
                            <span className="text-gray-700">
                              {formatCurrency(lease.depositAmount || 0)}
                            </span>
                            <span
                              className={`ml-2 text-xs font-semibold ${
                                lease.depositPaid ? "text-green-600" : "text-red-600"
                              }`}
                            >
                              {lease.depositPaid ? "Paid" : "Unpaid"}
                            </span>
                          </div>
                        </td>

                        {/* Status */}
                        <td className="px-5 py-3.5">
                          <StatusBadge status={lease.status} />
                        </td>

                        {/* Signature */}
                        <td className="px-5 py-3.5">
                          <StatusBadge status={lease.signatureStatus} />
                        </td>

                        {/* Actions */}
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                openEdit(lease);
                              }}
                              className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors cursor-pointer"
                              title="Edit"
                            >
                              <svg
                                className="w-4 h-4"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
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
                                setDeleteTarget(lease);
                              }}
                              className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors cursor-pointer"
                              title="Delete"
                            >
                              <svg
                                className="w-4 h-4"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
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
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          {filtered.length > ITEMS_PER_PAGE && (
            <div className="flex items-center justify-between border-t border-gray-200 px-5 py-3.5">
              <p className="text-sm text-gray-500">
                Showing{" "}
                <span className="font-medium text-gray-700">
                  {(page - 1) * ITEMS_PER_PAGE + 1}
                </span>{" "}
                to{" "}
                <span className="font-medium text-gray-700">
                  {Math.min(page * ITEMS_PER_PAGE, filtered.length)}
                </span>{" "}
                of{" "}
                <span className="font-medium text-gray-700">{filtered.length}</span>{" "}
                leases
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Add/Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={editing ? "Edit Lease" : "New Lease"}
        wide
      >
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Row 1: Tenant & Unit */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tenant
              </label>
              <select
                name="tenantId"
                value={form.tenantId}
                onChange={handleChange}
                required
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
              >
                <option value="">Select a tenant</option>
                {tenants.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.firstName} {t.lastName}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Unit
              </label>
              <select
                name="unitId"
                value={form.unitId}
                onChange={handleChange}
                required
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
              >
                <option value="">Select a unit</option>
                {units.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.unitNumber} - {u.property?.name || "No property"}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Row 2: Start Date & End Date */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Start Date
              </label>
              <input
                type="date"
                name="startDate"
                value={form.startDate}
                onChange={handleChange}
                required
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                End Date
              </label>
              <input
                type="date"
                name="endDate"
                value={form.endDate}
                onChange={handleChange}
                required
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Row 3: Rent Amount & Deposit Amount */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Rent Amount
              </label>
              <input
                type="number"
                name="rentAmount"
                value={form.rentAmount}
                onChange={handleChange}
                required
                min="0"
                step="0.01"
                placeholder="0.00"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Deposit Amount
              </label>
              <input
                type="number"
                name="depositAmount"
                value={form.depositAmount}
                onChange={handleChange}
                required
                min="0"
                step="0.01"
                placeholder="0.00"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Row 4: Deposit Paid, Status, Signature Status */}
          <div className="grid grid-cols-3 gap-4">
            <div className="flex items-center gap-2 pt-6">
              <input
                type="checkbox"
                id="depositPaid"
                name="depositPaid"
                checked={form.depositPaid}
                onChange={handleChange}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="depositPaid" className="text-sm font-medium text-gray-700">
                Deposit Paid
              </label>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Status
              </label>
              <select
                name="status"
                value={form.status}
                onChange={handleChange}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
              >
                <option value="DRAFT">Draft</option>
                <option value="PENDING_REVIEW">Pending Review</option>
                <option value="APPROVED">Approved</option>
                <option value="SENT">Sent</option>
                <option value="ACTIVE">Active</option>
                <option value="EXPIRED">Expired</option>
                <option value="TERMINATED">Terminated</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Signature Status
              </label>
              <select
                name="signatureStatus"
                value={form.signatureStatus}
                onChange={handleChange}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
              >
                <option value="PENDING">Pending</option>
                <option value="SENT">Sent</option>
                <option value="SIGNED">Signed</option>
              </select>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={closeModal}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors cursor-pointer"
            >
              {saving ? "Saving..." : editing ? "Update Lease" : "Create Lease"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Lease"
        message="Are you sure you want to delete this lease? This action cannot be undone."
      />
    </div>
  );
}
