"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { api, Project } from "@/lib/api";

export default function ManageProjectPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const projectId = params.id as string;
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const isAdmin =
    user?.role === "CompanyAdministrator" || user?.role === "GlobalAdministrator";

  // Prepopulate start date with current date
  const getCurrentDate = () => {
    const today = new Date();
    return today.toISOString().split("T")[0];
  };

  const [formData, setFormData] = useState({
    name: "",
    type: "",
    startDate: getCurrentDate(),
    endDate: "",
  });

  useEffect(() => {
    if (!isAdmin) {
      router.push(`/projects/${projectId}`);
      return;
    }

    api.projects
      .get(projectId)
      .then((data) => {
        setProject(data);
        setFormData({
          name: data.name,
          type: data.type || "",
          startDate: data.startDate
            ? new Date(data.startDate).toISOString().split("T")[0]
            : getCurrentDate(),
          endDate: data.endDate
            ? new Date(data.endDate).toISOString().split("T")[0]
            : "",
        });
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || "Failed to load project");
        setLoading(false);
      });
  }, [projectId, isAdmin, router]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    setSaving(true);

    try {
      const updatedProject = await api.projects.update(projectId, {
        name: formData.name,
        type: formData.type || null,
        startDate: formData.startDate || null,
        endDate: formData.endDate || null,
      });
      setProject(updatedProject);
      setSaving(false);
      // Redirect back to project dashboard
      router.push(`/projects/${projectId}`);
    } catch (err: any) {
      setFormError(err.message || "Failed to update project");
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await api.projects.delete(projectId);
      router.push("/dashboard");
    } catch (err: any) {
      setFormError(err.message || "Failed to delete project");
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

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
    <div className="max-w-4xl">
      {/* Breadcrumb Navigation */}
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
          {project.name}
        </Link>
        <span className="mx-2">/</span>
        <span className="text-gray-900">Manage</span>
      </nav>

      <h1 className="text-3xl font-bold mb-6">Manage Project</h1>

      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-2xl font-semibold mb-4">Project Details</h2>
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
              Project Name *
            </label>
            <input
              id="name"
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div>
            <label htmlFor="type" className="block text-sm font-medium text-gray-700 mb-1">
              Type
            </label>
            <input
              id="type"
              type="text"
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value })}
              placeholder="e.g., CRM system"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="startDate"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Start Date
              </label>
              <input
                id="startDate"
                type="date"
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label
                htmlFor="endDate"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                End Date
              </label>
              <input
                id="endDate"
                type="date"
                value={formData.endDate}
                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>

          {formError && <p className="text-sm text-red-600">{formError}</p>}

          <div className="flex gap-2 pt-4">
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
            <Link
              href={`/projects/${projectId}`}
              className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 inline-flex items-center"
            >
              Cancel
            </Link>
          </div>
        </form>
      </div>

      {/* Member Management Section */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-semibold">Project Members</h2>
          <Link
            href={`/projects/${projectId}/members?edit=true`}
            className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700"
          >
            Manage Members
          </Link>
        </div>
        {project.members && project.members.length > 0 ? (
          <ul className="space-y-2">
            {project.members.map((member) => {
              const displayName =
                member.firstName && member.lastName
                  ? `${member.firstName} ${member.lastName}`
                  : member.firstName || member.lastName || member.name || member.email;
              return (
                <li key={member.id} className="text-gray-900 flex items-center space-x-2">
                  <span className="w-2 h-2 bg-primary-600 rounded-full"></span>
                  <span>{displayName}</span>
                  <span className="text-gray-500 text-sm">({member.email})</span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-gray-400 italic">No members assigned to this project</p>
        )}
      </div>

      {/* Danger Zone */}
      <div className="bg-red-50 border border-red-200 rounded-lg shadow-md p-6">
        <h2 className="text-2xl font-semibold text-red-900 mb-4">Danger Zone</h2>
        <p className="text-gray-700 mb-4">
          Deleting this project will permanently remove all associated data including phases, tasks,
          requirements, and vendor information. This action cannot be undone.
        </p>
        <button
          type="button"
          onClick={() => setShowDeleteConfirm(true)}
          disabled={deleting}
          className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
        >
          Delete Project
        </button>
      </div>

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Delete Project</h3>
            <p className="text-gray-700 mb-6">
              Are you sure you want to delete "{project.name}"? This action cannot be undone and
              will delete all associated phases and tasks.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
                className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


