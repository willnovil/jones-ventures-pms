import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { api } from "../lib/api";
import StatusBadge from "../components/StatusBadge";
import LoadingSpinner from "../components/LoadingSpinner";
import { useToast } from "../components/Toast";

function formatDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateTime(d) {
  if (!d) return null;
  return new Date(d).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatCurrency(n) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(Number(n) || 0);
}

export default function LeaseDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const addToast = useToast();

  const [lease, setLease] = useState(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [needsTemplate, setNeedsTemplate] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  async function fetchLease() {
    try {
      const data = await api.getLease(id);
      setLease(data);
    } catch {
      addToast("Failed to load lease", "error");
    }
  }

  useEffect(() => {
    async function load() {
      setLoading(true);
      await fetchLease();
      setLoading(false);
    }
    load();
  }, [id]);

  async function handleFileSelected(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    const lower = f.name.toLowerCase();
    if (!lower.endsWith(".docx") && !lower.endsWith(".pdf")) {
      addToast("Only .docx or .pdf files are allowed", "error");
      e.target.value = "";
      return;
    }
    setUploading(true);
    try {
      await api.uploadLeaseDocument(id, f);
      await fetchLease();
      addToast("Document uploaded");
    } catch (err) {
      addToast(err.message || "Upload failed", "error");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  async function runAction(fn, successMessage) {
    setActing(true);
    try {
      await fn();
      await fetchLease();
      setNeedsTemplate(false);
      addToast(successMessage);
    } catch (err) {
      const message = err.message || "Action failed";
      if (message.toLowerCase().includes("no lease template")) {
        setNeedsTemplate(true);
      }
      addToast(message, "error");
    } finally {
      setActing(false);
    }
  }

  if (loading) return <LoadingSpinner />;
  if (!lease) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-8 text-center">
        <p className="text-gray-500">Lease not found.</p>
        <button
          onClick={() => navigate("/leases")}
          className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Back to Leases
        </button>
      </div>
    );
  }

  const tenantName = lease.tenant
    ? `${lease.tenant.firstName || ""} ${lease.tenant.lastName || ""}`.trim()
    : "—";
  const unitNumber = lease.unit?.unitNumber || "—";

  // Determine which workflow actions to show based on current status
  const actions = [];
  if (lease.status === "DRAFT") {
    actions.push({
      label: "Submit for Review",
      onClick: () => runAction(() => api.reviewLease(id), "Submitted for review"),
      primary: true,
    });
    actions.push({
      label: lease.leaseHtml ? "Regenerate Document" : "Generate Document",
      onClick: () =>
        runAction(() => api.generateLeaseDocument(id), "Document generated"),
    });
  } else if (lease.status === "PENDING_REVIEW") {
    actions.push({
      label: "Approve",
      onClick: () =>
        runAction(() => api.approveLease(id, "system"), "Lease approved"),
      primary: true,
    });
  } else if (lease.status === "APPROVED") {
    actions.push({
      label: "Send to Tenant",
      onClick: () => runAction(() => api.sendLease(id), "Lease sent to tenant"),
      primary: true,
    });
  } else if (lease.status === "SENT") {
    actions.push({
      label: "Mark as Signed",
      onClick: () => runAction(() => api.signLease(id), "Lease signed and activated"),
      primary: true,
    });
  }

  // Workflow timeline events (only show stamped ones)
  const timeline = [
    { label: "Created", at: lease.createdAt },
    { label: "Reviewed", at: lease.reviewedAt },
    { label: "Approved", at: lease.approvedAt, by: lease.approvedBy },
    { label: "Sent", at: lease.sentAt },
    { label: "Executed", at: lease.executedAt },
  ].filter((t) => t.at);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
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
            <h1 className="text-2xl font-bold text-gray-900">
              Lease &mdash; {tenantName}
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Unit {unitNumber} &middot; {formatDate(lease.startDate)} to {formatDate(lease.endDate)}
            </p>
          </div>
        </div>
        <StatusBadge status={lease.status} />
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Document Preview (2/3) */}
        <div className="lg:col-span-2">
          <div className="rounded-xl border border-gray-200 bg-white">
            <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
              <h2 className="text-sm font-semibold text-gray-900">Lease Document</h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors cursor-pointer"
                  title="Attach a signed .docx or .pdf to this lease"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  {uploading ? "Uploading..." : lease.documentUrl ? "Replace" : "Upload"}
                </button>
                {lease.documentUrl && (
                  <a
                    href={api.leaseDocumentDownloadUrl(id)}
                    download
                    className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Download {lease.documentExtension === "pdf" ? "PDF" : "DOCX"}
                  </a>
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
            {lease.documentExtension === "pdf" ? (
              <iframe
                title="Lease Document Preview"
                src={api.leaseDocumentUrl(id)}
                className="w-full rounded-b-xl"
                style={{ height: "800px", border: 0 }}
              />
            ) : lease.leaseHtml ? (
              <iframe
                title="Lease Document Preview"
                srcDoc={lease.leaseHtml}
                className="w-full rounded-b-xl"
                style={{ height: "800px", border: 0 }}
              />
            ) : needsTemplate ? (
              <div className="flex flex-col items-center justify-center px-5 py-16 text-center">
                <svg className="w-12 h-12 text-amber-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <p className="mt-3 text-sm font-medium text-gray-900">No lease template uploaded</p>
                <p className="mt-1 text-sm text-gray-500">
                  Upload your lease document on the Templates page first.
                </p>
                <Link
                  to="/templates"
                  className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 cursor-pointer"
                >
                  Go to Templates
                </Link>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center px-5 py-16 text-center">
                <svg
                  className="w-12 h-12 text-gray-300"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                <p className="mt-3 text-sm text-gray-500">No lease document generated yet.</p>
                <button
                  onClick={() =>
                    runAction(() => api.generateLeaseDocument(id), "Document generated")
                  }
                  disabled={acting}
                  className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
                >
                  Generate Document
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Workflow panel (1/3) */}
        <div className="space-y-6">
          {/* Summary card */}
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <h2 className="text-sm font-semibold text-gray-900">Summary</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-500">Tenant</dt>
                <dd className="font-medium text-gray-900">{tenantName}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Unit</dt>
                <dd className="font-medium text-gray-900">{unitNumber}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Term</dt>
                <dd className="font-medium text-gray-900">
                  {formatDate(lease.startDate)} &mdash; {formatDate(lease.endDate)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Rent</dt>
                <dd className="font-medium text-gray-900">{formatCurrency(lease.rentAmount)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Deposit</dt>
                <dd className="font-medium text-gray-900">
                  {formatCurrency(lease.depositAmount)}{" "}
                  <span className={`ml-1 text-xs ${lease.depositPaid ? "text-green-600" : "text-red-600"}`}>
                    {lease.depositPaid ? "Paid" : "Unpaid"}
                  </span>
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Signature</dt>
                <dd>
                  <StatusBadge status={lease.signatureStatus} />
                </dd>
              </div>
            </dl>
          </div>

          {/* Workflow actions */}
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <h2 className="text-sm font-semibold text-gray-900">Workflow</h2>
            {actions.length > 0 ? (
              <div className="mt-4 space-y-2">
                {actions.map((a) => (
                  <button
                    key={a.label}
                    onClick={a.onClick}
                    disabled={acting}
                    className={`w-full rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 cursor-pointer ${
                      a.primary
                        ? "bg-blue-600 text-white hover:bg-blue-700"
                        : "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    {a.label}
                  </button>
                ))}
              </div>
            ) : (
              <p className="mt-4 text-sm text-gray-500">Workflow complete.</p>
            )}
          </div>

          {/* Timeline */}
          {timeline.length > 0 && (
            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <h2 className="text-sm font-semibold text-gray-900">Timeline</h2>
              <ol className="mt-4 space-y-3 text-sm">
                {timeline.map((t) => (
                  <li key={t.label} className="flex gap-3">
                    <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-blue-500" />
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{t.label}</p>
                      <p className="text-xs text-gray-500">{formatDateTime(t.at)}</p>
                      {t.by && <p className="text-xs text-gray-500">by {t.by}</p>}
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
