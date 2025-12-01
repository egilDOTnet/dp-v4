"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { api, RequirementHierarchy, Requirement } from "@/lib/api";
import RequirementHierarchyComponent from "@/components/RequirementHierarchy";
import RequirementList from "@/components/RequirementList";

export default function RequirementsPage() {
  const params = useParams();
  const { user } = useAuth();
  const projectId = params.id as string;
  const [hierarchies, setHierarchies] = useState<RequirementHierarchy[]>([]);
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedHierarchyId, setSelectedHierarchyId] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const [hierarchiesData, requirementsData] = await Promise.all([
        api.requirements.hierarchies.list(projectId),
        api.requirements.list(projectId),
      ]);
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

  const handleHierarchyUpdate = () => {
    loadData();
  };

  const handleRequirementUpdate = () => {
    loadData();
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
            Project
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
            Project
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

  // Organize hierarchies into Level 1 and Level 2
  const level1Hierarchies = hierarchies.filter((h) => h.parentId === null);
  const level2Hierarchies = hierarchies.filter((h) => h.parentId !== null);

  // Get requirements for selected hierarchy
  const selectedHierarchy = hierarchies.find((h) => h.id === selectedHierarchyId);
  const hierarchyRequirements = selectedHierarchyId
    ? requirements.filter((r) => r.hierarchyId === selectedHierarchyId)
    : [];

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
          Project
        </Link>
        <span className="mx-2">/</span>
        <span className="text-gray-900">Requirements</span>
      </nav>

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Requirements</h1>
      </div>

      <div className="space-y-6">
        {/* Hierarchy Structure */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4">Requirement Hierarchy</h2>
          <RequirementHierarchyComponent
            projectId={projectId}
            hierarchies={hierarchies}
            selectedHierarchyId={selectedHierarchyId}
            onHierarchySelect={setSelectedHierarchyId}
            onHierarchyUpdate={handleHierarchyUpdate}
          />
        </div>

        {/* Requirements List */}
        {selectedHierarchy && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">
                {selectedHierarchy.number}. {selectedHierarchy.title}
              </h2>
              <button
                onClick={() => setSelectedHierarchyId(null)}
                className="text-sm text-gray-600 hover:text-gray-800 underline"
              >
                Back to hierarchy
              </button>
            </div>
            <RequirementList
              projectId={projectId}
              hierarchyId={selectedHierarchyId!}
              requirements={hierarchyRequirements}
              onRequirementUpdate={handleRequirementUpdate}
            />
          </div>
        )}

        {!selectedHierarchy && (
          <div className="bg-white rounded-lg shadow-md p-6 text-center text-gray-500">
            <p>Select a hierarchy level to view and manage requirements</p>
          </div>
        )}
      </div>
    </div>
  );
}
