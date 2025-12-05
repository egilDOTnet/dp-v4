"use client";

import { useEffect, useState } from "react";
import { useParams, usePathname } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
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
  const projectId = params.id as string;
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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

  const isAdmin =
    user?.role === "CompanyAdministrator" || user?.role === "GlobalAdministrator";

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

  // Determine current section from pathname
  const currentSection = pathname?.split("/").pop() || "tasks";

  return (
    <div className="flex gap-6">
      {/* Sidebar Navigation */}
      <aside className="w-64 flex-shrink-0">
        <div className="bg-white rounded-lg shadow-md p-4 sticky top-4">
          {/* Project Header */}
          <div className="mb-6 pb-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 mb-1">{project.name}</h2>
            {project.type && (
              <p className="text-sm text-gray-500">{project.type}</p>
            )}
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1">
            {navigationItems.map((item) => {
              const isActive = currentSection === item.href;
              return (
                <Link
                  key={item.href}
                  href={`/projects/${projectId}/${item.href}`}
                  className={`block px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-primary-50 text-primary-700 border-l-4 border-primary-600"
                      : "text-gray-700 hover:bg-gray-50 hover:text-gray-900"
                  }`}
                  title={item.description}
                >
                  {item.name}
                </Link>
              );
            })}
          </nav>

          {/* Project Actions */}
          <div className="mt-6 pt-4 border-t border-gray-200">
            {isAdmin && (
              <Link
                href={`/projects/${projectId}/members?edit=true`}
                className="block px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Manage Members
              </Link>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 min-w-0">
        {children}
      </main>
    </div>
  );
}






