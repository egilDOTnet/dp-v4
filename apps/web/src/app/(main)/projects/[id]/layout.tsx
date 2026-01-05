"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, usePathname } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { useMobileMenu } from "@/contexts/MobileMenuContext";
import { api, Project } from "@/lib/api";

const navigationItems = [
  { name: "Tasks", href: "tasks", description: "Manage project tasks and phases" },
  { name: "Vendors", href: "vendors", description: "Manage vendor information and correspondence" },
  { name: "RFI", href: "rfi", description: "Request for Information questionnaire and responses" },
  { name: "Requirements", href: "requirements", description: "Create and maintain project requirements" },
  { name: "RFP", href: "rfp", description: "Request for Proposal contents and Q&A" },
  { name: "Evaluation", href: "evaluation", description: "Review and validate vendor responses" },
  { name: "Negotiation", href: "negotiation", description: "Focus on evaluation comments and vendor negotiations" },
];

export default function ProjectLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const params = useParams();
  const pathname = usePathname();
  const { user } = useAuth();
  const { isMobileMenuOpen, closeMobileMenu } = useMobileMenu();
  const projectId = params.id as string;
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const prevPathnameRef = useRef<string | null>(null);

  useEffect(() => {
    if (!user || !projectId) return;

    api.projects
      .get(projectId)
      .then((data) => {
        setProject(data);
      })
      .catch((err) => {
        setError(err.message || "Failed to load project");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [user, projectId]);

  // Close mobile menu when navigating to a new section
  // Must be before early returns to follow Rules of Hooks
  useEffect(() => {
    // Only close menu if pathname actually changed (not on initial render)
    if (prevPathnameRef.current !== null && prevPathnameRef.current !== pathname) {
      closeMobileMenu();
    }
    prevPathnameRef.current = pathname || null;
  }, [pathname, closeMobileMenu]);

  // Check if user is a project admin for THIS specific project
  // Global Admins are always project admins
  // Company Admins are only project admins if their tenant matches the project's tenant
  const isProjectAdmin =
    user?.role === "GlobalAdministrator" ||
    (user?.role === "CompanyAdministrator" && user?.tenantId === project?.tenantId);

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

  // Determine current section from pathname
  const currentSection = pathname?.split("/").pop() || "tasks";
  const isManagePage = pathname?.endsWith("/manage");

  return (
    <div className="flex gap-6">
      {/* Mobile backdrop */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 xl:hidden"
          onClick={closeMobileMenu}
          aria-hidden="true"
        />
      )}

      {/* Sidebar Navigation */}
      <aside
        className={`fixed left-0 top-0 h-full w-64 z-50 transform transition-transform duration-300 ease-in-out xl:relative xl:transform-none xl:h-auto xl:w-64 flex-shrink-0 ${
          isMobileMenuOpen ? "translate-x-0" : "-translate-x-full xl:translate-x-0"
        }`}
      >
        <div className="bg-background-tertiary xl:rounded-lg shadow-md xl:sticky xl:top-4 overflow-hidden border-r xl:border border-border-primary h-full xl:h-auto overflow-y-auto xl:overflow-y-visible">
          {/* Mobile close button */}
          <div className="xl:hidden flex justify-end p-2 border-b border-border-primary">
            <button
              onClick={closeMobileMenu}
              className="p-2 rounded-md hover:bg-background-primary transition-colors cursor-pointer"
              aria-label="Close menu"
            >
              <svg
                className="w-5 h-5 text-text-primary"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Project Header - Primary color background */}
          <Link
            href={`/projects/${projectId}`}
            className="block px-4 py-4 bg-primary-600 hover:bg-primary-700 transition-colors cursor-pointer"
            onClick={closeMobileMenu}
          >
            <h2 className="text-lg font-semibold text-white mb-1">{project.name}</h2>
            {project.type && (
              <p className="text-sm text-primary-100">{project.type}</p>
            )}
          </Link>

          {/* Navigation Links */}
          <nav className="space-y-1 p-4">
            {navigationItems.map((item) => {
              const isActive = currentSection === item.href;
              return (
                <Link
                  key={item.href}
                  href={`/projects/${projectId}/${item.href}`}
                  className={`block px-3 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer ${
                    isActive
                      ? "bg-primary-50 text-primary-700 border-l-4 border-primary-600"
                      : "text-text-primary hover:bg-background-primary"
                  }`}
                  title={item.description}
                  onClick={closeMobileMenu}
                >
                  {item.name}
                </Link>
              );
            })}
          </nav>

          {/* Project Actions */}
          {isProjectAdmin && (
            <>
              {/* Full-width divider before Manage Project */}
              <div className="border-t border-border-primary"></div>
              <div className="p-4">
                <Link
                  href={`/projects/${projectId}/manage`}
                  className={`block px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isManagePage
                      ? "bg-primary-50 text-primary-700 border-l-4 border-primary-600"
                      : "text-text-primary hover:bg-background-primary"
                  }`}
                  onClick={closeMobileMenu}
                >
                  Manage Project
                </Link>
              </div>
            </>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 min-w-0">
        {children}
      </main>
    </div>
  );
}






