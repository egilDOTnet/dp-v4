"use client";

import React, { useEffect, useState, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { api, Project } from "@/lib/api";
import { useSearch } from "@/hooks/useSearch";
import NewProjectModal from "@/components/NewProjectModal";
import {
  PageHeader,
  SearchBar,
  Card,
  CardBody,
  Button,
  LoadingSpinner,
  EmptyState,
  Badge,
} from "@/components/ui";

export default function DashboardPage() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewProjectModal, setShowNewProjectModal] = useState(false);
  const loadingRef = useRef(false);
  const lastLoadKeyRef = useRef<string>("");

  const { searchTerm, setSearchTerm, filteredItems, clearSearch, isSearching } =
    useSearch(projects, {
      searchKeys: ["name", "type"],
    });
  
  // Projects are already sorted by the API (company projects first, then cross-company, both alphabetically)
  // But we need to re-sort when searching since filteredItems might not be sorted
  const sortedProjects = React.useMemo(() => {
    return [...projects].sort((a, b) => {
      const aIsCompanyProject = a.tenantId === user?.tenantId;
      const bIsCompanyProject = b.tenantId === user?.tenantId;
      
      // Company projects come first
      if (aIsCompanyProject && !bIsCompanyProject) return -1;
      if (!aIsCompanyProject && bIsCompanyProject) return 1;
      
      // Within each group, sort alphabetically by name
      return a.name.localeCompare(b.name);
    });
  }, [projects, user?.tenantId]);

  // Sort filtered items the same way
  const sortedFilteredItems = React.useMemo(() => {
    if (!isSearching) return [];
    return [...filteredItems].sort((a, b) => {
      const aIsCompanyProject = a.tenantId === user?.tenantId;
      const bIsCompanyProject = b.tenantId === user?.tenantId;
      
      if (aIsCompanyProject && !bIsCompanyProject) return -1;
      if (!aIsCompanyProject && bIsCompanyProject) return 1;
      
      return a.name.localeCompare(b.name);
    });
  }, [filteredItems, isSearching, user?.tenantId]);

  // Display items - use sorted projects directly if not searching, otherwise use sorted filtered items
  const displayItems = isSearching ? sortedFilteredItems : sortedProjects;

  useEffect(() => {
    if (!user) return;

    // Create a unique key for this load based on dependencies
    const loadKey = `${user?.id}-${searchParams?.get("noAutoRedirect") || ""}`;

    // Prevent duplicate calls with the same dependencies (React Strict Mode protection)
    if (loadingRef.current && lastLoadKeyRef.current === loadKey) {
      return;
    }

    loadingRef.current = true;
    lastLoadKeyRef.current = loadKey;
    setLoading(true);

    api.projects
      .list()
      .then((data) => {
        // Only update if this is still the current load
        if (lastLoadKeyRef.current === loadKey) {
          // Filter out any invalid projects (empty objects, missing IDs, etc.)
          const validProjects = data.filter((p) => p && p.id);
          setProjects(validProjects);
          // If user has only one project, redirect to it
          // But only if the user didn't explicitly click a Home link (noAutoRedirect param)
          const noAutoRedirect = searchParams?.get("noAutoRedirect") === "true";
          if (validProjects.length === 1 && !noAutoRedirect) {
            router.push(`/projects/${validProjects[0].id}`);
          }
        }
      })
      .catch((err) => {
        // Only log error if this is still the current load
        if (lastLoadKeyRef.current === loadKey) {
          console.error("Failed to load projects:", err);
        }
      })
      .finally(() => {
        // Only update loading state if this is still the current load
        if (lastLoadKeyRef.current === loadKey) {
          setLoading(false);
          loadingRef.current = false;
        }
      });
  }, [user, router, searchParams]);

  const isAdmin =
    user?.role === "CompanyAdministrator" ||
    user?.role === "GlobalAdministrator";

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <LoadingSpinner size="lg" />
        <p className="mt-4 text-text-secondary">
          Loading projects...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Home"
        description={`Welcome back${user?.firstName ? `, ${user.firstName}` : ""}!`}
        actions={
          isAdmin ? (
            <Button variant="primary" onClick={() => setShowNewProjectModal(true)}>
              <svg
                className="w-4 h-4 mr-1"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
              New Project
            </Button>
          ) : undefined
        }
      />

      <NewProjectModal
        open={showNewProjectModal}
        onClose={() => setShowNewProjectModal(false)}
      />

      {/* Company Settings Tile */}
      {isAdmin && (
        <div>
          <Link href="/company/settings">
            <Card variant="interactive" className="border-2 border-dashed">
              <CardBody>
                <div className="flex items-center gap-4">
                  <div className="flex-shrink-0">
                    <svg
                      className="w-8 h-8 text-text-secondary"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-text-primary">
                      Company Settings
                    </h3>
                    <p className="text-sm text-text-secondary mt-1">
                      Manage company information and settings
                    </p>
                  </div>
                  <svg
                    className="w-5 h-5 text-text-secondary"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </div>
              </CardBody>
            </Card>
          </Link>
        </div>
      )}

      {/* Search Bar */}
      {projects.length > 0 && (
        <div className="flex items-center gap-4">
          <div className="w-1/2">
            <SearchBar
              value={searchTerm}
              onChange={setSearchTerm}
              onClear={clearSearch}
              placeholder="Search projects..."
            />
          </div>
          {isSearching && (
            <span className="text-sm text-text-secondary">
              {filteredItems.length} of {projects.length} projects
            </span>
          )}
        </div>
      )}

      {/* Empty State - No Projects */}
      {projects.length === 0 && (
        <EmptyState
          icon={
            <svg
              className="w-16 h-16"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
              />
            </svg>
          }
          title="No projects yet"
          description={
            isAdmin
              ? "Get started by creating your first project."
              : "Projects will appear here once they are created."
          }
          action={
            isAdmin
              ? {
                  label: "Create Your First Project",
                  onClick: () => setShowNewProjectModal(true),
                }
              : undefined
          }
        />
      )}

      {/* Empty State - No Search Results */}
      {isSearching && displayItems.length === 0 && (
        <EmptyState
          icon={
            <svg
              className="w-12 h-12"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          }
          title="No matching projects"
          description={`No projects match "${searchTerm}". Try a different search term.`}
          action={{
            label: "Clear Search",
            onClick: clearSearch,
          }}
        />
      )}

      {/* Project Grid */}
      {displayItems.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {displayItems.map((project) => {
            if (!project || !project.id) return null; // Filter out invalid projects
            
            // Check if this is a cross-company project
            const isCrossCompany = user?.tenantId 
              ? project.tenantId !== user.tenantId 
              : false; // If user has no tenantId, don't show as cross-company
            
            return (
              <Link key={project.id} href={`/projects/${project.id}`}>
                <Card 
                  variant="interactive" 
                  className="h-full flex flex-col overflow-hidden"
                >
                  <CardBody className="flex-1 flex flex-col">
                    {/* Mini Banner - fixed height container */}
                    <div className="mb-4 -mx-6 -mt-6 h-32 overflow-hidden bg-gray-100 rounded-t-lg">
                      {project.bannerData && (
                        <img
                          src={`data:${project.bannerFileType || "image/png"};base64,${project.bannerData}`}
                          alt={`${project.name} banner`}
                          className="w-full h-full object-cover"
                        />
                      )}
                    </div>
                    <div className="flex items-start justify-between mb-2">
                      <h2 className="text-xl font-semibold text-text-primary flex-1">
                        {project.name}
                      </h2>
                    </div>
                    {/* Project type badge */}
                    {project.type && (
                      <div className="mb-3">
                        <Badge variant="info" size="sm">
                          {project.type}
                        </Badge>
                      </div>
                    )}
                    <div className="space-y-1 text-sm text-text-secondary mt-auto">
                      {project.startDate && (
                        <p>
                          Start:{" "}
                          {new Date(project.startDate).toLocaleDateString()}
                        </p>
                      )}
                      {project.endDate && (
                        <p>
                          End: {new Date(project.endDate).toLocaleDateString()}
                        </p>
                      )}
                      {project.members && project.members.length > 0 && (
                        <p className="mt-2">
                          {project.members.length} member
                          {project.members.length !== 1 ? "s" : ""}
                        </p>
                      )}
                    </div>
                  </CardBody>
                  {/* External company indicator bar at bottom */}
                  {isCrossCompany && (
                    <div className="bg-primary-500 text-white px-4 py-2 text-sm font-medium rounded-b-lg flex-shrink-0">
                      {project.tenant?.name || "External Company"}
                    </div>
                  )}
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
