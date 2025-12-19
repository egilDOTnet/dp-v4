"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api, RequirementHierarchy, Requirement, Project } from "@/lib/api";
import RequirementHierarchyComponent from "@/components/RequirementHierarchy";
import { useSearch } from "@/hooks/useSearch";
import { SearchBar, HeroBanner } from "@/components/ui";
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
  const [expandedHierarchies, setExpandedHierarchies] = useState<Set<string>>(new Set());
  const [selectedRequirementIds, setSelectedRequirementIds] = useState<Set<string>>(new Set());
  const [showMultiEditModal, setShowMultiEditModal] = useState(false);
  const [showMultiDeleteModal, setShowMultiDeleteModal] = useState(false);
  const [filterStatus, setFilterStatus] = useState<"Approved" | "ForReview" | "New" | "Imported" | null>(null);
  const [filterType, setFilterType] = useState<"Information" | "Mandatory" | "Important" | "Wish" | null>(null);

  // Search functionality
  const { searchTerm, setSearchTerm, filteredItems: _filteredItems, clearSearch, isSearching } =
    useSearch(requirements, {
      searchKeys: ["description"],
    });

  // Check if filtering is active
  const isFiltering = filterStatus !== null || filterType !== null;
  const isFilteringOrSearching = isSearching || isFiltering;

  // Apply filters to requirements
  const filteredByStatusAndType = useMemo(() => {
    if (!isFiltering) return requirements;
    
    return requirements.filter((req) => {
      const statusMatch = filterStatus === null || req.status === filterStatus;
      const typeMatch = filterType === null || req.type === filterType;
      return statusMatch && typeMatch;
    });
  }, [requirements, filterStatus, filterType, isFiltering]);

  // Combine search and filter results
  const finalFilteredRequirements = useMemo(() => {
    let result = isFiltering ? filteredByStatusAndType : requirements;
    
    if (isSearching) {
      // Apply search to the already filtered results
      const searchTermLower = searchTerm.toLowerCase();
      result = result.filter((req) => {
        const description = req.description?.toLowerCase() || "";
        return description.includes(searchTermLower);
      });
    }
    
    return result;
  }, [isSearching, isFiltering, searchTerm, filteredByStatusAndType, requirements]);

  // When searching or filtering, auto-expand all hierarchies that contain matching requirements
  const searchExpandedHierarchies = useMemo(() => {
    if (!isFilteringOrSearching) return expandedHierarchies;
    
    const hierarchiesWithMatches = new Set<string>();
    finalFilteredRequirements.forEach((req) => {
      // Add the requirement's direct hierarchy
      hierarchiesWithMatches.add(req.hierarchyId);
      // Also add parent hierarchies
      const hierarchy = hierarchies.find(h => h.id === req.hierarchyId);
      if (hierarchy?.parentId) {
        hierarchiesWithMatches.add(hierarchy.parentId);
      }
    });
    return hierarchiesWithMatches;
  }, [isFilteringOrSearching, finalFilteredRequirements, hierarchies, expandedHierarchies]);

  // Filter hierarchies to only show those with matching requirements when searching or filtering
  const displayHierarchies = useMemo(() => {
    if (!isFilteringOrSearching) return hierarchies;
    
    // Get all hierarchy IDs that have matching requirements
    const hierarchiesWithMatches = new Set<string>();
    finalFilteredRequirements.forEach((req) => {
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
  }, [isFilteringOrSearching, hierarchies, finalFilteredRequirements]);

  // Filter requirements to only show matches when searching or filtering
  const displayRequirements = isFilteringOrSearching ? finalFilteredRequirements : requirements;

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
    if (isFilteringOrSearching) return "Check result";
    return "Check all";
  };

  const handleCheckAllToggle = () => {
    if (selectedRequirementIds.size > 0) {
      // Uncheck all
      setSelectedRequirementIds(new Set());
    } else if (isFilteringOrSearching) {
      // Check all filtered results
      setSelectedRequirementIds(new Set(finalFilteredRequirements.map((r) => r.id)));
      // Expand all hierarchies that contain matching requirements
      const hierarchiesWithMatches = new Set<string>();
      finalFilteredRequirements.forEach((req) => {
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

      {/* Search Bar and Filters */}
      <div className="flex items-center gap-4 mb-6">
        <div className="flex-1 max-w-sm">
          <SearchBar
            value={searchTerm}
            onChange={setSearchTerm}
            onClear={clearSearch}
            placeholder="Search requirements..."
          />
        </div>
        {(isSearching || isFiltering) && (
          <span className="text-sm text-text-secondary">
            {finalFilteredRequirements.length} of {requirements.length} requirements
          </span>
        )}
        <div className="flex items-center gap-2 ml-auto">
          {/* Filter Component - hidden when requirements are selected */}
          {selectedRequirementIds.size === 0 && (
            <div className={`flex items-center gap-2 px-3 py-1 rounded-md border border-border-primary transition-colors ${
              isFiltering ? 'bg-accent-600' : 'bg-background-secondary'
            }`}>
              <svg
                className={`h-4 w-4 ${isFiltering ? 'text-white' : 'text-text-primary'}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
                />
              </svg>
              <span className={`text-sm ${isFiltering ? 'text-white' : 'text-text-primary'}`}>
                Filter by
              </span>
              <select
                value={filterType || ""}
                onChange={(e) => setFilterType(e.target.value as typeof filterType || null)}
                className={`text-sm rounded px-1.5 py-0.5 border border-border-primary h-7 ${
                  isFiltering ? 'bg-white text-text-primary' : 'bg-background-tertiary text-text-primary'
                }`}
              >
                <option value="">Type:</option>
                <option value="Information">Information</option>
                <option value="Mandatory">Mandatory</option>
                <option value="Important">Important</option>
                <option value="Wish">Wish</option>
              </select>
              <select
                value={filterStatus || ""}
                onChange={(e) => setFilterStatus(e.target.value as typeof filterStatus || null)}
                className={`text-sm rounded px-1.5 py-0.5 border border-border-primary h-7 ${
                  isFiltering ? 'bg-white text-text-primary' : 'bg-background-tertiary text-text-primary'
                }`}
              >
                <option value="">Status:</option>
                <option value="Approved">Approved</option>
                <option value="ForReview">For Review</option>
                <option value="New">New</option>
                <option value="Imported">Imported</option>
              </select>
            </div>
          )}
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
      <HeroBanner
        storageKey="requirements-hero-banner"
        title="Welcome to Requirements"
        description={
          <>
            <strong>Requirements</strong> are the foundation of your procurement process. This section helps you organize your needs in structured hierarchies, making it easier to evaluate vendor capabilities and ensure nothing is overlooked.
          </>
        }
        features={[
          {
            label: "Create hierarchies",
            description: "Organize requirements into logical categories and subcategories",
          },
          {
            label: "Add requirements",
            description: "Define specific needs with descriptions and details",
          },
          {
            label: "Set priorities",
            description: "Mark requirements as Must Have, Should Have, or Nice to Have",
          },
          {
            label: "Track status",
            description: "Monitor requirement statuses throughout the procurement process",
          },
        ]}
        tip={
          <>
            <div className="font-bold not-italic mb-1">Tip:</div>
            <div>Well-defined requirements lead to better vendor responses!</div>
            <div>Take time to organize and prioritize your needs clearly.</div>
          </>
        }
      />

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
            expandedHierarchies={isFilteringOrSearching ? searchExpandedHierarchies : expandedHierarchies}
            onExpandedHierarchiesChange={setExpandedHierarchies}
            disableDragAndDrop={isFilteringOrSearching}
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
