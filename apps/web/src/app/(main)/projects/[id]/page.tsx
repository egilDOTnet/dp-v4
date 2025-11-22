"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api, Project } from "@/lib/api";

export default function ProjectDetailPage() {
  const params = useParams();
  const projectId = params.id as string;
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
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
  }, [projectId]);

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
      <h1 className="text-3xl font-bold mb-6">{project.name}</h1>

      <div className="bg-white rounded-lg shadow-md p-6 space-y-4">
        {project.type && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
            <p className="text-gray-900">{project.type}</p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          {project.startDate && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
              <p className="text-gray-900">
                {new Date(project.startDate).toLocaleDateString()}
              </p>
            </div>
          )}
          {project.endDate && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
              <p className="text-gray-900">
                {new Date(project.endDate).toLocaleDateString()}
              </p>
            </div>
          )}
        </div>

        {project.members && project.members.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Members</label>
            <ul className="space-y-1">
              {project.members.map((member) => (
                <li key={member.id} className="text-gray-900">
                  {member.name || member.email}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="pt-4 border-t">
          <p className="text-sm text-gray-500">
            Project modules (Planning, RFI, Requirements, etc.) will be available in Phase 2.
          </p>
        </div>
      </div>
    </div>
  );
}

