"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { api, Project } from "@/lib/api";
import { HeroBanner } from "@/components/ui";

export default function NegotiationPage() {
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
        <span className="text-text-primary">Negotiation</span>
      </nav>

      {/* Hero Banner */}
      <HeroBanner
        storageKey="negotiation-hero-banner"
        title="Welcome to Negotiation (Coming Soon)"
        description={
          <>
            The <strong>Negotiation</strong> module will help you engage with selected vendors during the final stages of vendor selection. This is where you refine details, clarify evaluation comments, and finalize agreements.
          </>
        }
        features={[
          {
            label: "Track evaluation comments",
            description: "Reference feedback and concerns from the evaluation phase",
          },
          {
            label: "Q&A with vendors",
            description: "Exchange questions and answers to clarify proposals",
          },
          {
            label: "Negotiation history",
            description: "Keep a complete record of all communications and changes",
          },
          {
            label: "Document agreements",
            description: "Track commitments and modifications to original proposals",
          },
        ]}
        tip={
          <>
            <div className="font-bold not-italic mb-1">Tip:</div>
            <div>This feature will help maintain clear communication during final vendor selection.</div>
            <div>All negotiation history will be documented for future reference and compliance!</div>
          </>
        }
      />

      <div className="bg-background-secondary rounded-lg shadow-md p-12 text-center border border-border-primary">
        <h1 className="text-3xl font-bold mb-4 text-text-primary">Negotiation</h1>
        <p className="text-text-secondary mb-2">
          Focus on evaluation comments and get vendors to answer questions during negotiations
        </p>
        <p className="text-text-tertiary text-sm italic">Coming soon</p>
      </div>
    </div>
  );
}





