const BASE = "/api";

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (res.status === 401) {
    // Session expired or never signed in — bounce to login.
    if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
      window.location.assign("/login");
    }
    throw new Error("Not signed in");
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || "Request failed");
  }
  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  // Properties
  getProperties: () => request("/properties"),
  getProperty: (id) => request(`/properties/${id}`),
  createProperty: (data) => request("/properties", { method: "POST", body: JSON.stringify(data) }),
  updateProperty: (id, data) => request(`/properties/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteProperty: (id) => request(`/properties/${id}`, { method: "DELETE" }),

  // Units
  getUnits: () => request("/units"),
  getUnit: (id) => request(`/units/${id}`),
  createUnit: (data) => request("/units", { method: "POST", body: JSON.stringify(data) }),
  updateUnit: (id, data) => request(`/units/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteUnit: (id) => request(`/units/${id}`, { method: "DELETE" }),

  // Tenants
  getTenants: () => request("/tenants"),
  getTenant: (id) => request(`/tenants/${id}`),
  createTenant: (data) => request("/tenants", { method: "POST", body: JSON.stringify(data) }),
  updateTenant: (id, data) => request(`/tenants/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteTenant: (id) => request(`/tenants/${id}`, { method: "DELETE" }),

  // Leases
  getLeases: () => request("/leases"),
  getLease: (id) => request(`/leases/${id}`),
  createLease: (data) => request("/leases", { method: "POST", body: JSON.stringify(data) }),
  updateLease: (id, data) => request(`/leases/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteLease: (id) => request(`/leases/${id}`, { method: "DELETE" }),
  importExistingLease: async (formData) => {
    // formData is a FormData instance built by the AddExistingLease page.
    // We don't pass Content-Type — the browser sets the multipart boundary.
    const res = await fetch("/api/leases/import-existing", {
      method: "POST",
      credentials: "include",
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || "Import failed");
    }
    return res.json();
  },
  generateLeaseDocument: (id) => request(`/leases/${id}/generate`, { method: "POST" }),
  leaseDocumentUrl: (id) => `/api/leases/${id}/document`,
  // Append ?download=1 so the server forces an attachment Content-Disposition
  // (otherwise PDFs render inline, which is what the iframe preview wants).
  leaseDocumentDownloadUrl: (id) => `/api/leases/${id}/document?download=1`,
  uploadLeaseDocument: async (id, file) => {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(`/api/leases/${id}/upload-document`, {
      method: "POST",
      credentials: "include",
      body: fd,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || "Upload failed");
    }
    return res.json();
  },
  reviewLease: (id) => request(`/leases/${id}/review`, { method: "POST" }),
  approveLease: (id, approvedBy) => request(`/leases/${id}/approve`, { method: "POST", body: JSON.stringify({ approvedBy }) }),
  sendLease: (id) => request(`/leases/${id}/send`, { method: "POST" }),
  signLease: (id) => request(`/leases/${id}/sign`, { method: "POST" }),

  // Templates
  getLeaseTemplate: () => request("/templates/lease"),
  uploadLeaseTemplate: async (file) => {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch("/api/templates/lease", {
      method: "POST",
      credentials: "include",
      body: form,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || "Upload failed");
    }
    return res.json();
  },
  deleteLeaseTemplate: () => request("/templates/lease", { method: "DELETE" }),

  // Transactions
  getTransactions: () => request("/transactions"),
  getTransaction: (id) => request(`/transactions/${id}`),
  createTransaction: (data) => request("/transactions", { method: "POST", body: JSON.stringify(data) }),
  updateTransaction: (id, data) => request(`/transactions/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteTransaction: (id) => request(`/transactions/${id}`, { method: "DELETE" }),

  // Maintenance
  getMaintenanceRequests: () => request("/maintenance"),
  getMaintenanceRequest: (id) => request(`/maintenance/${id}`),
  createMaintenanceRequest: (data) => request("/maintenance", { method: "POST", body: JSON.stringify(data) }),
  updateMaintenanceRequest: (id, data) => request(`/maintenance/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteMaintenanceRequest: (id) => request(`/maintenance/${id}`, { method: "DELETE" }),

  // Leads
  getLeads: () => request("/leads"),
  getLead: (id) => request(`/leads/${id}`),
  createLead: (data) => request("/leads", { method: "POST", body: JSON.stringify(data) }),
  updateLead: (id, data) => request(`/leads/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteLead: (id) => request(`/leads/${id}`, { method: "DELETE" }),

  // Dashboard
  getDashboard: () => request("/dashboard"),

  // Imports — Yardi unit directory xlsx
  previewYardiImport: async (file) => {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch("/api/imports/yardi-units/preview", {
      method: "POST",
      credentials: "include",
      body: form,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || "Preview failed");
    }
    return res.json();
  },
  commitYardiImport: async (file) => {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch("/api/imports/yardi-units/commit", {
      method: "POST",
      credentials: "include",
      body: form,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || "Import failed");
    }
    return res.json();
  },

  // Yardi Rent Roll xlsx → Tenants + Leases
  previewRentRollImport: async (file) => {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch("/api/imports/yardi-rentroll/preview", {
      method: "POST",
      credentials: "include",
      body: form,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || "Preview failed");
    }
    return res.json();
  },
  commitRentRollImport: async (file) => {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch("/api/imports/yardi-rentroll/commit", {
      method: "POST",
      credentials: "include",
      body: form,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || "Import failed");
    }
    return res.json();
  },
};
