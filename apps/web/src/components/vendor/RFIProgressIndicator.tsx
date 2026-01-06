"use client";

interface RFIProgressIndicatorProps {
  current: number;
  total: number;
}

export function RFIProgressIndicator({ current, total }: RFIProgressIndicatorProps) {
  const percentage = (current / total) * 100;

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-text-primary">
          Question {current} of {total}
        </span>
        <span className="text-sm text-text-secondary">
          {Math.round(percentage)}%
        </span>
      </div>
      <div className="w-full bg-background-secondary rounded-full h-2">
        <div
          className="bg-primary-600 h-2 rounded-full transition-all duration-300"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}





