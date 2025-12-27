"use client";

import { useEffect, useState } from "react";
import { api, EvaluationSummary } from "@/lib/api";
import { Card, CardBody, LoadingSpinner } from "@/components/ui";

interface EvaluationOverviewProps {
  projectId: string;
}

export function EvaluationOverview({ projectId }: EvaluationOverviewProps) {
  const [summary, setSummary] = useState<EvaluationSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.evaluation
      .summary(projectId)
      .then(setSummary)
      .catch((err) => {
        setError(err.message || "Failed to load evaluation summary");
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

  if (!summary) {
    return (
      <div className="text-center text-text-secondary">
        <p>No evaluation data available</p>
      </div>
    );
  }

  const { stats } = summary;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card>
          <CardBody>
            <div className="text-sm text-text-secondary mb-1">Total Requirements</div>
            <div className="text-3xl font-bold text-text-primary">{stats.totalRequirements}</div>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <div className="text-sm text-text-secondary mb-1">Vendors Submitted</div>
            <div className="text-3xl font-bold text-text-primary">
              {stats.submittedVendors} / {stats.totalVendors}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <div className="text-sm text-text-secondary mb-1">Evaluations Completed</div>
            <div className="text-3xl font-bold text-text-primary">
              {stats.evaluationsCompleted} / {stats.totalNeeded}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <div className="text-sm text-text-secondary mb-1">Average Score</div>
            <div className="text-3xl font-bold text-text-primary">{stats.averageScore.toFixed(1)}</div>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <div className="text-sm text-text-secondary mb-1">Notes & Questions</div>
            <div className="flex items-baseline gap-2">
              <div className="text-3xl font-bold text-text-primary">
                {stats.notesCount}
              </div>
              <div className="text-lg text-text-secondary">/</div>
              <div className="text-3xl font-bold text-text-primary">
                {stats.questionsCount}
              </div>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <div className="text-sm text-text-secondary mb-1">Evaluators Completed</div>
            <div className="text-3xl font-bold text-text-primary">
              {stats.evaluatorsActive} / {stats.totalEvaluators}
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

