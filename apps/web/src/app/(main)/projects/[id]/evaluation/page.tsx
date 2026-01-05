"use client";

import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { api, Project } from "@/lib/api";
import { HeroBanner, Breadcrumbs, Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui";
import { EvaluationOverview } from "@/components/evaluation/EvaluationOverview";
import { EvaluationCompare } from "@/components/evaluation/EvaluationCompare";
import { ReferenceChecks } from "@/components/evaluation/ReferenceChecks";
import { EvaluationScoring } from "@/components/evaluation/EvaluationScoring";
import { EvaluationDocuments } from "@/components/evaluation/EvaluationDocuments";

export default function EvaluationPage() {
  const params = useParams();
  const { user } = useAuth();
  const projectId = params.id as string;
  const [project, setProject] = useState<Project | null>(null);
  const [activeTab, setActiveTab] = useState<string>("score");
  const loadingRef = useRef(false);
  const lastLoadKeyRef = useRef<string>("");
  const summaryLoadingRef = useRef(false);
  const lastSummaryLoadKeyRef = useRef<string>("");

  // Check if user is a project admin for THIS specific project
  // Global Admins are always project admins
  // Company Admins are only project admins if their tenant matches the project's tenant
  const isProjectAdmin =
    user?.role === "GlobalAdministrator" ||
    (user?.role === "CompanyAdministrator" && user?.tenantId === project?.tenantId);

  useEffect(() => {
    if (!projectId) return;

    // Create a unique key for this load
    const loadKey = `project-${projectId}`;

    // Prevent duplicate calls with the same dependencies (React Strict Mode protection)
    if (loadingRef.current && lastLoadKeyRef.current === loadKey) {
      return;
    }

    loadingRef.current = true;
    lastLoadKeyRef.current = loadKey;

    api.projects
      .get(projectId)
      .then((data) => {
        // Only update if this is still the current load
        if (lastLoadKeyRef.current === loadKey) {
          setProject(data);
        }
      })
      .catch((err) => {
        // Only log error if this is still the current load
        if (lastLoadKeyRef.current === loadKey) {
          console.error("Failed to load project:", err);
        }
      })
      .finally(() => {
        // Only update loading state if this is still the current load
        if (lastLoadKeyRef.current === loadKey) {
          loadingRef.current = false;
        }
      });
  }, [projectId]);

  // Check if scoring is completed and set default tab to overview if so
  useEffect(() => {
    if (!projectId || !isProjectAdmin) {
      return;
    }

    // Create a unique key for this load
    const loadKey = `summary-${projectId}`;

    // Prevent duplicate calls with the same dependencies (React Strict Mode protection)
    if (summaryLoadingRef.current && lastSummaryLoadKeyRef.current === loadKey) {
      return;
    }

    summaryLoadingRef.current = true;
    lastSummaryLoadKeyRef.current = loadKey;

    api.evaluation
      .summary(projectId)
      .then((summary) => {
        // Only update if this is still the current load
        if (lastSummaryLoadKeyRef.current === loadKey) {
          // If all evaluations are completed, default to overview
          if (summary.stats.evaluationsCompleted === summary.stats.totalNeeded && summary.stats.totalNeeded > 0) {
            setActiveTab("overview");
          }
        }
      })
      .catch((err) => {
        // Only log error if this is still the current load
        if (lastSummaryLoadKeyRef.current === loadKey) {
          // If summary fails (e.g., no RFP yet), just use default "score" tab
          console.error("Failed to check evaluation completion:", err);
        }
      })
      .finally(() => {
        // Only update loading state if this is still the current load
        if (lastSummaryLoadKeyRef.current === loadKey) {
          summaryLoadingRef.current = false;
        }
      });
  }, [projectId, isProjectAdmin]);

  const breadcrumbItems = [
    { label: "Home", href: "/dashboard?noAutoRedirect=true" },
    { label: project?.name || "Project", href: `/projects/${projectId}` },
    { label: "Evaluation" },
  ];

  return (
    <div>
      <Breadcrumbs items={breadcrumbItems} />

      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-4">Evaluation</h1>

        {/* Hero Banner */}
        <HeroBanner
          storageKey="evaluation-hero-banner"
          title="Welcome to Evaluation"
          description={
            <>
              The <strong>Evaluation</strong> module helps you systematically review and validate vendor responses against your requirements and RFP criteria. This is where data-driven vendor selection decisions are made.
            </>
          }
          features={[
            {
              label: "Compare responses",
              description: "Side-by-side comparison of vendor proposals",
            },
            {
              label: "Score against requirements",
              description: "Evaluate how well each vendor meets your needs",
            },
            {
              label: "Add evaluation comments",
              description: "Capture team feedback and assessment notes",
            },
            {
              label: "Track evaluation progress",
              description: "Monitor which vendors have been reviewed",
            },
          ]}
          tip={
            <>
              <div className="font-bold not-italic mb-1">Tip:</div>
              <div>This feature helps you make objective, data-driven vendor selection decisions.</div>
              <div>Use the Score tab to evaluate vendors, and the Compare tab (admin-only) to see aggregated results.</div>
            </>
          }
        />
      </div>

      <div className="mt-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="border-b border-gray-200">
            <TabsList>
              {isProjectAdmin && (
                <>
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="compare">Compare</TabsTrigger>
                </>
              )}
              <TabsTrigger value="documents">Documents</TabsTrigger>
              <TabsTrigger value="references">References</TabsTrigger>
              <TabsTrigger value="score">Score</TabsTrigger>
            </TabsList>
          </div>

          {isProjectAdmin && (
            <>
              <TabsContent value="overview">
                <EvaluationOverview projectId={projectId} />
              </TabsContent>
              <TabsContent value="compare">
                <EvaluationCompare projectId={projectId} />
              </TabsContent>
            </>
          )}

          <TabsContent value="documents">
            <EvaluationDocuments projectId={projectId} project={project} />
          </TabsContent>

          <TabsContent value="references">
            <ReferenceChecks projectId={projectId} />
          </TabsContent>

          <TabsContent value="score">
            <EvaluationScoring projectId={projectId} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}





