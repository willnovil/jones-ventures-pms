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

const STATUSES = ["OPEN", "IN_PROGRESS", "COMPLETED"];

export default function MaintenanceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const addToast = useToast();

  const [request, setRequest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  async function fetchRequest() {
    try {
      const data = await api.getMaintenanceRequest(id);
      setRequest(data);
    } catch {
      addToast("Failed to load maintenance request", "error");
    }
  }

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      await fetchRequest();
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
      const payload = { ...request, status: newStatus };
      if (newStatus === "COMPLETED" && !request.completedAt) {
        payload.completedAt = new Date().toISOString();
      }
      await api.updateMaintenanceRequest(id, payload);
      addToast(`Marked ${newStatus.replace("_", " ").toLowerCase()}`);
      await fetchRequest();
    } catch (err) {
      addToast(err.message || "Failed to update status", "error");
    } finally {
      setUpdating(false);
    }
  }

  if (loading) return <LoadingSpinner />;

  if (!request) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-8 text-center">
        <p className="text-gray-500">Maintenance request not found.</p>
        <button
          onClick={() => navigate("/maintenance")}
          className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 cursor-pointer"
        >
          Back to Maintenance
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
            onClick={() => navigate("/maintenance")}
            className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors cursor-pointer"
            title="Back"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{request.title}</h1>
            <p className="mt-1 text-sm text-gray-500">
              Submitted {formatDateTime(request.createdAt)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={request.priority} />
          <StatusBadge status={request.status} />
        </div>
      </div>

      {/* Two columns */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Description */}
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <h2 className="text-sm font-semibold text-gray-900">Description</h2>
            <p className="mt-3 whitespace-pre-wrap text-sm text-gray-700">
              {request.description || <span className="text-gray-400">No description provided.</span>}
            </p>
          </div>

          {/* Vendor notes */}
          {request.vendorNotes && (
            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <h2 className="text-sm font-semibold text-gray-900">Vendor Notes</h2>
              <p className="mt-3 whitespace-pre-wrap text-sm text-gray-700">{request.vendorNotes}</p>
            </div>
          )}

          {/* Photos */}
          {request.photoUrls && request.photoUrls.length > 0 && (
            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <h2 className="text-sm font-semibold text-gray-900">Photos</h2>
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {request.photoUrls.map((url, i) => (
                  <a key={i} href={url} target="_blank" rel="noreferrer">
                    <img
                      src={url}
                      alt={`Photo ${i + 1}`}
                      className="h-32 w-full rounded-lg border border-gray-200 object-cover hover:opacity-90 transition-opacity"
                    />
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Side panel */}
        <div className="space-y-6">
          {/* Status actions */}
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <h2 className="text-sm font-semibold text-gray-900">Update Status</h2>
            <div className="mt-3 space-y-2">
              {STATUSES.filter((s) => s !== request.status).map((s) => (
                <button
                  key={s}
                  onClick={() => changeStatus(s)}
                  disabled={updating}
                  className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 cursor-pointer"
                >
                  Mark {s.replace("_", " ").toLowerCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Related */}
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <h2 className="text-sm font-semibold text-gray-900">Related</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <div>
                <dt className="text-gray-500">Unit</dt>
                <dd>
                  {request.unit ? (
                    <button
                      onClick={() => navigate(`/units/${request.unit.id}`)}
                      className="font-medium text-blue-600 hover:underline cursor-pointer"
                    >
                      {request.unit.unitNumber}
                    </button>
                  ) : (
                    <span className="text-gray-400">—</span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-gray-500">Tenant</dt>
                <dd>
                  {request.tenant ? (
                    <button
                      onClick={() => navigate(`/tenants/${request.tenant.id}`)}
                      className="font-medium text-blue-600 hover:underline cursor-pointer"
                    >
                      {request.tenant.firstName} {request.tenant.lastName}
                    </button>
                  ) : (
                    <span className="text-gray-400">—</span>
                  )}
                </dd>
              </div>
              <div className="border-t border-gray-100 pt-3">
                <dt className="text-gray-500">Submitted</dt>
                <dd className="font-medium text-gray-900">{formatDateTime(request.createdAt)}</dd>
              </div>
              {request.completedAt && (
                <div>
                  <dt className="text-gray-500">Completed</dt>
                  <dd className="font-medium text-gray-900">{formatDateTime(request.completedAt)}</dd>
                </div>
              )}
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}
