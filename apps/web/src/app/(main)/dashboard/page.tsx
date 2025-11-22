"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { api, Project } from "@/lib/api";
import Link from "next/link";

export default function DashboardPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    api.projects
      .list()
      .then((data) => {
        setProjects(data);
        // If user has only one project, redirect to it
        if (data.length === 1) {
          router.push(`/projects/${data[0].id}`);
        }
      })
      .catch((err) => {
        console.error("Failed to load projects:", err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [user, router]);

  const isAdmin =
    user?.role === "CompanyAdministrator" || user?.role === "GlobalAdministrator";

  if (loading) {
    return (
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">Loading projects...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        {isAdmin && (
          <Link
            href="/projects/new"
            className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700"
          >
            Create New Project
          </Link>
        )}
      </div>

      {projects.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-600 mb-4">No projects found.</p>
          {isAdmin && (
            <Link
              href="/projects/new"
              className="inline-block px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700"
            >
              Create Your First Project
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((project) => (
            <Link
              key={project.id}
              href={`/projects/${project.id}`}
              className="block p-6 bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow"
            >
              <h2 className="text-xl font-semibold mb-2">{project.name}</h2>
              {project.type && (
                <p className="text-sm text-gray-600 mb-2">Type: {project.type}</p>
              )}
              {project.startDate && (
                <p className="text-sm text-gray-500">
                  Start: {new Date(project.startDate).toLocaleDateString()}
                </p>
              )}
              {project.endDate && (
                <p className="text-sm text-gray-500">
                  End: {new Date(project.endDate).toLocaleDateString()}
                </p>
              )}
              {project.members && project.members.length > 0 && (
                <p className="text-sm text-gray-500 mt-2">
                  {project.members.length} member{project.members.length !== 1 ? "s" : ""}
                </p>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

