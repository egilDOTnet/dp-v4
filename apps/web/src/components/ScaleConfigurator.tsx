"use client";

import { useState, useEffect } from "react";

interface ScaleConfiguratorProps {
  scaleLabels: Record<string, string>;
  onChange: (labels: Record<string, string>) => void;
}

export default function ScaleConfigurator({
  scaleLabels,
  onChange,
}: ScaleConfiguratorProps) {
  const [numPoints, setNumPoints] = useState(
    Math.max(2, Object.keys(scaleLabels).length || 5)
  );
  const [labels, setLabels] = useState<Record<string, string>>(scaleLabels);

  useEffect(() => {
    // Initialize labels if empty
    if (Object.keys(labels).length === 0) {
      const initialLabels: Record<string, string> = {};
      for (let i = 1; i <= numPoints; i++) {
        initialLabels[i.toString()] = "";
      }
      setLabels(initialLabels);
      onChange(initialLabels);
    }
  }, []);

  const handleNumPointsChange = (newNum: number) => {
    if (newNum < 2) return;
    setNumPoints(newNum);

    const newLabels: Record<string, string> = {};
    for (let i = 1; i <= newNum; i++) {
      newLabels[i.toString()] = labels[i.toString()] || "";
    }
    setLabels(newLabels);
    onChange(newLabels);
  };

  const handleLabelChange = (point: string, label: string) => {
    const newLabels = { ...labels, [point]: label };
    setLabels(newLabels);
    onChange(newLabels);
  };

  return (
    <div className="border-t pt-4 space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Number of Scale Points
        </label>
        <input
          type="number"
          min="2"
          max="10"
          value={numPoints}
          onChange={(e) => handleNumPointsChange(parseInt(e.target.value) || 2)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Scale Labels (Optional)
        </label>
        <div className="space-y-2">
          {Array.from({ length: numPoints }, (_, i) => i + 1).map((point) => (
            <div key={point} className="flex items-center gap-2">
              <span className="w-8 text-sm font-medium text-gray-700">
                {point}:
              </span>
              <input
                type="text"
                value={labels[point.toString()] || ""}
                onChange={(e) => handleLabelChange(point.toString(), e.target.value)}
                placeholder={`Label for ${point} (e.g., Poor, Fair, Good, Excellent)`}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-gray-500">
          Add labels for each point on the scale. For example: 1 = "Poor", 2 =
          "Fair", 3 = "Good", 4 = "Excellent"
        </p>
      </div>
    </div>
  );
}
