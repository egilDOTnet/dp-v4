"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { api, Project } from "@/lib/api";
import { HeroBanner } from "@/components/ui";

export default function RFPPage() {
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
        <span className="text-text-primary">RFP</span>
      </nav>

      {/* Hero Banner */}
      <HeroBanner
        storageKey="rfp-hero-banner"
        title="Welcome to the RFP Module (Coming Soon)"
        description={
          <>
            A <strong>Request for Proposal (RFP)</strong> is the formal step after your RFI where you request detailed proposals from qualified vendors. This is where vendors provide comprehensive responses to your specific requirements.
          </>
        }
        features={[
          {
            label: "RFP content management",
            description: "Create and organize detailed proposal requests",
          },
          {
            label: "Set deadlines",
            description: "Manage submission timelines and auto-publish dates",
          },
          {
            label: "Q&A functionality",
            description: "Handle vendor questions during the RFP period",
          },
          {
            label: "Document links",
            description: "Attach relevant specifications, requirements, and supporting materials",
          },
        ]}
        tip={
          <>
            <div className="font-bold not-italic mb-1">Tip:</div>
            <div>This feature will help you collect detailed, comparable proposals from qualified vendors.</div>
            <div>Use your RFI insights to create a focused and effective RFP!</div>
          </>
        }
      />

      <div className="bg-background-secondary rounded-lg shadow-md p-12 text-center border border-border-primary">
        <h1 className="text-3xl font-bold mb-4 text-text-primary">Request for Proposal (RFP)</h1>
        <p className="text-text-secondary mb-2">
          Manage RFP contents, dates, Q&A with vendors, and links to necessary content
        </p>
        <p className="text-text-tertiary text-sm italic">Coming soon</p>
      </div>
    </div>
  );
}





