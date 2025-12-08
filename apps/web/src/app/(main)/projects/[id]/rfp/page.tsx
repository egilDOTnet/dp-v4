"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { api, Project } from "@/lib/api";

export default function RFPPage() {
  const params = useParams();
  const projectId = params.id as string;
  const [project, setProject] = useState<Project | null>(null);
  const [showHeroBanner, setShowHeroBanner] = useState(true);

  useEffect(() => {
    if (projectId) {
      api.projects.get(projectId)
        .then(setProject)
        .catch((err) => console.error("Failed to load project:", err));
    }
  }, [projectId]);

  useEffect(() => {
    // Check if user has dismissed the hero banner before
    const dismissed = localStorage.getItem("rfp-hero-banner-dismissed");
    if (dismissed === "true") {
      setShowHeroBanner(false);
    }
  }, []);

  const handleDismissHeroBanner = () => {
    localStorage.setItem("rfp-hero-banner-dismissed", "true");
    setShowHeroBanner(false);
  };

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
      {showHeroBanner && (
        <div className="mb-6 bg-gradient-to-r from-primary-50 to-blue-50 border border-primary-200 rounded-lg p-6 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-12 h-12 bg-primary-600 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-text-primary mb-2">Welcome to the RFP Module (Coming Soon)</h3>
              <p className="text-text-primary mb-3">
                A <strong>Request for Proposal (RFP)</strong> is the formal step after your RFI where you request detailed proposals from qualified vendors. This is where vendors provide comprehensive responses to your specific requirements.
              </p>
              <p className="text-text-primary mb-3">
                <strong>Future features will include:</strong>
              </p>
              <ul className="list-disc list-inside text-text-primary space-y-1 mb-4 ml-2">
                <li><strong>RFP content management:</strong> Create and organize detailed proposal requests</li>
                <li><strong>Set deadlines:</strong> Manage submission timelines and auto-publish dates</li>
                <li><strong>Q&A functionality:</strong> Handle vendor questions during the RFP period</li>
                <li><strong>Document links:</strong> Attach relevant specifications, requirements, and supporting materials</li>
              </ul>
              <div className="bg-background-primary/60 border border-primary-300 rounded-md p-3 shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="text-3xl flex-shrink-0">💡</div>
                  <div className="flex-1 text-sm text-text-primary italic">
                    <div className="font-bold not-italic mb-1">Tip:</div>
                    <div>This feature will help you collect detailed, comparable proposals from qualified vendors.</div>
                    <div>Use your RFI insights to create a focused and effective RFP!</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="flex justify-end mt-4">
            <button
              onClick={handleDismissHeroBanner}
              className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors shadow-sm"
            >
              Understood
            </button>
          </div>
        </div>
      )}

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





