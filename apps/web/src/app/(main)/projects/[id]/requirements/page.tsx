"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api, RequirementHierarchy, Requirement, Project } from "@/lib/api";
import RequirementHierarchyComponent from "@/components/RequirementHierarchy";
import { useSearch } from "@/hooks/useSearch";
import { SearchBar } from "@/components/ui";
import MultiEditRequirementModal from "@/components/MultiEditRequirementModal";
import MultiDeleteRequirementModal from "@/components/MultiDeleteRequirementModal";

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
  const [selectedRequirementIds, setSelectedRequirementIds] = useState<Set<string>>(new Set());
  const [showMultiEditModal, setShowMultiEditModal] = useState(false);
  const [showMultiDeleteModal, setShowMultiDeleteModal] = useState(false);

  // Search functionality
  const { searchTerm, setSearchTerm, filteredItems: filteredRequirements, clearSearch, isSearching } =
    useSearch(requirements, {
      searchKeys: ["description"],
    });

  // When searching, auto-expand all hierarchies that contain matching requirements
  const searchExpandedHierarchies = useMemo(() => {
    if (!isSearching) return expandedHierarchies;
    
    const hierarchiesWithMatches = new Set<string>();
    filteredRequirements.forEach((req) => {
      // Add the requirement's direct hierarchy
      hierarchiesWithMatches.add(req.hierarchyId);
      // Also add parent hierarchies
      const hierarchy = hierarchies.find(h => h.id === req.hierarchyId);
      if (hierarchy?.parentId) {
        hierarchiesWithMatches.add(hierarchy.parentId);
      }
    });
    return hierarchiesWithMatches;
  }, [isSearching, filteredRequirements, hierarchies, expandedHierarchies]);

  // Filter hierarchies to only show those with matching requirements when searching
  const displayHierarchies = useMemo(() => {
    if (!isSearching) return hierarchies;
    
    // Get all hierarchy IDs that have matching requirements
    const hierarchiesWithMatches = new Set<string>();
    filteredRequirements.forEach((req) => {
      hierarchiesWithMatches.add(req.hierarchyId);
    });
    
    // Filter hierarchies: include if they have matching requirements or if any of their children do
    return hierarchies.filter((hierarchy) => {
      // Level 1 hierarchy: include if it has matching requirements directly OR if any child has matches
      if (hierarchy.parentId === null) {
        // Check if this hierarchy has direct matching requirements
        if (hierarchiesWithMatches.has(hierarchy.id)) {
          return true;
        }
        // Check if any child hierarchy has matching requirements
        const childHierarchies = hierarchies.filter(h => h.parentId === hierarchy.id);
        return childHierarchies.some(child => hierarchiesWithMatches.has(child.id));
      }
      // Level 2 hierarchy: include only if it has matching requirements
      return hierarchiesWithMatches.has(hierarchy.id);
    });
  }, [isSearching, hierarchies, filteredRequirements]);

  // Filter requirements to only show matches when searching
  const displayRequirements = isSearching ? filteredRequirements : requirements;

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

  const handleRequirementToggle = (requirementId: string) => {
    setSelectedRequirementIds((prev) => {
      const next = new Set(prev);
      if (next.has(requirementId)) {
        next.delete(requirementId);
      } else {
        next.add(requirementId);
      }
      return next;
    });
  };

  const handleHierarchyToggle = (hierarchyId: string) => {
    // Get all requirements under this hierarchy (including nested)
    const getAllRequirementsUnderHierarchy = (hId: string): string[] => {
      const directRequirements = requirements
        .filter((r) => r.hierarchyId === hId)
        .map((r) => r.id);
      
      const childHierarchies = hierarchies.filter((h) => h.parentId === hId);
      const childRequirements = childHierarchies.flatMap((h) =>
        getAllRequirementsUnderHierarchy(h.id)
      );
      
      return [...directRequirements, ...childRequirements];
    };

    const requirementIds = getAllRequirementsUnderHierarchy(hierarchyId);
    const allSelected = requirementIds.every((id) => selectedRequirementIds.has(id));

    setSelectedRequirementIds((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        // Uncheck all
        requirementIds.forEach((id) => next.delete(id));
      } else {
        // Check all
        requirementIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const getCheckButtonLabel = () => {
    if (selectedRequirementIds.size > 0) return "Uncheck all";
    if (isSearching) return "Check result";
    return "Check all";
  };

  const handleCheckAllToggle = () => {
    if (selectedRequirementIds.size > 0) {
      // Uncheck all
      setSelectedRequirementIds(new Set());
    } else if (isSearching) {
      // Check all filtered results
      setSelectedRequirementIds(new Set(filteredRequirements.map((r) => r.id)));
      // Expand all hierarchies that contain matching requirements
      const hierarchiesWithMatches = new Set<string>();
      filteredRequirements.forEach((req) => {
        hierarchiesWithMatches.add(req.hierarchyId);
        const hierarchy = hierarchies.find(h => h.id === req.hierarchyId);
        if (hierarchy?.parentId) {
          hierarchiesWithMatches.add(hierarchy.parentId);
        }
      });
      setExpandedHierarchies(hierarchiesWithMatches);
    } else {
      // Check all requirements
      setSelectedRequirementIds(new Set(requirements.map((r) => r.id)));
      // Expand all hierarchies so users can see what's selected
      const allHierarchyIds = new Set(hierarchies.map(h => h.id));
      setExpandedHierarchies(allHierarchyIds);
    }
  };

  const handleMultiEdit = () => {
    setShowMultiEditModal(true);
  };

  const handleMultiDelete = () => {
    setShowMultiDeleteModal(true);
  };

  const handleMultiEditClose = () => {
    setShowMultiEditModal(false);
  };

  const handleMultiDeleteClose = () => {
    setShowMultiDeleteModal(false);
  };

  const handleMultiEditSave = async (data: {
    type?: "Information" | "Mandatory" | "Important" | "Wish";
    status?: "Approved" | "ForReview" | "New" | null;
    hierarchyId?: string;
  }) => {
    try {
      await api.requirements.bulkUpdate(projectId, {
        requirementIds: Array.from(selectedRequirementIds),
        ...data,
      });
      setSelectedRequirementIds(new Set());
      setShowMultiEditModal(false);
      // Reload all data to ensure requirements are properly refreshed
      // This will update the requirements state, which will trigger useSearch to recalculate
      await loadData();
    } catch (err: any) {
      setError(err.message || "Failed to update requirements");
    }
  };

  const handleMultiDeleteConfirm = async () => {
    try {
      await api.requirements.bulkDelete(projectId, {
        requirementIds: Array.from(selectedRequirementIds),
      });
      setSelectedRequirementIds(new Set());
      setShowMultiDeleteModal(false);
      loadData();
    } catch (err: any) {
      setError(err.message || "Failed to delete requirements");
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

      {/* Search Bar */}
      <div className="flex items-center gap-4 mb-6">
        <div className="flex-1 max-w-md">
          <SearchBar
            value={searchTerm}
            onChange={setSearchTerm}
            onClear={clearSearch}
            placeholder="Search requirements..."
          />
        </div>
        {isSearching && (
          <span className="text-sm text-gray-500">
            {filteredRequirements.length} of {requirements.length} requirements
          </span>
        )}
        <div className="flex items-center gap-2 ml-auto">
          {/* Multi edit and delete - only when selected */}
          {selectedRequirementIds.size > 0 && (
            <>
              <button
                onClick={handleMultiEdit}
                className="px-4 py-2 bg-accent-600 text-white rounded-md hover:bg-accent-700 transition-colors text-sm"
              >
                Multi edit
              </button>
              <button
                onClick={handleMultiDelete}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-sm"
              >
                Multi delete
              </button>
            </>
          )}
          {/* Check all/result/uncheck button - always visible, always right-aligned */}
          <button
            onClick={handleCheckAllToggle}
            className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors text-sm"
          >
            {getCheckButtonLabel()}
          </button>
        </div>
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
        <div className="bg-background-secondary rounded-lg shadow-md p-6">
          <RequirementHierarchyComponent
            projectId={projectId}
            hierarchies={displayHierarchies}
            requirements={displayRequirements}
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
            expandedHierarchies={isSearching ? searchExpandedHierarchies : expandedHierarchies}
            onExpandedHierarchiesChange={setExpandedHierarchies}
            disableDragAndDrop={isSearching}
            selectedRequirementIds={selectedRequirementIds}
            onRequirementToggle={handleRequirementToggle}
            onHierarchyToggle={handleHierarchyToggle}
          />
        </div>
      </div>

      {/* Multi-Edit Modal */}
      {showMultiEditModal && (
        <MultiEditRequirementModal
          projectId={projectId}
          hierarchies={hierarchies}
          selectedCount={selectedRequirementIds.size}
          onSave={handleMultiEditSave}
          onClose={handleMultiEditClose}
        />
      )}

      {/* Multi-Delete Modal */}
      {showMultiDeleteModal && (
        <MultiDeleteRequirementModal
          selectedCount={selectedRequirementIds.size}
          onConfirm={handleMultiDeleteConfirm}
          onClose={handleMultiDeleteClose}
        />
      )}
    </div>
  );
}
