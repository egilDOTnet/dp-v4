"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { useParams } from "next/navigation";
import { api, RequirementHierarchy, Requirement } from "@/lib/api";
import RequirementHierarchyComponent from "@/components/RequirementHierarchy";
import { useSearch } from "@/hooks/useSearch";
import { SearchBar, Breadcrumbs, LoadingSpinner } from "@/components/ui";

interface RequirementTemplate {
  id: string;
  shortName: string;
  description?: string | null;
  languageCode: string;
  createdAt: string;
  updatedAt: string;
  createdBy: {
    id: string;
    email: string;
    name?: string | null;
  };
}

export default function RequirementTemplateDetailPage() {
  const params = useParams();
  const templateId = params.id as string;
  const [template, setTemplate] = useState<RequirementTemplate | null>(null);
  const [hierarchies, setHierarchies] = useState<RequirementHierarchy[]>([]);
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedHierarchyId, setSelectedHierarchyId] = useState<string | null>(null);
  const [createForHierarchyId, setCreateForHierarchyId] = useState<string | null>(null);
  const [expandedHierarchies, setExpandedHierarchies] = useState<Set<string>>(new Set());
  const [filterType, setFilterType] = useState<"Information" | "Mandatory" | "Important" | "Wish" | null>(null);
  const loadingTemplateIdRef = useRef<string | null>(null);

  // Search functionality
  const { searchTerm, setSearchTerm, filteredItems: _filteredItems, clearSearch, isSearching } =
    useSearch(requirements, {
      searchKeys: ["description"],
    });

  // Check if filtering is active
  const isFiltering = filterType !== null;
  const isFilteringOrSearching = isSearching || isFiltering;

  // Apply filters to requirements
  const filteredByType = useMemo(() => {
    if (!isFiltering) return requirements;
    
    return requirements.filter((req) => {
      const typeMatch = filterType === null || req.type === filterType;
      return typeMatch;
    });
  }, [requirements, filterType, isFiltering]);

  // Combine search and filter results
  const finalFilteredRequirements = useMemo(() => {
    let result = isFiltering ? filteredByType : requirements;
    
    if (isSearching) {
      // Apply search to the already filtered results
      const searchTermLower = searchTerm.toLowerCase();
      result = result.filter((req) => {
        const description = req.description?.toLowerCase() || "";
        return description.includes(searchTermLower);
      });
    }
    
    return result;
  }, [isSearching, isFiltering, searchTerm, filteredByType, requirements]);

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
      const [templateData, hierarchiesData, requirementsData] = await Promise.all([
        api.admin.requirementTemplates.get(templateId),
        api.admin.requirementTemplates.hierarchies.list(templateId),
        api.admin.requirementTemplates.requirements.list(templateId),
      ]);
      setTemplate(templateData);
      setHierarchies(hierarchiesData);
      setRequirements(requirementsData);
      setError("");
    } catch (err: any) {
      setError(err.message || "Failed to load template requirements");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (templateId) {
      // Prevent duplicate calls (React Strict Mode protection)
      if (loadingTemplateIdRef.current === templateId) {
        return;
      }
      
      loadingTemplateIdRef.current = templateId;
      loadData().finally(() => {
        if (loadingTemplateIdRef.current === templateId) {
          loadingTemplateIdRef.current = null;
        }
      });
    }
  }, [templateId]);

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

  const breadcrumbItems = [
    { label: "Admin Home", href: "/admin" },
    { label: "Requirement Templates", href: "/admin/requirement-templates" },
    { label: template ? `${template.shortName} (${template.languageCode.toUpperCase()})` : "Template" },
  ];

  if (loading) {
    return (
      <div>
        <Breadcrumbs items={breadcrumbItems} />
        <div className="flex flex-col items-center justify-center min-h-[400px]">
          <LoadingSpinner size="lg" />
          <p className="mt-4 text-text-secondary">Loading template requirements...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <Breadcrumbs items={breadcrumbItems} />
        <div className="text-center">
          <p className="text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Breadcrumbs items={breadcrumbItems} />

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">{template?.shortName}</h1>
          {template?.description && (
            <p className="text-text-secondary mt-1">{template.description}</p>
          )}
        </div>
      </div>

      {/* Search Bar and Filters */}
      <div className="flex items-center gap-4 mb-6">
        <div className="w-1/2">
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
          {/* Filter Component */}
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
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {/* Hierarchy Structure */}
        <div className="bg-background-secondary rounded-lg shadow-md p-6">
          <RequirementHierarchyComponent
            templateId={templateId}
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
          />
        </div>
      </div>
    </div>
  );
}

