"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { api, Project, Phase, DashboardStats } from "@/lib/api";
import PhaseTimeline from "@/components/PhaseTimeline";
import VendorWidget from "@/components/VendorWidget";
import RFIWidget from "@/components/RFIWidget";
import RequirementsWidget from "@/components/RequirementsWidget";

export default function ProjectDashboardPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;
  const [project, setProject] = useState<Project | null>(null);
  const [phases, setPhases] = useState<Phase[]>([]);
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showHeroBanner, setShowHeroBanner] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.projects.get(projectId),
      api.projects.phases.list(projectId),
      api.projects.dashboard.getStats(projectId)
    ])
      .then(([projectData, phasesData, statsData]) => {
        setProject(projectData);
        setPhases(phasesData);
        setDashboardStats(statsData);
      })
      .catch((err) => {
        setError(err.message || "Failed to load project");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [projectId]);

  useEffect(() => {
    // Check if user has dismissed the hero banner before
    const dismissed = localStorage.getItem("dashboard-hero-banner-dismissed");
    if (dismissed === "true") {
      setShowHeroBanner(false);
    }
  }, []);

  const handleDismissHeroBanner = () => {
    localStorage.setItem("dashboard-hero-banner-dismissed", "true");
    setShowHeroBanner(false);
  };

  const handlePhaseClick = (phaseId: string) => {
    // Navigate to Tasks page with the selected phase
    router.push(`/projects/${projectId}/tasks?phase=${phaseId}`);
  };

  if (loading) {
    return (
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">Loading project...</p>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="text-center">
        <p className="text-red-600">{error || "Project not found"}</p>
      </div>
    );
  }

  return (
    <div>
      {/* Breadcrumb Navigation */}
      <nav className="mb-4 text-sm text-gray-600">
        <Link href="/dashboard" className="hover:text-primary-600">
          Dashboard
        </Link>
        <span className="mx-2">/</span>
        <Link href="/projects" className="hover:text-primary-600">
          Projects
        </Link>
        <span className="mx-2">/</span>
        <span className="text-gray-900">{project.name}</span>
      </nav>

      <div className="mb-6">
        <h1 className="text-3xl font-bold">Project Dashboard</h1>
      </div>

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
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Welcome to Your Project Dashboard</h3>
              <p className="text-gray-700 mb-3">
                This is your <strong>central hub</strong> for monitoring project progress and accessing all procurement activities. From here, you can quickly navigate to any section of your project and track key metrics.
              </p>
              <p className="text-gray-700 mb-3">
                <strong>Key features on this dashboard:</strong>
              </p>
              <ul className="list-disc list-inside text-gray-700 space-y-1 mb-4 ml-2">
                <li><strong>Phase Timeline:</strong> Track progress through procurement phases with task completion metrics</li>
                <li><strong>Vendor Overview:</strong> Quick access to vendor management and status tracking</li>
                <li><strong>RFI Status:</strong> Monitor your Request for Information progress and responses</li>
                <li><strong>Requirements Tracking:</strong> Keep tabs on requirement priorities and statuses</li>
              </ul>
              <div className="bg-white/60 border border-primary-300 rounded-md p-3 shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="text-3xl flex-shrink-0">💡</div>
                  <div className="flex-1 text-sm text-gray-700 italic">
                    <div className="font-bold not-italic mb-1">Tip:</div>
                    <div>Use the dashboard widgets to quickly identify areas that need your attention.</div>
                    <div>Click on any phase in the timeline to jump directly to its tasks!</div>
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

      {/* Project Information */}
      <div className="bg-white rounded-lg shadow-md mb-6 p-6">
        <div className="grid grid-cols-3 gap-6">
          {/* Column 1: Type and Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Type & Description
            </label>
            {project.type ? (
              <p className="text-gray-900">{project.type}</p>
            ) : (
              <p className="text-gray-400 italic">No type specified</p>
            )}
          </div>

          {/* Column 2: Dates */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Dates
            </label>
            <div className="space-y-2">
              {project.startDate && (
                <div>
                  <span className="text-xs text-gray-500">Start: </span>
                  <span className="text-gray-900">
                    {new Date(project.startDate).toLocaleDateString()}
                  </span>
                </div>
              )}
              {project.endDate && (
                <div>
                  <span className="text-xs text-gray-500">Planned End: </span>
                  <span className="text-gray-900">
                    {new Date(project.endDate).toLocaleDateString()}
                  </span>
                </div>
              )}
              {!project.startDate && !project.endDate && (
                <p className="text-gray-400 italic text-sm">No dates set</p>
              )}
            </div>
          </div>

          {/* Column 3: Members */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Members
            </label>
            {project.members && project.members.length > 0 ? (
              <ul className="space-y-1">
                {project.members.map((member) => {
                  const displayName =
                    member.firstName && member.lastName
                      ? `${member.firstName} ${member.lastName}`
                      : member.firstName ||
                        member.lastName ||
                        member.name ||
                        member.email;
                  return (
                    <li key={member.id} className="text-gray-900 text-sm">
                      {displayName}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-gray-400 italic text-sm">No members</p>
            )}
          </div>
        </div>
      </div>

      {/* Phase Timeline */}
      <PhaseTimeline
        phases={phases}
        selectedPhaseId={null}
        onPhaseClick={handlePhaseClick}
      />

      {/* Dashboard Widgets */}
      {dashboardStats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
          <VendorWidget stats={dashboardStats.vendors} />
          <RFIWidget stats={dashboardStats.rfi} />
          <RequirementsWidget stats={dashboardStats.requirements} />
        </div>
      )}
    </div>
  );
}
