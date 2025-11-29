"use client";

import { Phase } from "@/lib/api";

interface PhaseTimelineProps {
  phases: Phase[];
  selectedPhaseId: string | null;
  onPhaseClick: (phaseId: string) => void;
}

const statusColors = {
  not_started: "bg-gray-300 hover:bg-gray-400",
  ongoing: "bg-yellow-400 hover:bg-yellow-500",
  delayed: "bg-red-400 hover:bg-red-500",
  completed: "bg-green-400 hover:bg-green-500",
};

const statusBorders = {
  not_started: "border-gray-400",
  ongoing: "border-yellow-500",
  delayed: "border-red-500",
  completed: "border-green-500",
};

export default function PhaseTimeline({
  phases,
  selectedPhaseId,
  onPhaseClick,
}: PhaseTimelineProps) {
  const sortedPhases = [...phases].sort((a, b) => a.order - b.order);

  return (
    <div className="w-full overflow-x-auto">
      <div className="flex gap-4 min-w-max py-4 pl-2">
        {sortedPhases.map((phase, index) => {
          const isSelected = phase.id === selectedPhaseId;
          const statusColor = statusColors[phase.status];
          const borderColor = statusBorders[phase.status];

          return (
            <div key={phase.id} className="flex items-center">
              <button
                onClick={() => onPhaseClick(phase.id)}
                className={`
                  relative flex flex-col items-center justify-center p-4 rounded-lg shadow-md
                  transition-all duration-200 min-w-[180px] max-w-[200px] h-24
                  ${statusColor}
                  ${isSelected ? `ring-4 ring-blue-500 ${borderColor} border-2` : "border-2 border-transparent"}
                  cursor-pointer
                `}
              >
                <div className="text-sm font-semibold text-gray-800 mb-2 text-center">
                  {phase.order}. {phase.name}
                </div>
                <div className="text-xs font-medium text-gray-700">
                  {phase.completedTaskCount}/{phase.taskCount}
                </div>
              </button>
              {index < sortedPhases.length - 1 && (
                <div className="w-4 h-1 bg-gray-400 mx-2" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

