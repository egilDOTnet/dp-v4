"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { api, Project, Phase, DashboardStats } from "@/lib/api";
import PhaseTimeline from "@/components/PhaseTimeline";
import VendorWidget from "@/components/VendorWidget";
import RFIWidget from "@/components/RFIWidget";
import RequirementsWidget from "@/components/RequirementsWidget";

export default function ProjectDashboardPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const projectId = params.id as string;
  const [project, setProject] = useState<Project | null>(null);
  const [phases, setPhases] = useState<Phase[]>([]);
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const isAdmin =
    user?.role === "CompanyAdministrator" || user?.role === "GlobalAdministrator";

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

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Project Dashboard</h1>
        <div className="flex gap-2">
          {isAdmin && (
            <Link
              href={`/projects/${projectId}/manage`}
              className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700"
            >
              Manage Project
            </Link>
          )}
        </div>
      </div>

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
