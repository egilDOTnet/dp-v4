"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api, RequirementHierarchy, Requirement, Project } from "@/lib/api";
import RequirementHierarchyComponent from "@/components/RequirementHierarchy";

export default function RequirementsPage() {
  const params = useParams();
  const projectId = params.id as string;
  const [project, setProject] = useState<Project | null>(null);
  const [hierarchies, setHierarchies] = useState<RequirementHierarchy[]>([]);
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedHierarchyId, setSelectedHierarchyId] = useState<string | null>(null);
  const [createForHierarchyId, setCreateForHierarchyId] = useState<string | null>(null);
  const [showHeroBanner, setShowHeroBanner] = useState(true);
  const [expandedHierarchies, setExpandedHierarchies] = useState<Set<string>>(new Set());


  const loadData = async () => {
    try {
      setLoading(true);
      const [projectData, hierarchiesData, requirementsData] = await Promise.all([
        api.projects.get(projectId),
        api.requirements.hierarchies.list(projectId),
        api.requirements.list(projectId),
      ]);
      setProject(projectData);
      setHierarchies(hierarchiesData);
      setRequirements(requirementsData);
      setError("");
    } catch (err: any) {
      setError(err.message || "Failed to load requirements");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (projectId) {
      loadData();
    }
  }, [projectId]);

  useEffect(() => {
    // Check if user has dismissed the hero banner before
    const dismissed = localStorage.getItem("requirements-hero-banner-dismissed");
    if (dismissed === "true") {
      setShowHeroBanner(false);
    }
  }, []);

  const handleDismissHeroBanner = () => {
    localStorage.setItem("requirements-hero-banner-dismissed", "true");
    setShowHeroBanner(false);
  };

  const handleHierarchyUpdate = () => {
    loadData();
  };

  const handleRequirementUpdate = () => {
    loadData();
  };

  const handleHierarchySelect = (id: string | null) => {
    setSelectedHierarchyId(id);
    // Clear the create form when collapsing or switching hierarchies
    if (id !== createForHierarchyId) {
      setCreateForHierarchyId(null);
    }
  };

  if (loading) {
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
          <span className="text-gray-900">Requirements</span>
        </nav>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading requirements...</p>
        </div>
      </div>
    );
  }

  if (error) {
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
          <span className="text-gray-900">Requirements</span>
        </nav>
        <div className="text-center">
          <p className="text-red-600">{error}</p>
        </div>
      </div>
    );
  }


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
        <span className="text-gray-900">Requirements</span>
      </nav>

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Requirements</h1>
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
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Welcome to Requirements</h3>
              <p className="text-gray-700 mb-3">
                <strong>Requirements</strong> are the foundation of your procurement process. This section helps you organize your needs in structured hierarchies, making it easier to evaluate vendor capabilities and ensure nothing is overlooked.
              </p>
              <p className="text-gray-700 mb-3">
                <strong>Here's what you can do:</strong>
              </p>
              <ul className="list-disc list-inside text-gray-700 space-y-1 mb-4 ml-2">
                <li><strong>Create hierarchies:</strong> Organize requirements into logical categories and subcategories</li>
                <li><strong>Add requirements:</strong> Define specific needs with descriptions and details</li>
                <li><strong>Set priorities:</strong> Mark requirements as Must Have, Should Have, or Nice to Have</li>
                <li><strong>Track status:</strong> Monitor requirement statuses throughout the procurement process</li>
              </ul>
              <div className="bg-white/60 border border-primary-300 rounded-md p-3 shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="text-3xl flex-shrink-0">💡</div>
                  <div className="flex-1 text-sm text-gray-700 italic">
                    <div className="font-bold not-italic mb-1">Tip:</div>
                    <div>Well-defined requirements lead to better vendor responses!</div>
                    <div>Take time to organize and prioritize your needs clearly.</div>
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

      <div className="space-y-6">
        {/* Hierarchy Structure */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <RequirementHierarchyComponent
            projectId={projectId}
            hierarchies={hierarchies}
            requirements={requirements}
            selectedHierarchyId={selectedHierarchyId}
            onHierarchySelect={handleHierarchySelect}
            onHierarchyUpdate={handleHierarchyUpdate}
            onRequirementUpdate={handleRequirementUpdate}
            onAddRequirement={(hierarchyId) => {
              setSelectedHierarchyId(hierarchyId);
              setCreateForHierarchyId(hierarchyId);
            }}
            createForHierarchyId={createForHierarchyId}
            onCreateFormClose={() => setCreateForHierarchyId(null)}
            expandedHierarchies={expandedHierarchies}
            onExpandedHierarchiesChange={setExpandedHierarchies}
          />
        </div>
      </div>
    </div>
  );
}
