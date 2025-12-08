"use client";

interface RFIStats {
  questionCount: number;
  status: "planning" | "ongoing" | "finished";
  deadline: string | null;
}

interface RFIWidgetProps {
  stats: RFIStats;
}

const statusConfig = {
  planning: {
    label: "Planning",
    color: "bg-gray-100 text-gray-700 border-gray-300",
    icon: "📝",
  },
  ongoing: {
    label: "Ongoing",
    color: "bg-blue-100 text-blue-700 border-blue-300",
    icon: "🚀",
  },
  finished: {
    label: "Finished",
    color: "bg-green-100 text-green-700 border-green-300",
    icon: "✅",
  },
};

export default function RFIWidget({ stats }: RFIWidgetProps) {
  const config = statusConfig[stats.status];

  return (
    <div className="bg-background-secondary rounded-lg shadow-md p-6 h-full border border-border-primary">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-text-primary">RFI</h3>
        <div className="flex items-center justify-center w-12 h-12 rounded-full bg-blue-100">
          <span className="text-2xl font-bold text-blue-600">
            {stats.questionCount}
          </span>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <h4 className="text-xs font-semibold text-text-secondary uppercase mb-2">
            Status
          </h4>
          <div
            className={`flex items-center justify-between px-3 py-2 rounded-md border ${config.color}`}
          >
            <span className="flex items-center gap-2 text-sm font-medium">
              <span className="text-lg">{config.icon}</span>
              <span>{config.label}</span>
            </span>
          </div>
        </div>

        {stats.deadline && (
          <div>
            <h4 className="text-xs font-semibold text-text-secondary uppercase mb-2">
              Deadline
            </h4>
            <div className="p-3 bg-orange-50 border border-orange-200 rounded-md">
              <p className="text-sm text-orange-900 font-semibold">
                {new Date(stats.deadline).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </p>
            </div>
          </div>
        )}

        {stats.questionCount === 0 && stats.status === "planning" && (
          <div className="text-center py-4 text-text-secondary">
            <p className="text-sm">No questions added yet</p>
          </div>
        )}
      </div>
    </div>
  );
}
