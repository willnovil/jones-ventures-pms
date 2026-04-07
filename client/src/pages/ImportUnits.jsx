import { useState, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { api } from "../lib/api";
import { useToast } from "../components/Toast";

// Two-phase import flow:
//   1. User picks an .xlsx → call /preview → server returns the parsed
//      structure. Nothing is written yet.
//   2. User reviews the table and clicks "Import" → call /commit → server
//      re-parses the same buffer and writes everything in one transaction.
//
// We hold the File object across both calls instead of round-tripping the
// parsed JSON so the server is the only thing that can decide what gets
// written (defense against a tampered client).

function fmtMoney(n) {
  if (n == null) return "—";
  return `$${Number(n).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

export default function ImportUnits() {
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
      const data = await api.previewYardiImport(f);
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
      const result = await api.commitYardiImport(file);
      addToast(
        `Imported ${result.propertiesCreated} properties and ${result.unitsCreated} units`
      );
      navigate("/properties");
    } catch (err) {
      addToast(err.message || "Import failed", "error");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Import Units</h1>
          <p className="mt-1 text-sm text-gray-500">
            Upload a Yardi <strong>Unit Directory</strong> export (.xlsx). We'll
            group rows by street address into properties, then create one unit
            per row. You'll see a preview before anything is saved.
          </p>
        </div>
        <Link
          to="/import/rentroll"
          className="text-xs font-medium text-blue-600 hover:underline"
        >
          Import tenants & leases →
        </Link>
      </div>

      {/* Upload card */}
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </div>
            <div className="min-w-0">
              <p className="font-medium text-gray-900 truncate">
                {file ? file.name : "No file selected"}
              </p>
              <p className="mt-0.5 text-xs text-gray-500">
                {file
                  ? `${(file.size / 1024).toFixed(1)} KB`
                  : "Choose a Yardi Unit Directory export to begin"}
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
            {preview.warnings.length} warning{preview.warnings.length === 1 ? "" : "s"}
          </h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-800">
            {preview.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Preview */}
      {preview && (
        <div className="rounded-xl border border-gray-200 bg-white">
          <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Preview</h2>
              <p className="mt-0.5 text-xs text-gray-500">
                {preview.properties.length} propert
                {preview.properties.length === 1 ? "y" : "ies"} ·{" "}
                {preview.totalUnits} unit{preview.totalUnits === 1 ? "" : "s"} will be
                created. Nothing has been saved yet.
              </p>
            </div>
            <button
              onClick={handleImport}
              disabled={importing || preview.properties.length === 0}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
            >
              {importing
                ? "Importing..."
                : `Import ${preview.properties.length} / ${preview.totalUnits}`}
            </button>
          </div>

          <div className="divide-y divide-gray-100">
            {preview.properties.map((prop, i) => (
              <div key={i} className="px-5 py-4">
                <div className="flex items-baseline justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900">{prop.name}</h3>
                    <p className="mt-0.5 text-xs text-gray-500">
                      {prop.address}, {prop.city}, {prop.state} {prop.zip} ·{" "}
                      <span className="text-gray-400">{prop.type}</span>
                    </p>
                  </div>
                  <span className="text-xs font-medium text-gray-500">
                    {prop.units.length} unit{prop.units.length === 1 ? "" : "s"}
                  </span>
                </div>
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-gray-100 text-gray-500">
                        <th className="py-1.5 pr-3 font-medium">Unit</th>
                        <th className="py-1.5 pr-3 font-medium">BR</th>
                        <th className="py-1.5 pr-3 font-medium">BA</th>
                        <th className="py-1.5 pr-3 font-medium">Sqft</th>
                        <th className="py-1.5 pr-3 font-medium">Rent</th>
                        <th className="py-1.5 pr-3 font-medium">Deposit</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {prop.units.map((u, j) => (
                        <tr key={j}>
                          <td className="py-1.5 pr-3 font-mono text-gray-900">
                            {u.unitNumber}
                          </td>
                          <td className="py-1.5 pr-3 text-gray-700">{u.bedrooms}</td>
                          <td className="py-1.5 pr-3 text-gray-700">{u.bathrooms}</td>
                          <td className="py-1.5 pr-3 text-gray-700">{u.sqft || "—"}</td>
                          <td className="py-1.5 pr-3 text-gray-700">
                            {fmtMoney(u.rentAmount)}
                          </td>
                          <td className="py-1.5 pr-3 text-gray-700">
                            {fmtMoney(u.depositAmount)}
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
