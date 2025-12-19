"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { api, Project } from "@/lib/api";
import { HeroBanner } from "@/components/ui";

export default function EvaluationPage() {
  const params = useParams();
  const projectId = params.id as string;
  const [project, setProject] = useState<Project | null>(null);

  useEffect(() => {
    if (projectId) {
      api.projects.get(projectId)
        .then(setProject)
        .catch((err) => console.error("Failed to load project:", err));
    }
  }, [projectId]);

  return (
    <div>
      <nav className="mb-4 text-sm text-text-secondary">
        <Link href="/dashboard" className="hover:text-primary-600">
          Dashboard
        </Link>
        <span className="mx-2">/</span>
        <Link href="/projects" className="hover:text-primary-600">
          Projects
        </Link>
        <span className="mx-2">/</span>
        <Link href={`/projects/${projectId}`} className="hover:text-primary-600">
          {project?.name || "Project"}
        </Link>
        <span className="mx-2">/</span>
        <span className="text-text-primary">Evaluation</span>
      </nav>

      {/* Hero Banner */}
      <HeroBanner
        storageKey="evaluation-hero-banner"
        title="Welcome to Evaluation (Coming Soon)"
        description={
          <>
            The <strong>Evaluation</strong> module will help you systematically review and validate vendor responses against your requirements and RFP criteria. This is where data-driven vendor selection decisions are made.
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
            <div>This feature will help you make objective, data-driven vendor selection decisions.</div>
            <div>Stay tuned for powerful evaluation and comparison tools!</div>
          </>
        }
      />

      <div className="bg-background-secondary rounded-lg shadow-md p-12 text-center border border-border-primary">
        <h1 className="text-3xl font-bold mb-4 text-text-primary">Evaluation</h1>
        <p className="text-text-secondary mb-2">
          Review and validate vendor responses according to requirements and RFP
        </p>
        <p className="text-text-tertiary text-sm italic">Coming soon</p>
      </div>
    </div>
  );
}





