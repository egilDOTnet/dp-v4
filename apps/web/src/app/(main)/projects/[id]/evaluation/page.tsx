"use client";

import { useEffect, useState } from "react";
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

  const isAdmin =
    user?.role === "CompanyAdministrator" || user?.role === "GlobalAdministrator";

  useEffect(() => {
    if (projectId) {
      api.projects
        .get(projectId)
        .then(setProject)
        .catch((err) => console.error("Failed to load project:", err));
    }
  }, [projectId]);

  const breadcrumbItems = [
    { label: "Home", href: "/dashboard?noAutoRedirect=true" },
    { label: "Projects", href: "/projects" },
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
          <TabsList className="relative">
            {isAdmin && (
              <>
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="compare">Compare</TabsTrigger>
              </>
            )}
            <TabsTrigger value="documents">Documents</TabsTrigger>
            <TabsTrigger value="references">References</TabsTrigger>
            <TabsTrigger value="score">Score</TabsTrigger>
          </TabsList>

          {isAdmin && (
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





