"use client";

interface VendorStats {
  total: number;
  byStatus: Record<string, number>;
}

interface VendorWidgetProps {
  stats: VendorStats;
}

const statusColors: Record<string, string> = {
  Pending: "bg-gray-100 text-gray-700 border-gray-300",
  RFI_Received: "bg-blue-100 text-blue-700 border-blue-300",
  RFI_Started: "bg-purple-100 text-purple-700 border-purple-300",
  RFI_Answered: "bg-primary-100 text-primary-700 border-primary-300",
  RFP_Received: "bg-purple-100 text-purple-700 border-purple-300",
  RFP_Delivered: "bg-indigo-100 text-indigo-700 border-indigo-300",
  RFP_Rejected: "bg-orange-100 text-orange-700 border-orange-300",
  Shortlisted: "bg-yellow-100 text-yellow-700 border-yellow-300",
  Lost: "bg-gray-100 text-gray-500 border-gray-300",
  Won: "bg-primary-100 text-primary-800 border-primary-400",
};

const statusLabels: Record<string, string> = {
  Pending: "Pending",
  RFI_Received: "RFI Received",
  RFI_Started: "RFI Started",
  RFI_Answered: "RFI Answered",
  RFP_Received: "RFP Received",
  RFP_Delivered: "RFP Delivered",
  RFP_Rejected: "RFP Rejected",
  Shortlisted: "Shortlisted",
  Lost: "Lost",
  Won: "Won",
};

export default function VendorWidget({ stats }: VendorWidgetProps) {
  const statusesWithVendors = Object.entries(stats.byStatus).filter(
    ([, count]) => count > 0
  );

  return (
    <div className="bg-background-secondary rounded-lg shadow-md p-6 h-full border border-border-primary">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-text-primary">Vendors</h3>
        <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary-100">
          <span className="text-2xl font-bold text-primary-600">
            {stats.total}
          </span>
        </div>
      </div>

      {stats.total === 0 ? (
        <div className="text-center py-8 text-text-secondary">
          <p className="text-sm">No vendors yet</p>
        </div>
      ) : (
        <div>
          <h4 className="text-xs font-semibold text-text-secondary uppercase mb-2">
            By Status
          </h4>
          <div className="space-y-2">
            {statusesWithVendors.map(([status, count]) => (
              <div
                key={status}
                className={`flex items-center justify-between px-3 py-2 rounded-md border ${
                  statusColors[status] || "bg-gray-100 text-gray-700 border-gray-300"
                }`}
              >
                <span className="text-sm font-medium">
                  {statusLabels[status] || status}
                </span>
                <span className="text-sm font-bold">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
