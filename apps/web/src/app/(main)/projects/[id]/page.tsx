"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { api, Project, Phase, Task } from "@/lib/api";
import PhaseTimeline from "@/components/PhaseTimeline";
import TaskList from "@/components/TaskList";

export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const projectId = params.id as string;
  const [project, setProject] = useState<Project | null>(null);
  const [phases, setPhases] = useState<Phase[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedPhaseId, setSelectedPhaseId] = useState<string | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [isDetailsAnimatingOut, setIsDetailsAnimatingOut] = useState(false);
  const [isDetailsAnimatingIn, setIsDetailsAnimatingIn] = useState(false);
  const [isTasksAnimatingOut, setIsTasksAnimatingOut] = useState(false);
  const [detailsExpanded, setDetailsExpanded] = useState(false);
  const detailsBoxRef = useRef<HTMLDivElement>(null);

  const isAdmin =
    user?.role === "CompanyAdministrator" || user?.role === "GlobalAdministrator";

  const loadProject = () => {
    api.projects
      .get(projectId)
      .then((data) => {
        setProject(data);
      })
      .catch((err) => {
        setError(err.message || "Failed to load project");
      });
  };

  const loadPhases = () => {
    api.projects.phases
      .list(projectId)
      .then((data) => {
        setPhases(data);
      })
      .catch((err) => {
        console.error("Failed to load phases:", err);
      });
  };

  const loadTasks = (phaseId: string) => {
    api.projects.phases
      .getTasks(projectId, phaseId)
      .then((data) => {
        setTasks(data);
      })
      .catch((err) => {
        console.error("Failed to load tasks:", err);
      });
  };

  useEffect(() => {
    setLoading(true);
    loadProject();
    loadPhases();
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    if (selectedPhaseId) {
      loadTasks(selectedPhaseId);
    } else {
      setTasks([]);
      setIsDetailsAnimatingOut(false);
      setIsTasksAnimatingOut(false);
    }
  }, [selectedPhaseId, projectId]);

  const handlePhaseClick = (phaseId: string) => {
    if (selectedPhaseId === phaseId) {
      // Deselecting - animate out tasks first, then show details
      handleBackToOverview();
    } else {
      // If we're selecting a phase and details box is visible, animate it out first
      if (!selectedPhaseId) {
        setIsDetailsAnimatingOut(true);
        // Wait for animation to complete before setting selectedPhaseId
        setTimeout(() => {
          setSelectedPhaseId(phaseId);
          setIsDetailsAnimatingOut(false);
        }, 300); // Match animation duration
      } else {
        setSelectedPhaseId(phaseId);
      }
    }
  };

  const handleBackToOverview = () => {
    // Animate out tasks first, then show details
    setIsTasksAnimatingOut(true);
    setTimeout(() => {
      setSelectedPhaseId(null);
      setIsTasksAnimatingOut(false);
      // Start with collapsed state
      setIsDetailsAnimatingIn(true);
      setDetailsExpanded(false);
      // Force reflow to ensure collapsed state is rendered
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          // Now trigger the expand animation
          setDetailsExpanded(true);
          setTimeout(() => {
            setIsDetailsAnimatingIn(false);
            setDetailsExpanded(false);
          }, 300);
        });
      });
    }, 300);
  };

  const handleTaskUpdate = () => {
    loadPhases();
    if (selectedPhaseId) {
      loadTasks(selectedPhaseId);
    }
  };

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

  // Initialize form data when entering edit mode
  useEffect(() => {
    if (project && isEditMode) {
      setFormData({
        name: project.name,
        type: project.type || "",
        startDate: project.startDate
          ? new Date(project.startDate).toISOString().split("T")[0]
          : getCurrentDate(),
        endDate: project.endDate
          ? new Date(project.endDate).toISOString().split("T")[0]
          : "",
      });
    }
  }, [project, isEditMode]);

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
      setIsEditMode(false);
      setSaving(false);
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

  const selectedPhase = phases.find((p) => p.id === selectedPhaseId);

  return (
    <div>
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
        <span className="text-gray-900">{project.name}</span>
      </nav>

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">{project.name}</h1>
        <div className="flex gap-2">
          {isAdmin && !isEditMode && (
            <>
              <Link
                href={`/projects/${projectId}/members?edit=true`}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
              >
                Manage Members
              </Link>
              <button
                onClick={() => setIsEditMode(true)}
                className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700"
              >
                Edit
              </button>
            </>
          )}
        </div>
      </div>

      {isEditMode ? (
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-2xl font-semibold mb-4">Edit Project</h2>
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
              <button
                type="button"
                onClick={() => {
                  setIsEditMode(false);
                  setFormError("");
                }}
                className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                disabled={deleting}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 ml-auto"
              >
                Delete Project
              </button>
            </div>
          </form>

          {/* Delete Confirmation Dialog */}
          {showDeleteConfirm && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg shadow-lg p-6 max-w-md w-full mx-4">
                <h3 className="text-lg font-semibold mb-4">Delete Project</h3>
                <p className="text-gray-700 mb-6">
                  Are you sure you want to delete "{project.name}"? This action cannot be undone
                  and will delete all associated phases and tasks.
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
      ) : (
        <>
          {(!selectedPhaseId || isDetailsAnimatingOut || isDetailsAnimatingIn) && (
            <div
              ref={detailsBoxRef}
              className={`bg-white rounded-lg shadow-md mb-6 transition-all duration-300 ease-in-out overflow-hidden ${
                isDetailsAnimatingOut
                  ? "opacity-0 scale-95 max-h-0 mb-0 py-0"
                  : isDetailsAnimatingIn && !detailsExpanded
                  ? "opacity-0 scale-95 max-h-0 mb-0 py-0"
                  : "opacity-100 scale-100 max-h-[500px] py-6"
              }`}
            >
              <div className="p-6">
              <div className="grid grid-cols-3 gap-6">
                {/* Column 1: Type and Description */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Type & Description
                  </label>
                  {project.type ? (
                    <p className="text-gray-900">{project.type}</p>
                  ) : (
                    <p className="text-gray-400 italic">No type specified</p>
                  )}
                </div>

                {/* Column 2: Dates */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Dates
                  </label>
                  <div className="space-y-2">
                    {project.startDate && (
                      <div>
                        <span className="text-xs text-gray-500">Start: </span>
                        <span className="text-gray-900">
                          {new Date(project.startDate).toLocaleDateString()}
                        </span>
                      </div>
                    )}
                    {project.endDate && (
                      <div>
                        <span className="text-xs text-gray-500">Planned End: </span>
                        <span className="text-gray-900">
                          {new Date(project.endDate).toLocaleDateString()}
                        </span>
                      </div>
                    )}
                    {!project.startDate && !project.endDate && (
                      <p className="text-gray-400 italic text-sm">No dates set</p>
                    )}
                  </div>
                </div>

                {/* Column 3: Members */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Members
                  </label>
                  {project.members && project.members.length > 0 ? (
                    <ul className="space-y-1">
                      {project.members.map((member) => {
                        const displayName =
                          member.firstName && member.lastName
                            ? `${member.firstName} ${member.lastName}`
                            : member.firstName ||
                              member.lastName ||
                              member.name ||
                              member.email;
                        return (
                          <li key={member.id} className="text-gray-900 text-sm">
                            {displayName}
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <p className="text-gray-400 italic text-sm">No members</p>
                  )}
                </div>
              </div>
              </div>
            </div>
          )}

          {/* Phase Timeline - Always visible */}
          <div className="mb-6">
            <h2 className="text-xl font-semibold mb-4">Project Phases</h2>
            <PhaseTimeline
              phases={phases}
              selectedPhaseId={selectedPhaseId}
              onPhaseClick={handlePhaseClick}
            />
          </div>

          {/* Task List - Shown when phase is selected */}
          {(selectedPhaseId || isTasksAnimatingOut) && selectedPhase && (
            <div
              className={`mb-6 transition-all duration-300 ease-in-out overflow-hidden ${
                isTasksAnimatingOut
                  ? "opacity-0 scale-95 max-h-0 mb-0"
                  : "opacity-100 scale-100"
              }`}
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold">
                  {selectedPhase.order}. {selectedPhase.name}
                </h2>
                <button
                  onClick={handleBackToOverview}
                  className="text-sm text-gray-600 hover:text-gray-800 underline"
                >
                  Back to project overview
                </button>
              </div>
              <TaskList
                projectId={projectId}
                phaseId={selectedPhaseId || ""}
                tasks={tasks}
                projectMembers={project.members || []}
                onTaskUpdate={handleTaskUpdate}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}

