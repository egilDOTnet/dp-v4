"use client";

import { useEffect, useState, useRef } from "react";
import { api, EvaluationComparison } from "@/lib/api";
import { LoadingSpinner } from "@/components/ui";

interface EvaluationCompareProps {
  projectId: string;
}

export function EvaluationCompare({ projectId }: EvaluationCompareProps) {
  const [_comparison, setComparison] = useState<EvaluationComparison[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loadingRef = useRef(false);
  const lastLoadKeyRef = useRef<string>("");

  useEffect(() => {
    if (!projectId) return;

    // Create a unique key for this load based on dependencies
    const loadKey = `compare-${projectId}`;

    // Prevent duplicate calls with the same dependencies (React Strict Mode protection)
    if (loadingRef.current && lastLoadKeyRef.current === loadKey) {
      return;
    }

    loadingRef.current = true;
    lastLoadKeyRef.current = loadKey;
    setLoading(true);
    setError(null);

    api.evaluation
      .comparison(projectId)
      .then((data) => {
        // Only update if this is still the current load
        if (lastLoadKeyRef.current === loadKey) {
          setComparison(data);
        }
      })
      .catch((err) => {
        // Only log error if this is still the current load
        if (lastLoadKeyRef.current === loadKey) {
          setError(err.message || "Failed to load comparison data");
        }
      })
      .finally(() => {
        // Only update loading state if this is still the current load
        if (lastLoadKeyRef.current === loadKey) {
          setLoading(false);
          loadingRef.current = false;
        }
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

