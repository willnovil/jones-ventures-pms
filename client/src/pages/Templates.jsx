import { useState, useEffect, useRef } from "react";
import { api } from "../lib/api";
import LoadingSpinner from "../components/LoadingSpinner";
import ConfirmDialog from "../components/ConfirmDialog";
import { useToast } from "../components/Toast";

function formatBytes(n) {
  if (!n && n !== 0) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

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

export default function Templates() {
  const addToast = useToast();
  const fileInputRef = useRef(null);

  const [template, setTemplate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function fetchTemplate() {
    try {
      const data = await api.getLeaseTemplate();
      setTemplate(data);
    } catch {
      addToast("Failed to load template status", "error");
    }
  }

  useEffect(() => {
    async function load() {
      setLoading(true);
      await fetchTemplate();
      setLoading(false);
    }
    load();
  }, []);

  async function handleFileSelected(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".docx")) {
      addToast("Only .docx files are allowed", "error");
      e.target.value = "";
      return;
    }
    setUploading(true);
    try {
      const data = await api.uploadLeaseTemplate(file);
      setTemplate(data);
      addToast("Template uploaded successfully");
    } catch (err) {
      addToast(err.message || "Upload failed", "error");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  async function handleDelete() {
    try {
      await api.deleteLeaseTemplate();
      addToast("Template removed");
      await fetchTemplate();
    } catch (err) {
      addToast(err.message || "Failed to remove template", "error");
    } finally {
      setConfirmDelete(false);
    }
  }

  if (loading) return <LoadingSpinner />;

  const placeholders = template?.placeholders || [];
  const exists = !!template?.exists;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Templates</h1>
        <p className="mt-1 text-sm text-gray-500">
          Upload your lease document. The system will fill in tenant and lease
          details when generating documents — your template's wording, layout,
          and styling are kept exactly as you wrote them.
        </p>
      </div>

      {/* Lease template card */}
      <div className="rounded-xl border border-gray-200 bg-white">
        <div className="border-b border-gray-200 px-5 py-4">
          <h2 className="text-sm font-semibold text-gray-900">Lease Template</h2>
        </div>
        <div className="p-5">
          {exists ? (
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div>
                  <p className="font-medium text-gray-900">lease-template.docx</p>
                  <p className="mt-1 text-sm text-gray-500">
                    {formatBytes(template.size)} &middot; Uploaded {formatDateTime(template.uploadedAt)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors cursor-pointer"
                >
                  {uploading ? "Uploading..." : "Replace"}
                </button>
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                >
                  Remove
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 px-5 py-12 text-center">
              <svg className="w-12 h-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <p className="mt-3 text-sm font-medium text-gray-900">No lease template uploaded</p>
              <p className="mt-1 text-sm text-gray-500">
                Upload a .docx file with the placeholders below.
              </p>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
              >
                {uploading ? "Uploading..." : "Upload Template"}
              </button>
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            onChange={handleFileSelected}
            className="hidden"
          />
        </div>
      </div>

      {/* Placeholder reference */}
      <div className="rounded-xl border border-gray-200 bg-white">
        <div className="border-b border-gray-200 px-5 py-4">
          <h2 className="text-sm font-semibold text-gray-900">Available Placeholders</h2>
          <p className="mt-1 text-xs text-gray-500">
            Insert any of these tags in your .docx exactly as shown (including the curly braces).
            The system will replace them with each lease's data when you click Generate Document.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50/50">
                <th className="px-5 py-3 font-medium text-gray-500">Placeholder</th>
                <th className="px-5 py-3 font-medium text-gray-500">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {placeholders.map((p) => (
                <tr key={p.tag}>
                  <td className="px-5 py-2.5">
                    <code className="rounded bg-gray-100 px-2 py-0.5 text-xs font-mono text-blue-700">
                      {`{${p.tag}}`}
                    </code>
                  </td>
                  <td className="px-5 py-2.5 text-gray-700">{p.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={handleDelete}
        title="Remove Lease Template"
        message="Are you sure you want to remove the lease template? You'll need to upload a new one before generating any new lease documents."
      />
    </div>
  );
}
