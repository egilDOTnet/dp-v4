"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { api, Project, Phase, DashboardStats } from "@/lib/api";
import PhaseTimeline from "@/components/PhaseTimeline";
import VendorWidget from "@/components/VendorWidget";
import RFIWidget from "@/components/RFIWidget";
import RequirementsWidget from "@/components/RequirementsWidget";
import { HeroBanner, Breadcrumbs } from "@/components/ui";

export default function ProjectDashboardPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;
  const [project, setProject] = useState<Project | null>(null);
  const [phases, setPhases] = useState<Phase[]>([]);
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const loadingProjectIdRef = useRef<string | null>(null);

  useEffect(() => {
    // Prevent duplicate calls (React Strict Mode protection)
    if (loadingProjectIdRef.current === projectId) {
      return;
    }
    
    loadingProjectIdRef.current = projectId;
    setLoading(true);
    Promise.all([
      api.projects.get(projectId),
      api.projects.phases.list(projectId),
      api.projects.dashboard.getStats(projectId)
    ])
      .then(([projectData, phasesData, statsData]) => {
        // Only update state if we're still loading the same projectId
        if (loadingProjectIdRef.current === projectId) {
          setProject(projectData);
          setPhases(phasesData);
          setDashboardStats(statsData);
        }
      })
      .catch((err) => {
        // Only set error if we're still loading the same projectId
        if (loadingProjectIdRef.current === projectId) {
          setError(err.message || "Failed to load project");
        }
      })
      .finally(() => {
        // Only update loading state if we're still loading the same projectId
        if (loadingProjectIdRef.current === projectId) {
          setLoading(false);
          loadingProjectIdRef.current = null;
        }
      });
    // No cleanup needed - the ref check at the start handles projectId changes
    // and the finally block clears it when load completes
  }, [projectId]);

  const handlePhaseClick = (phaseId: string) => {
    // Navigate to Tasks page with the selected phase
    router.push(`/projects/${projectId}/tasks?phase=${phaseId}`);
  };

  if (loading) {
    return (
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
        <p className="mt-4 text-text-secondary">Loading project...</p>
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

  const breadcrumbItems = [
    { label: "Home", href: "/dashboard?noAutoRedirect=true" },
    { label: "Projects", href: "/projects" },
    { label: project.name },
  ];

  return (
    <div>
      <Breadcrumbs items={breadcrumbItems} />

      <div className="mb-6">
        <h1 className="text-3xl font-bold">Project Dashboard</h1>
      </div>

      {/* Hero Banner */}
      <HeroBanner
        storageKey="dashboard-hero-banner"
        title="Welcome to Your Project Dashboard"
        description={
          <>
            This is your <strong>central hub</strong> for monitoring project progress and accessing all procurement activities. From here, you can quickly navigate to any section of your project and track key metrics.
          </>
        }
        features={[
          {
            label: "Phase Timeline",
            description: "Track progress through procurement phases with task completion metrics",
          },
          {
            label: "Vendor Overview",
            description: "Quick access to vendor management and status tracking",
          },
          {
            label: "RFI Status",
            description: "Monitor your Request for Information progress and responses",
          },
          {
            label: "Requirements Tracking",
            description: "Keep tabs on requirement priorities and statuses",
          },
        ]}
        tip={
          <>
            <div className="font-bold not-italic mb-1">Tip:</div>
            <div>Use the dashboard widgets to quickly identify areas that need your attention.</div>
            <div>Click on any phase in the timeline to jump directly to its tasks!</div>
          </>
        }
      />

      {/* Banner Image combined with Project Information */}
      <div className="mb-6 rounded-lg overflow-hidden shadow-md border border-border-primary">
        {project.bannerData ? (
          <div className="rounded-t-lg overflow-hidden">
            <img
              src={`data:${project.bannerFileType || "image/png"};base64,${project.bannerData}`}
              alt="Project banner"
              className="w-full h-auto max-h-64 object-contain"
            />
          </div>
        ) : null}
        
        {/* Project Information */}
        <div className={`bg-background-secondary p-6 ${project.bannerData ? 'rounded-b-lg' : 'rounded-lg'}`}>
        <div className="grid grid-cols-3 gap-6">
          {/* Column 1: Type and Description */}
          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">
              Type & Description
            </label>
            {project.type ? (
              <p className="text-text-primary">{project.type}</p>
            ) : (
              <p className="text-text-tertiary italic">No type specified</p>
            )}
          </div>

          {/* Column 2: Dates */}
          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">
              Dates
            </label>
            <div className="space-y-2">
              {project.startDate && (
                <div>
                  <span className="text-xs text-text-secondary">Start: </span>
                  <span className="text-text-primary">
                    {new Date(project.startDate).toLocaleDateString()}
                  </span>
                </div>
              )}
              {project.endDate && (
                <div>
                  <span className="text-xs text-text-secondary">Planned End: </span>
                  <span className="text-text-primary">
                    {new Date(project.endDate).toLocaleDateString()}
                  </span>
                </div>
              )}
              {!project.startDate && !project.endDate && (
                <p className="text-text-tertiary italic text-sm">No dates set</p>
              )}
            </div>
          </div>

          {/* Column 3: Members */}
          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">
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
                    <li key={member.id} className="text-text-primary text-sm">
                      {displayName}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-text-tertiary italic text-sm">No members</p>
            )}
          </div>
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
