const COLORS = {
  // Unit statuses
  VACANT: "bg-green-50 text-green-700 ring-green-600/20",
  OCCUPIED: "bg-blue-50 text-blue-700 ring-blue-600/20",
  MAINTENANCE: "bg-orange-50 text-orange-700 ring-orange-600/20",
  // Lease statuses
  DRAFT: "bg-gray-100 text-gray-700 ring-gray-500/20",
  PENDING_REVIEW: "bg-yellow-50 text-yellow-700 ring-yellow-600/20",
  APPROVED: "bg-purple-50 text-purple-700 ring-purple-600/20",
  ACTIVE: "bg-green-50 text-green-700 ring-green-600/20",
  EXPIRED: "bg-gray-100 text-gray-600 ring-gray-500/20",
  TERMINATED: "bg-red-50 text-red-700 ring-red-600/20",
  // Maintenance statuses
  OPEN: "bg-red-50 text-red-700 ring-red-600/20",
  IN_PROGRESS: "bg-yellow-50 text-yellow-700 ring-yellow-600/20",
  COMPLETED: "bg-green-50 text-green-700 ring-green-600/20",
  // Maintenance priorities
  LOW: "bg-gray-100 text-gray-600 ring-gray-500/20",
  MEDIUM: "bg-blue-50 text-blue-700 ring-blue-600/20",
  HIGH: "bg-orange-50 text-orange-700 ring-orange-600/20",
  EMERGENCY: "bg-red-50 text-red-700 ring-red-600/20",
  // Transaction types
  CHARGE: "bg-red-50 text-red-700 ring-red-600/20",
  PAYMENT: "bg-green-50 text-green-700 ring-green-600/20",
  CREDIT: "bg-blue-50 text-blue-700 ring-blue-600/20",
  LATE_FEE: "bg-orange-50 text-orange-700 ring-orange-600/20",
  // Signature statuses
  PENDING: "bg-yellow-50 text-yellow-700 ring-yellow-600/20",
  SENT: "bg-blue-50 text-blue-700 ring-blue-600/20",
  SIGNED: "bg-green-50 text-green-700 ring-green-600/20",
  // Lead statuses
  NEW: "bg-blue-50 text-blue-700 ring-blue-600/20",
  CONTACTED: "bg-purple-50 text-purple-700 ring-purple-600/20",
  SHOWING: "bg-yellow-50 text-yellow-700 ring-yellow-600/20",
  APPLIED: "bg-orange-50 text-orange-700 ring-orange-600/20",
  CONVERTED: "bg-green-50 text-green-700 ring-green-600/20",
  LOST: "bg-gray-100 text-gray-600 ring-gray-500/20",
};

export default function StatusBadge({ status }) {
  const label = (status || "").replace(/_/g, " ");
  const color = COLORS[status] || "bg-gray-100 text-gray-600 ring-gray-500/20";
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${color}`}>
      {label}
    </span>
  );
}
