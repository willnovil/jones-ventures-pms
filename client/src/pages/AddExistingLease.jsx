import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import LoadingSpinner from "../components/LoadingSpinner";
import { useToast } from "../components/Toast";

// "Add Existing Lease" — for ingesting leases that were already signed
// outside this PMS. Pre-fills the rent from the selected unit, lets you
// either pick an existing tenant or create one inline, and optionally
// attaches the original signed .docx so it shows up in the lease detail
// view alongside generated leases.

const INITIAL_TENANT = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  emergencyContact: "",
  emergencyPhone: "",
};

const INITIAL_LEASE = {
  unitId: "",
  startDate: "",
  endDate: "",
  rentAmount: "",
  depositAmount: "",
  depositPaid: false,
};

export default function AddExistingLease() {
  const navigate = useNavigate();
  const addToast = useToast();
  const fileInputRef = useRef(null);

  const [units, setUnits] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [tenantMode, setTenantMode] = useState("new"); // "new" | "existing"
  const [existingTenantId, setExistingTenantId] = useState("");
  const [tenant, setTenant] = useState(INITIAL_TENANT);
  const [lease, setLease] = useState(INITIAL_LEASE);
  const [file, setFile] = useState(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [u, t] = await Promise.all([api.getUnits(), api.getTenants()]);
        setUnits(u);
        setTenants(t);
      } catch {
        addToast("Failed to load units/tenants", "error");
      } finally {
        setLoading(false);
      }
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleUnitChange(e) {
    const unitId = e.target.value;
    const unit = units.find((u) => u.id === unitId);
    // Auto-fill rent from the unit when one is selected.
    setLease((prev) => ({
      ...prev,
      unitId,
      rentAmount: unit ? String(unit.rentAmount ?? "") : prev.rentAmount,
    }));
  }

  function handleLeaseChange(e) {
    const { name, value, type, checked } = e.target;
    setLease((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
  }

  function handleTenantChange(e) {
    const { name, value } = e.target;
    setTenant((prev) => ({ ...prev, [name]: value }));
  }

  function handleFileSelected(e) {
    const f = e.target.files?.[0];
    if (!f) {
      setFile(null);
      return;
    }
    const lower = f.name.toLowerCase();
    if (!lower.endsWith(".docx") && !lower.endsWith(".pdf")) {
      addToast("Only .docx or .pdf files are allowed", "error");
      e.target.value = "";
      return;
    }
    setFile(f);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!lease.unitId) {
      addToast("Pick a unit", "error");
      return;
    }
    if (tenantMode === "existing" && !existingTenantId) {
      addToast("Pick an existing tenant", "error");
      return;
    }
    if (tenantMode === "new") {
      for (const f of ["firstName", "lastName", "email", "phone"]) {
        if (!tenant[f]) {
          addToast(`Tenant ${f} is required`, "error");
          return;
        }
      }
    }

    const fd = new FormData();
    fd.append("unitId", lease.unitId);
    fd.append("startDate", lease.startDate);
    fd.append("endDate", lease.endDate);
    fd.append("rentAmount", lease.rentAmount);
    fd.append("depositAmount", lease.depositAmount);
    fd.append("depositPaid", lease.depositPaid ? "true" : "false");

    if (tenantMode === "existing") {
      fd.append("tenantId", existingTenantId);
    } else {
      fd.append("firstName", tenant.firstName);
      fd.append("lastName", tenant.lastName);
      fd.append("email", tenant.email);
      fd.append("phone", tenant.phone);
      if (tenant.emergencyContact) fd.append("emergencyContact", tenant.emergencyContact);
      if (tenant.emergencyPhone) fd.append("emergencyPhone", tenant.emergencyPhone);
    }

    if (file) fd.append("file", file);

    setSaving(true);
    try {
      const result = await api.importExistingLease(fd);
      if (result.warning) {
        addToast(result.warning, "error");
      } else {
        addToast("Lease added");
      }
      navigate(`/leases/${result.lease.id}`);
    } catch (err) {
      addToast(err.message || "Failed to add lease", "error");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <LoadingSpinner />;

  const inputCls =
    "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none";
  const labelCls = "block text-sm font-medium text-gray-700 mb-1";

  return (
    <div className="max-w-3xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate("/leases")}
          className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors cursor-pointer"
          title="Back"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Add Existing Lease</h1>
          <p className="mt-1 text-sm text-gray-500">
            For leases signed outside this system. The lease will be marked active immediately and
            the unit will be flipped to occupied. Optionally attach the original signed .docx.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Unit + dates + financials */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-4">
          <h2 className="text-sm font-semibold text-gray-900">Lease</h2>

          <div>
            <label className={labelCls}>Unit</label>
            <select
              name="unitId"
              value={lease.unitId}
              onChange={handleUnitChange}
              required
              className={inputCls}
            >
              <option value="">Select a unit</option>
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.property?.name || "No property"} — Unit {u.unitNumber} (${u.rentAmount}/mo, {u.status})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Start Date</label>
              <input
                type="date"
                name="startDate"
                value={lease.startDate}
                onChange={handleLeaseChange}
                required
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>End Date</label>
              <input
                type="date"
                name="endDate"
                value={lease.endDate}
                onChange={handleLeaseChange}
                required
                className={inputCls}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Monthly Rent</label>
              <input
                type="number"
                step="0.01"
                name="rentAmount"
                value={lease.rentAmount}
                onChange={handleLeaseChange}
                required
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Security Deposit</label>
              <input
                type="number"
                step="0.01"
                name="depositAmount"
                value={lease.depositAmount}
                onChange={handleLeaseChange}
                required
                className={inputCls}
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              name="depositPaid"
              checked={lease.depositPaid}
              onChange={handleLeaseChange}
              className="rounded border-gray-300"
            />
            Deposit already paid
          </label>
        </div>

        {/* Tenant */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">Tenant</h2>
            <div className="flex gap-1 rounded-lg border border-gray-200 p-0.5">
              <button
                type="button"
                onClick={() => setTenantMode("new")}
                className={`rounded px-3 py-1 text-xs font-medium transition-colors cursor-pointer ${
                  tenantMode === "new"
                    ? "bg-blue-600 text-white"
                    : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                New tenant
              </button>
              <button
                type="button"
                onClick={() => setTenantMode("existing")}
                className={`rounded px-3 py-1 text-xs font-medium transition-colors cursor-pointer ${
                  tenantMode === "existing"
                    ? "bg-blue-600 text-white"
                    : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                Pick existing
              </button>
            </div>
          </div>

          {tenantMode === "existing" ? (
            <div>
              <label className={labelCls}>Tenant</label>
              <select
                value={existingTenantId}
                onChange={(e) => setExistingTenantId(e.target.value)}
                required
                className={inputCls}
              >
                <option value="">Select a tenant</option>
                {tenants.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.firstName} {t.lastName} ({t.email})
                  </option>
                ))}
              </select>
              {tenants.length === 0 && (
                <p className="mt-2 text-xs text-gray-500">
                  No tenants yet — switch to "New tenant" to create one.
                </p>
              )}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>First Name</label>
                  <input
                    name="firstName"
                    value={tenant.firstName}
                    onChange={handleTenantChange}
                    required
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Last Name</label>
                  <input
                    name="lastName"
                    value={tenant.lastName}
                    onChange={handleTenantChange}
                    required
                    className={inputCls}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Email</label>
                  <input
                    type="email"
                    name="email"
                    value={tenant.email}
                    onChange={handleTenantChange}
                    required
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Phone</label>
                  <input
                    name="phone"
                    value={tenant.phone}
                    onChange={handleTenantChange}
                    required
                    className={inputCls}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Emergency Contact (optional)</label>
                  <input
                    name="emergencyContact"
                    value={tenant.emergencyContact}
                    onChange={handleTenantChange}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Emergency Phone (optional)</label>
                  <input
                    name="emergencyPhone"
                    value={tenant.emergencyPhone}
                    onChange={handleTenantChange}
                    className={inputCls}
                  />
                </div>
              </div>
            </>
          )}
        </div>

        {/* File upload */}
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-gray-900">Signed Lease Document (optional)</h2>
          <p className="mt-1 text-xs text-gray-500">
            Upload the existing signed .docx or .pdf. It will be attached to this lease and
            viewable from the lease detail page.
          </p>
          <div className="mt-3 flex items-center gap-3">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
            >
              {file ? "Choose Different File" : "Choose File"}
            </button>
            {file && (
              <>
                <span className="text-sm text-gray-700">{file.name}</span>
                <button
                  type="button"
                  onClick={() => {
                    setFile(null);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                  className="text-xs text-gray-500 hover:text-red-600 cursor-pointer"
                >
                  Remove
                </button>
              </>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".docx,.pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/pdf"
            onChange={handleFileSelected}
            className="hidden"
          />
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => navigate("/leases")}
            disabled={saving}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
          >
            {saving ? "Saving..." : "Add Lease"}
          </button>
        </div>
      </form>
    </div>
  );
}
