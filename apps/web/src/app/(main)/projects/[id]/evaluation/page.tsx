"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { api, Project } from "@/lib/api";

export default function EvaluationPage() {
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
    const dismissed = localStorage.getItem("evaluation-hero-banner-dismissed");
    if (dismissed === "true") {
      setShowHeroBanner(false);
    }
  }, []);

  const handleDismissHeroBanner = () => {
    localStorage.setItem("evaluation-hero-banner-dismissed", "true");
    setShowHeroBanner(false);
  };

  return (
    <div>
      <nav className="mb-4 text-sm text-gray-600">
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
        <span className="text-gray-900">Evaluation</span>
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
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Welcome to Evaluation (Coming Soon)</h3>
              <p className="text-gray-700 mb-3">
                The <strong>Evaluation</strong> module will help you systematically review and validate vendor responses against your requirements and RFP criteria. This is where data-driven vendor selection decisions are made.
              </p>
              <p className="text-gray-700 mb-3">
                <strong>Future features will include:</strong>
              </p>
              <ul className="list-disc list-inside text-gray-700 space-y-1 mb-4 ml-2">
                <li><strong>Compare responses:</strong> Side-by-side comparison of vendor proposals</li>
                <li><strong>Score against requirements:</strong> Evaluate how well each vendor meets your needs</li>
                <li><strong>Add evaluation comments:</strong> Capture team feedback and assessment notes</li>
                <li><strong>Track evaluation progress:</strong> Monitor which vendors have been reviewed</li>
              </ul>
              <div className="bg-white/60 border border-primary-300 rounded-md p-3 shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="text-3xl flex-shrink-0">💡</div>
                  <div className="flex-1 text-sm text-gray-700 italic">
                    <div className="font-bold not-italic mb-1">Tip:</div>
                    <div>This feature will help you make objective, data-driven vendor selection decisions.</div>
                    <div>Stay tuned for powerful evaluation and comparison tools!</div>
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

      <div className="bg-white rounded-lg shadow-md p-12 text-center">
        <h1 className="text-3xl font-bold mb-4">Evaluation</h1>
        <p className="text-gray-600 mb-2">
          Review and validate vendor responses according to requirements and RFP
        </p>
        <p className="text-gray-400 text-sm italic">Coming soon</p>
      </div>
    </div>
  );
}





