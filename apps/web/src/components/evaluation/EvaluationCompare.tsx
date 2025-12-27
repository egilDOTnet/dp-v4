"use client";

import { useEffect, useState } from "react";
import { api, EvaluationComparison } from "@/lib/api";
import { LoadingSpinner } from "@/components/ui";

interface EvaluationCompareProps {
  projectId: string;
}

export function EvaluationCompare({ projectId }: EvaluationCompareProps) {
  const [comparison, setComparison] = useState<EvaluationComparison[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.evaluation
      .comparison(projectId)
      .then(setComparison)
      .catch((err) => {
        setError(err.message || "Failed to load comparison data");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [projectId]);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center text-red-600">
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-text-primary">Compare Evaluations</h2>
      <p className="text-text-secondary">Comparison view coming soon...</p>
      {/* TODO: Implement comparison view with hierarchy grouping, weights, bar graphs, and list view */}
    </div>
  );
}

