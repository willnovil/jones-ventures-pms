import { useState, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { api } from "../lib/api";
import { useToast } from "../components/Toast";

// Yardi Rent Roll → Tenants + Leases importer.
//
// Two-phase: pick file → /preview returns a plan (will-create / skip /
// mark-vacant / unmatched), user reviews and clicks Import → /commit
// re-parses and writes everything in a single transaction. Idempotent —
// re-running on the same file is a no-op (everything becomes skip-existing).

function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
function fmtMoney(n) {
  if (n == null) return "—";
  return `$${Number(n).toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

const STATUS_STYLES = {
  "will-create": "bg-emerald-50 text-emerald-700 border-emerald-200",
  "mark-vacant": "bg-blue-50 text-blue-700 border-blue-200",
  "skip-existing": "bg-gray-50 text-gray-600 border-gray-200",
  "skip-conflict": "bg-amber-50 text-amber-700 border-amber-200",
  unmatched: "bg-red-50 text-red-700 border-red-200",
  ambiguous: "bg-red-50 text-red-700 border-red-200",
};
const STATUS_LABELS = {
  "will-create": "Create lease",
  "mark-vacant": "Mark vacant",
  "skip-existing": "Already imported",
  "skip-conflict": "Conflict",
  unmatched: "No match",
  ambiguous: "Ambiguous",
};

export default function ImportRentRoll() {
  const navigate = useNavigate();
  const addToast = useToast();
  const fileInputRef = useRef(null);

  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [previewing, setPreviewing] = useState(false);
  const [importing, setImporting] = useState(false);

  function reset() {
    setFile(null);
    setPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleFileSelected(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.name.toLowerCase().endsWith(".xlsx")) {
      addToast("Only .xlsx files are allowed", "error");
      e.target.value = "";
      return;
    }
    setFile(f);
    setPreview(null);
    setPreviewing(true);
    try {
      const data = await api.previewRentRollImport(f);
      setPreview(data);
    } catch (err) {
      addToast(err.message || "Preview failed", "error");
      reset();
    } finally {
      setPreviewing(false);
    }
  }

  async function handleImport() {
    if (!file) return;
    setImporting(true);
    try {
      const result = await api.commitRentRollImport(file);
      addToast(
        `Imported ${result.leasesCreated} leases (${result.tenantsCreated} new tenants, ${result.unitsMarkedVacant} units marked vacant)`
      );
      navigate("/leases");
    } catch (err) {
      addToast(err.message || "Import failed", "error");
    } finally {
      setImporting(false);
    }
  }

  // Group plan items by property for nicer display
  const planByProperty = (() => {
    if (!preview?.plan) return [];
    const map = new Map();
    for (const item of preview.plan) {
      const key = item.propertyName || "(unmatched)";
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(item);
    }
    return [...map.entries()].map(([name, items]) => ({ name, items }));
  })();

  return (
    <div className="space-y-6">
      {/* Header + secondary nav back to units importer */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Import Tenants & Leases</h1>
          <p className="mt-1 text-sm text-gray-500">
            Upload a Yardi <strong>Rent Roll</strong> export (.xlsx). We'll match each row to an
            existing unit, create the tenant + active lease, and sync unit status.
          </p>
        </div>
        <Link
          to="/import"
          className="text-xs font-medium text-blue-600 hover:underline"
        >
          ← Import units instead
        </Link>
      </div>

      {/* Upload card */}
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <div className="min-w-0">
              <p className="font-medium text-gray-900 truncate">
                {file ? file.name : "No file selected"}
              </p>
              <p className="mt-0.5 text-xs text-gray-500">
                {file
                  ? `${(file.size / 1024).toFixed(1)} KB`
                  : "Choose a Yardi Rent Roll export to begin"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {file && (
              <button
                onClick={reset}
                disabled={previewing || importing}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors cursor-pointer"
              >
                Clear
              </button>
            )}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={previewing || importing}
              className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
            >
              {previewing ? "Parsing..." : file ? "Choose Different File" : "Choose File"}
            </button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={handleFileSelected}
            className="hidden"
          />
        </div>
      </div>

      {/* Warnings */}
      {preview?.warnings?.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <h3 className="text-sm font-semibold text-amber-900">
            {preview.warnings.length} parser warning{preview.warnings.length === 1 ? "" : "s"}
          </h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-800">
            {preview.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {preview?.summary?.unmatchedDetails?.length > 0 && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <h3 className="text-sm font-semibold text-red-900">
            {preview.summary.unmatchedDetails.length} row{preview.summary.unmatchedDetails.length === 1 ? "" : "s"} couldn't be matched
          </h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-red-800">
            {preview.summary.unmatchedDetails.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Preview */}
      {preview && (
        <div className="rounded-xl border border-gray-200 bg-white">
          <div className="flex items-start justify-between gap-4 border-b border-gray-200 px-5 py-4">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Preview</h2>
              <p className="mt-0.5 text-xs text-gray-500">
                File contains {preview.totals.unitsInFile} units (
                {preview.totals.leasesInFile} occupied / {preview.totals.vacantInFile} vacant).
                Nothing has been saved yet.
              </p>
              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 font-medium text-emerald-700">
                  {preview.summary.willCreateLeases} new lease{preview.summary.willCreateLeases === 1 ? "" : "s"}
                </span>
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 font-medium text-emerald-700">
                  {preview.summary.willCreateTenants} new tenant{preview.summary.willCreateTenants === 1 ? "" : "s"}
                </span>
                <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 font-medium text-blue-700">
                  {preview.summary.willMarkVacant} mark vacant
                </span>
                {preview.summary.willSkipExisting > 0 && (
                  <span className="rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 font-medium text-gray-600">
                    {preview.summary.willSkipExisting} already imported
                  </span>
                )}
                {preview.summary.willSkipConflict > 0 && (
                  <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 font-medium text-amber-700">
                    {preview.summary.willSkipConflict} conflict
                  </span>
                )}
                {preview.summary.unmatched > 0 && (
                  <span className="rounded-full border border-red-200 bg-red-50 px-2 py-0.5 font-medium text-red-700">
                    {preview.summary.unmatched} unmatched
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={handleImport}
              disabled={importing || preview.summary.willCreateLeases + preview.summary.willMarkVacant === 0}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 cursor-pointer shrink-0"
            >
              {importing ? "Importing..." : "Import"}
            </button>
          </div>

          <div className="divide-y divide-gray-100">
            {planByProperty.map((g) => (
              <div key={g.name} className="px-5 py-4">
                <h3 className="text-sm font-semibold text-gray-900">{g.name}</h3>
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-gray-100 text-gray-500">
                        <th className="py-1.5 pr-3 font-medium">Unit</th>
                        <th className="py-1.5 pr-3 font-medium">Tenant</th>
                        <th className="py-1.5 pr-3 font-medium">Start</th>
                        <th className="py-1.5 pr-3 font-medium">End</th>
                        <th className="py-1.5 pr-3 font-medium">Rent</th>
                        <th className="py-1.5 pr-3 font-medium">Deposit</th>
                        <th className="py-1.5 pr-3 font-medium">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {g.items.map((item, i) => (
                        <tr key={i}>
                          <td className="py-1.5 pr-3 font-mono text-gray-900">
                            {item.unitNumber}
                          </td>
                          <td className="py-1.5 pr-3 text-gray-700">{item.tenantName || "—"}</td>
                          <td className="py-1.5 pr-3 text-gray-700">{fmtDate(item.startDate)}</td>
                          <td className="py-1.5 pr-3 text-gray-700">{fmtDate(item.endDate)}</td>
                          <td className="py-1.5 pr-3 text-gray-700">
                            {item.rentAmount != null ? fmtMoney(item.rentAmount) : "—"}
                          </td>
                          <td className="py-1.5 pr-3 text-gray-700">
                            {item.depositAmount != null ? fmtMoney(item.depositAmount) : "—"}
                          </td>
                          <td className="py-1.5 pr-3">
                            <span
                              className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-medium ${STATUS_STYLES[item.status] || ""}`}
                              title={item.reason || ""}
                            >
                              {STATUS_LABELS[item.status] || item.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
