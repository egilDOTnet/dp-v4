"use client";

interface RequirementStats {
  total: number;
  byStatus: Record<string, number>;
  byType: Record<string, number>;
  unresolvedComments: number;
}

interface RequirementsWidgetProps {
  stats: RequirementStats;
}

const statusColors: Record<string, string> = {
  New: "bg-blue-100 text-blue-700 border-blue-300",
  ForReview: "bg-yellow-100 text-yellow-700 border-yellow-300",
  Approved: "bg-green-100 text-green-700 border-green-300",
  None: "bg-gray-100 text-gray-600 border-gray-300",
};

const statusLabels: Record<string, string> = {
  New: "New",
  ForReview: "For Review",
  Approved: "Approved",
  None: "No Status",
};

const typeColors: Record<string, string> = {
  Information: "bg-blue-50 text-blue-600 border-blue-200",
  Mandatory: "bg-red-50 text-red-600 border-red-200",
  Important: "bg-orange-50 text-orange-600 border-orange-200",
  Wish: "bg-green-50 text-green-600 border-green-200",
};

const typeIcons: Record<string, string> = {
  Information: "ℹ️",
  Mandatory: "⚠️",
  Important: "❗",
  Wish: "💡",
};

export default function RequirementsWidget({ stats }: RequirementsWidgetProps) {
  const statusEntries = Object.entries(stats.byStatus).filter(
    ([, count]) => count > 0
  );
  const typeEntries = Object.entries(stats.byType).filter(
    ([, count]) => count > 0
  );

  return (
    <div className="bg-white rounded-lg shadow-md p-6 h-full">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Requirements</h3>
        <div className="flex items-center justify-center w-12 h-12 rounded-full bg-indigo-100">
          <span className="text-2xl font-bold text-indigo-600">
            {stats.total}
          </span>
        </div>
      </div>

      {stats.total === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <p className="text-sm">No requirements yet</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Unresolved Comments Alert */}
          {stats.unresolvedComments > 0 && (
            <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-md">
              <span className="text-2xl">💬</span>
              <div className="flex-1">
                <p className="text-sm font-medium text-amber-900">
                  {stats.unresolvedComments} unresolved comment
                  {stats.unresolvedComments !== 1 ? "s" : ""}
                </p>
              </div>
              <span className="text-lg font-bold text-amber-700">
                {stats.unresolvedComments}
              </span>
            </div>
          )}

          {/* By Status */}
          <div>
            <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">
              By Status
            </h4>
            <div className="space-y-2">
              {statusEntries.map(([status, count]) => (
                <div
                  key={status}
                  className={`flex items-center justify-between px-3 py-2 rounded-md border text-sm font-medium ${
                    statusColors[status] || statusColors.None
                  }`}
                >
                  <span>{statusLabels[status] || status}</span>
                  <span className="font-bold">{count}</span>
                </div>
              ))}
            </div>
          </div>

          {/* By Type */}
          <div>
            <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">
              By Type
            </h4>
            <div className="grid grid-cols-2 gap-2">
              {typeEntries.map(([type, count]) => (
                <div
                  key={type}
                  className={`flex items-center justify-between px-3 py-2 rounded-md border ${
                    typeColors[type] || "bg-gray-50 text-gray-600 border-gray-300"
                  }`}
                >
                  <span className="flex items-center gap-1 text-xs font-medium">
                    <span>{typeIcons[type]}</span>
                    <span>{type}</span>
                  </span>
                  <span className="text-sm font-bold">{count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

