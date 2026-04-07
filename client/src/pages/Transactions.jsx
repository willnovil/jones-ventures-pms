import { useState, useEffect } from "react";
import { api } from "../lib/api";
import Modal from "../components/Modal";
import ConfirmDialog from "../components/ConfirmDialog";
import StatusBadge from "../components/StatusBadge";
import EmptyState from "../components/EmptyState";
import LoadingSpinner from "../components/LoadingSpinner";
import { useToast } from "../components/Toast";

const TABS = [
  { key: "ALL", label: "All" },
  { key: "CHARGE", label: "Charges" },
  { key: "PAYMENT", label: "Payments" },
  { key: "CREDIT", label: "Credits" },
  { key: "LATE_FEE", label: "Late Fees" },
];

const TYPES = ["CHARGE", "PAYMENT", "CREDIT", "LATE_FEE"];

const PER_PAGE = 10;

const formatCurrency = (n) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n || 0);

const formatDate = (d) =>
  d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : null;

const EMPTY_FORM = {
  leaseId: "",
  tenantId: "",
  type: "CHARGE",
  amount: "",
  dueDate: "",
  paidDate: "",
  description: "",
  balance: "",
};

export default function Transactions() {
  const toast = useToast();

  const [transactions, setTransactions] = useState([]);
  const [leases, setLeases] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);

  const [activeTab, setActiveTab] = useState("ALL");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState(null);

  // ---------- Data fetching ----------

  useEffect(() => {
    fetchAll();
  }, []);

  async function fetchAll() {
    setLoading(true);
    try {
      const [txns, leaseList, tenantList] = await Promise.all([
        api.getTransactions(),
        api.getLeases(),
        api.getTenants(),
      ]);
      setTransactions(txns);
      setLeases(leaseList);
      setTenants(tenantList);
    } catch (err) {
      toast("Failed to load transactions", "error");
    } finally {
      setLoading(false);
    }
  }

  // ---------- Filtering / searching ----------

  const filtered = transactions
    .filter((t) => activeTab === "ALL" || t.type === activeTab)
    .filter((t) => {
      if (!search) return true;
      const q = search.toLowerCase();
      const tenantName = t.tenant
        ? `${t.tenant.firstName} ${t.tenant.lastName}`.toLowerCase()
        : "";
      const desc = (t.description || "").toLowerCase();
      return tenantName.includes(q) || desc.includes(q);
    });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const safePage = Math.min(page, totalPages);
  const paginated = filtered.slice((safePage - 1) * PER_PAGE, safePage * PER_PAGE);

  // ---------- Tab counts ----------

  const tabCounts = {
    ALL: transactions.length,
    CHARGE: transactions.filter((t) => t.type === "CHARGE").length,
    PAYMENT: transactions.filter((t) => t.type === "PAYMENT").length,
    CREDIT: transactions.filter((t) => t.type === "CREDIT").length,
    LATE_FEE: transactions.filter((t) => t.type === "LATE_FEE").length,
  };

  // ---------- Stats ----------

  const totalCharges = transactions
    .filter((t) => t.type === "CHARGE")
    .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

  const totalPayments = transactions
    .filter((t) => t.type === "PAYMENT")
    .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

  const outstanding = transactions
    .filter((t) => t.type === "CHARGE" && !t.paidDate)
    .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

  const creditsAndLateFees = transactions
    .filter((t) => t.type === "CREDIT" || t.type === "LATE_FEE")
    .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

  // ---------- Modal open/close ----------

  function openAdd() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  }

  function openEdit(txn) {
    setEditing(txn);
    setForm({
      leaseId: txn.leaseId || "",
      tenantId: txn.tenantId || "",
      type: txn.type || "CHARGE",
      amount: txn.amount ?? "",
      dueDate: txn.dueDate ? txn.dueDate.slice(0, 10) : "",
      paidDate: txn.paidDate ? txn.paidDate.slice(0, 10) : "",
      description: txn.description || "",
      balance: txn.balance ?? "",
    });
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditing(null);
    setForm(EMPTY_FORM);
  }

  // ---------- Submit ----------

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        leaseId: form.leaseId || undefined,
        tenantId: form.tenantId || undefined,
        type: form.type,
        amount: Number(form.amount),
        dueDate: form.dueDate ? new Date(form.dueDate).toISOString() : undefined,
        paidDate: form.paidDate ? new Date(form.paidDate).toISOString() : null,
        description: form.description || undefined,
        balance: form.balance !== "" ? Number(form.balance) : undefined,
      };

      if (editing) {
        await api.updateTransaction(editing.id, payload);
        toast("Transaction updated successfully");
      } else {
        await api.createTransaction(payload);
        toast("Transaction recorded successfully");
      }
      closeModal();
      fetchAll();
    } catch (err) {
      toast(err.message || "Failed to save transaction", "error");
    } finally {
      setSaving(false);
    }
  }

  // ---------- Delete ----------

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await api.deleteTransaction(deleteTarget.id);
      toast("Transaction deleted successfully");
      setDeleteTarget(null);
      fetchAll();
    } catch (err) {
      toast(err.message || "Failed to delete transaction", "error");
    }
  }

  // ---------- Helpers ----------

  function initials(tenant) {
    if (!tenant) return "?";
    return `${(tenant.firstName || "")[0] || ""}${(tenant.lastName || "")[0] || ""}`.toUpperCase();
  }

  function amountColor(type) {
    return type === "PAYMENT" || type === "CREDIT" ? "text-green-600" : "text-red-600";
  }

  // ---------- Render ----------

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Transactions</h1>
          <p className="mt-1 text-sm text-gray-500">Track payments, charges, credits, and balances</p>
        </div>
        <button
          onClick={openAdd}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700 transition-colors cursor-pointer"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Record Transaction
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1 border-b border-gray-200">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => { setActiveTab(tab.key); setPage(1); }}
            className={`relative px-4 py-2.5 text-sm font-medium transition-colors cursor-pointer ${
              activeTab === tab.key
                ? "text-blue-600 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-blue-600"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab.label}
            <span className={`ml-1.5 inline-flex items-center justify-center rounded-full px-2 py-0.5 text-xs font-medium ${
              activeTab === tab.key ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-500"
            }`}>
              {tabCounts[tab.key]}
            </span>
          </button>
        ))}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <p className="text-sm font-medium text-gray-500">Total Charges</p>
          <p className="mt-2 text-3xl font-bold text-red-600">{formatCurrency(totalCharges)}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <p className="text-sm font-medium text-gray-500">Total Payments</p>
          <p className="mt-2 text-3xl font-bold text-green-600">{formatCurrency(totalPayments)}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <p className="text-sm font-medium text-gray-500">Outstanding</p>
          <p className="mt-2 text-3xl font-bold text-amber-600">{formatCurrency(outstanding)}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <p className="text-sm font-medium text-gray-500">Credits & Late Fees</p>
          <p className="mt-2 text-3xl font-bold text-gray-900">{formatCurrency(creditsAndLateFees)}</p>
        </div>
      </div>

      {/* Table Card */}
      {transactions.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white">
          <EmptyState
            icon="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            title="No transactions yet"
            description="Start tracking rent payments, charges, credits, and late fees for your tenants."
            action="Record Transaction"
            onAction={openAdd}
          />
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white">
          {/* Search Bar */}
          <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search by tenant or description..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="w-80 rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50/50">
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Date</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Tenant</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Type</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Description</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">Amount</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Due Date</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Paid Date</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">Balance</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {paginated.map((txn) => (
                  <tr key={txn.id} className="hover:bg-gray-50/50 transition-colors">
                    {/* Date */}
                    <td className="px-5 py-4 text-sm text-gray-600 whitespace-nowrap">
                      {formatDate(txn.createdAt) || "—"}
                    </td>

                    {/* Tenant */}
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">
                          {initials(txn.tenant)}
                        </div>
                        <span className="text-sm font-medium text-gray-900 whitespace-nowrap">
                          {txn.tenant ? `${txn.tenant.firstName} ${txn.tenant.lastName}` : "—"}
                        </span>
                      </div>
                    </td>

                    {/* Type */}
                    <td className="px-5 py-4">
                      <StatusBadge status={txn.type} />
                    </td>

                    {/* Description */}
                    <td className="px-5 py-4 text-sm text-gray-600 max-w-[200px] truncate">
                      {txn.description || "—"}
                    </td>

                    {/* Amount */}
                    <td className={`px-5 py-4 text-sm font-semibold text-right whitespace-nowrap ${amountColor(txn.type)}`}>
                      {formatCurrency(txn.amount)}
                    </td>

                    {/* Due Date */}
                    <td className="px-5 py-4 text-sm text-gray-600 whitespace-nowrap">
                      {formatDate(txn.dueDate) || "—"}
                    </td>

                    {/* Paid Date */}
                    <td className="px-5 py-4 whitespace-nowrap">
                      {txn.paidDate ? (
                        <span className="text-sm text-gray-600">{formatDate(txn.paidDate)}</span>
                      ) : (
                        <span className="text-sm font-medium text-red-600">Unpaid</span>
                      )}
                    </td>

                    {/* Balance */}
                    <td className="px-5 py-4 text-sm font-medium text-gray-900 text-right whitespace-nowrap">
                      {formatCurrency(txn.balance)}
                    </td>

                    {/* Actions */}
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEdit(txn)}
                          className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors cursor-pointer"
                          title="Edit"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => setDeleteTarget(txn)}
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

          {/* Pagination Footer */}
          <div className="flex items-center justify-between border-t border-gray-200 px-5 py-3">
            <p className="text-sm text-gray-500">
              Showing <span className="font-medium">{(safePage - 1) * PER_PAGE + 1}</span> to{" "}
              <span className="font-medium">{Math.min(safePage * PER_PAGE, filtered.length)}</span> of{" "}
              <span className="font-medium">{filtered.length}</span> transactions
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={safePage <= 1}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
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
                disabled={safePage >= totalPages}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Modal */}
      <Modal open={modalOpen} onClose={closeModal} title={editing ? "Edit Transaction" : "Record Transaction"} wide>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Row 1: Lease + Tenant */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Lease</label>
              <select
                value={form.leaseId}
                onChange={(e) => {
                  const leaseId = e.target.value;
                  const selectedLease = leases.find((l) => l.id === leaseId);
                  setForm({
                    ...form,
                    leaseId,
                    tenantId: selectedLease?.tenantId || form.tenantId,
                  });
                }}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">Select lease...</option>
                {leases.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.tenant ? `${l.tenant.firstName} ${l.tenant.lastName}` : "Unknown"} — Unit {l.unit?.unitNumber || "N/A"}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tenant</label>
              <select
                value={form.tenantId}
                onChange={(e) => setForm({ ...form, tenantId: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">Select tenant...</option>
                {tenants.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.firstName} {t.lastName}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Row 2: Type + Amount */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                placeholder="0.00"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Row 3: Due Date + Paid Date */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
              <input
                type="date"
                value={form.dueDate}
                onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Paid Date <span className="text-gray-400 font-normal">(optional)</span></label>
              <input
                type="date"
                value={form.paidDate}
                onChange={(e) => setForm({ ...form, paidDate: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Row 4: Description + Balance */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <input
                type="text"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="e.g. Monthly rent, late fee, deposit refund"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Balance</label>
              <input
                type="number"
                step="0.01"
                value={form.balance}
                onChange={(e) => setForm({ ...form, balance: e.target.value })}
                placeholder="0.00"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Actions */}
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
              {saving ? "Saving..." : editing ? "Update Transaction" : "Save Transaction"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirm */}
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Transaction"
        message="Are you sure you want to delete this transaction? This action cannot be undone."
      />
    </div>
  );
}
