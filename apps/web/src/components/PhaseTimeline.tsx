"use client";

import { Phase } from "@/lib/api";
import { useState } from "react";

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

const statusLabels = {
  not_started: "Not Started",
  ongoing: "Ongoing",
  delayed: "Delayed",
  completed: "Completed",
};

export default function PhaseTimeline({
  phases,
  selectedPhaseId,
  onPhaseClick,
}: PhaseTimelineProps) {
  const [hoveredPhaseId, setHoveredPhaseId] = useState<string | null>(null);
  const sortedPhases = [...phases].sort((a, b) => a.order - b.order);

  return (
    <div className="bg-background-secondary rounded-lg shadow-md p-6 border border-border-primary">
      <h3 className="text-lg font-semibold text-text-primary mb-4">Project Phases</h3>
      <div className="flex gap-2 justify-between">
        {sortedPhases.map((phase) => {
          const isSelected = phase.id === selectedPhaseId;
          const isHovered = phase.id === hoveredPhaseId;
          const statusColor = statusColors[phase.status];
          const borderColor = statusBorders[phase.status];

          return (
            <div key={phase.id} className="relative group flex-1">
              <button
                onClick={() => onPhaseClick(phase.id)}
                onMouseEnter={() => setHoveredPhaseId(phase.id)}
                onMouseLeave={() => setHoveredPhaseId(null)}
                className={`
                  w-full flex flex-col items-center justify-center p-2 rounded-lg shadow-md
                  transition-all duration-200 h-20
                  ${statusColor}
                  ${isSelected ? `ring-4 ring-blue-500 ${borderColor} border-2` : "border-2 border-transparent"}
                  cursor-pointer
                `}
              >
                <div className="text-xl font-bold text-gray-800 mb-1">
                  {phase.order}
                </div>
                <div className="text-xs font-medium text-gray-700">
                  {phase.completedTaskCount}/{phase.taskCount}
                </div>
              </button>
              
              {/* Tooltip on hover */}
              {isHovered && (
                <div className="absolute z-50 top-full left-1/2 transform -translate-x-1/2 mt-2 w-64 p-3 bg-background-primary text-text-primary text-sm rounded-lg shadow-lg pointer-events-none border border-border-primary">
                  <div className="font-semibold mb-1">
                    Phase {phase.order}: {phase.name}
                  </div>
                  <div className="text-gray-300 text-xs">
                    Status: {statusLabels[phase.status]}
                  </div>
                  <div className="text-gray-300 text-xs">
                    Tasks: {phase.completedTaskCount} of {phase.taskCount} completed
                  </div>
                  {/* Arrow pointing up */}
                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-8 border-r-8 border-b-8 border-transparent border-b-gray-900"></div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

