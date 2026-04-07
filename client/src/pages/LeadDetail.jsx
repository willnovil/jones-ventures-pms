import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import StatusBadge from "../components/StatusBadge";
import LoadingSpinner from "../components/LoadingSpinner";
import { useToast } from "../components/Toast";

function formatDateTime(d) {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

const STATUSES = ["NEW", "CONTACTED", "SHOWING", "APPLIED", "CONVERTED", "LOST"];

export default function LeadDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const addToast = useToast();

  const [lead, setLead] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  async function fetchLead() {
    try {
      const data = await api.getLead(id);
      setLead(data);
    } catch {
      addToast("Failed to load lead", "error");
    }
  }

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      await fetchLead();
      if (!cancelled) setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function changeStatus(newStatus) {
    setUpdating(true);
    try {
      await api.updateLead(id, { ...lead, status: newStatus });
      addToast(`Status set to ${newStatus.toLowerCase()}`);
      await fetchLead();
    } catch (err) {
      addToast(err.message || "Failed to update status", "error");
    } finally {
      setUpdating(false);
    }
  }

  if (loading) return <LoadingSpinner />;

  if (!lead) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-8 text-center">
        <p className="text-gray-500">Lead not found.</p>
        <button
          onClick={() => navigate("/leads")}
          className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 cursor-pointer"
        >
          Back to Leads
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/leads")}
            className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors cursor-pointer"
            title="Back"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {lead.firstName} {lead.lastName}
            </h1>
            <p className="mt-1 text-sm text-gray-500">Added {formatDateTime(lead.createdAt)}</p>
          </div>
        </div>
        <StatusBadge status={lead.status} />
      </div>

      {/* Two columns */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Notes */}
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <h2 className="text-sm font-semibold text-gray-900">Notes</h2>
            <p className="mt-3 whitespace-pre-wrap text-sm text-gray-700">
              {lead.notes || <span className="text-gray-400">No notes recorded.</span>}
            </p>
          </div>

          {/* Pipeline status actions */}
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <h2 className="text-sm font-semibold text-gray-900">Move through pipeline</h2>
            <div className="mt-4 flex flex-wrap gap-2">
              {STATUSES.map((s) => (
                <button
                  key={s}
                  onClick={() => changeStatus(s)}
                  disabled={updating || s === lead.status}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 ${
                    s === lead.status
                      ? "border-blue-500 bg-blue-50 text-blue-700"
                      : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  {s.charAt(0) + s.slice(1).toLowerCase()}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Side panel */}
        <div className="space-y-6">
          {/* Contact card */}
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <h2 className="text-sm font-semibold text-gray-900">Contact</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <div>
                <dt className="text-gray-500">Email</dt>
                <dd className="font-medium text-gray-900 break-all">
                  {lead.email || <span className="text-gray-400">—</span>}
                </dd>
              </div>
              <div>
                <dt className="text-gray-500">Phone</dt>
                <dd className="font-medium text-gray-900">
                  {lead.phone || <span className="text-gray-400">—</span>}
                </dd>
              </div>
            </dl>
          </div>

          {/* Lead info */}
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <h2 className="text-sm font-semibold text-gray-900">Lead Info</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <div>
                <dt className="text-gray-500">Interested In</dt>
                <dd className="font-medium text-gray-900">
                  {lead.unitInterest || <span className="text-gray-400">—</span>}
                </dd>
              </div>
              <div>
                <dt className="text-gray-500">Source</dt>
                <dd className="font-medium text-gray-900">
                  {lead.source || <span className="text-gray-400">—</span>}
                </dd>
              </div>
              <div className="border-t border-gray-100 pt-3">
                <dt className="text-gray-500">Added</dt>
                <dd className="font-medium text-gray-900">{formatDateTime(lead.createdAt)}</dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}
