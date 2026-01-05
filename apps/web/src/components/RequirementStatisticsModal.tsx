"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/Dialog";
import { api } from "@/lib/api";
import { LoadingSpinner } from "@/components/ui";

interface RequirementStatisticsModalProps {
  projectId: string;
  open: boolean;
  onClose: () => void;
}

interface Statistics {
  total: number;
  byType: {
    Information: number;
    Mandatory: number;
    Important: number;
    Wish: number;
  };
  byStatus: {
    Approved: number;
    ForReview: number;
    New: number;
    Imported: number;
  };
  withUnsolvedComments: number;
}

export default function RequirementStatisticsModal({
  projectId,
  open,
  onClose,
}: RequirementStatisticsModalProps) {
  const [statistics, setStatistics] = useState<Statistics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && projectId) {
      setLoading(true);
      setError(null);
      api.requirements
        .statistics(projectId)
        .then((data) => {
          setStatistics(data);
        })
        .catch((err) => {
          setError(err.message || "Failed to load statistics");
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [open, projectId]);

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-[600px] max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Requirement Statistics</DialogTitle>
          <DialogDescription>
            Overview of requirements in this project
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 overflow-y-auto flex-1">
          {loading && (
            <div className="flex justify-center py-8">
              <LoadingSpinner />
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          {statistics && !loading && (
            <div className="space-y-4">
              {/* Total */}
              <div>
                <h3 className="text-lg font-semibold mb-2">Total Requirements</h3>
                <p className="text-3xl font-bold text-primary-600">{statistics.total}</p>
              </div>

              {/* By Type */}
              <div>
                <h3 className="text-sm font-semibold mb-2">By Type</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-50 p-3 rounded">
                    <div className="text-xs text-gray-600">Information</div>
                    <div className="text-lg font-bold">{statistics.byType.Information}</div>
                  </div>
                  <div className="bg-gray-50 p-3 rounded">
                    <div className="text-xs text-gray-600">Mandatory</div>
                    <div className="text-lg font-bold">{statistics.byType.Mandatory}</div>
                  </div>
                  <div className="bg-gray-50 p-3 rounded">
                    <div className="text-xs text-gray-600">Important</div>
                    <div className="text-lg font-bold">{statistics.byType.Important}</div>
                  </div>
                  <div className="bg-gray-50 p-3 rounded">
                    <div className="text-xs text-gray-600">Wish</div>
                    <div className="text-lg font-bold">{statistics.byType.Wish}</div>
                  </div>
                </div>
              </div>

              {/* By Status */}
              <div>
                <h3 className="text-sm font-semibold mb-2">By Status</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-50 p-3 rounded">
                    <div className="text-xs text-gray-600">Approved</div>
                    <div className="text-lg font-bold">{statistics.byStatus.Approved}</div>
                  </div>
                  <div className="bg-gray-50 p-3 rounded">
                    <div className="text-xs text-gray-600">For Review</div>
                    <div className="text-lg font-bold">{statistics.byStatus.ForReview}</div>
                  </div>
                  <div className="bg-gray-50 p-3 rounded">
                    <div className="text-xs text-gray-600">New</div>
                    <div className="text-lg font-bold">{statistics.byStatus.New}</div>
                  </div>
                  <div className="bg-gray-50 p-3 rounded">
                    <div className="text-xs text-gray-600">Imported</div>
                    <div className="text-lg font-bold">{statistics.byStatus.Imported}</div>
                  </div>
                </div>
              </div>

              {/* Unsolved Comments */}
              <div>
                <h3 className="text-sm font-semibold mb-2">Comments</h3>
                <div className="bg-gray-50 p-3 rounded">
                  <div className="text-xs text-gray-600">Requirements with Unsolved Comments</div>
                  <div className="text-lg font-bold">
                    {statistics.withUnsolvedComments}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

