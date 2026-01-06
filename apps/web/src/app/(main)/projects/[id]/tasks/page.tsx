"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { api, Project, Phase, Task } from "@/lib/api";
import PhaseTimeline from "@/components/PhaseTimeline";
import TaskList from "@/components/TaskList";
import { useSearch } from "@/hooks/useSearch";
import { SearchBar } from "@/components/ui";

export default function TasksPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const projectId = params.id as string;
  const phaseParam = searchParams.get("phase");
  
  const [project, setProject] = useState<Project | null>(null);
  const [phases, setPhases] = useState<Phase[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedPhaseId, setSelectedPhaseId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showHeroBanner, setShowHeroBanner] = useState(true);
  const [isCreatingNewTask, setIsCreatingNewTask] = useState(false);

  // Search functionality for tasks
  const { searchTerm, setSearchTerm, filteredItems: filteredTasks, clearSearch, isSearching } =
    useSearch(tasks, {
      searchKeys: ["name", "description"],
    });

  // Display items - use tasks directly if not searching, otherwise use filteredItems
  const displayTasks = isSearching ? filteredTasks : tasks;

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
        // If phase parameter is provided in URL, use it
        if (phaseParam && data.some(p => p.id === phaseParam)) {
          setSelectedPhaseId(phaseParam);
        } 
        // Otherwise, auto-select the first phase with incomplete tasks
        else if (data.length > 0 && !selectedPhaseId) {
          const firstPhaseWithOpenTasks = data.find(
            (phase) => phase.completedTaskCount < phase.taskCount
          );
          const phaseToSelect = firstPhaseWithOpenTasks || data[0];
          setSelectedPhaseId(phaseToSelect.id);
        }
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
    }
  }, [selectedPhaseId, projectId]);

  useEffect(() => {
    // Check if user has dismissed the hero banner before
    const dismissed = localStorage.getItem("tasks-hero-banner-dismissed");
    if (dismissed === "true") {
      setShowHeroBanner(false);
    }
  }, []);

  const handleDismissHeroBanner = () => {
    localStorage.setItem("tasks-hero-banner-dismissed", "true");
    setShowHeroBanner(false);
  };

  const handlePhaseClick = (phaseId: string) => {
    setSelectedPhaseId(phaseId);
  };

  const handleTaskUpdate = () => {
    loadPhases();
    if (selectedPhaseId) {
      loadTasks(selectedPhaseId);
    }
  };

  if (loading) {
    return (
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">Loading tasks...</p>
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
        <Link href={`/projects/${projectId}`} className="hover:text-primary-600">
          {project.name}
        </Link>
        <span className="mx-2">/</span>
        <span className="text-gray-900">Tasks</span>
      </nav>

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Tasks</h1>
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
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Welcome to Tasks</h3>
              <p className="text-gray-700 mb-3">
                <strong>Tasks</strong> are organized into phases that guide you through the procurement process step by step. Each phase represents a major milestone, and tasks within each phase help you stay on track with specific activities.
              </p>
              <p className="text-gray-700 mb-3">
                <strong>Here's what you can do:</strong>
              </p>
              <ul className="list-disc list-inside text-gray-700 space-y-1 mb-4 ml-2">
                <li><strong>View tasks by phase:</strong> Click on any phase to see its tasks and track progress</li>
                <li><strong>Assign task owners:</strong> Designate team members responsible for each task</li>
                <li><strong>Track completion:</strong> Mark tasks as complete to update phase progress</li>
                <li><strong>Add context:</strong> Include descriptions and links to relevant resources</li>
              </ul>
              <div className="bg-white/60 border border-primary-300 rounded-md p-3 shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="text-3xl flex-shrink-0">💡</div>
                  <div className="flex-1 text-sm text-gray-700 italic">
                    <div className="font-bold not-italic mb-1">Tip:</div>
                    <div>Keep tasks updated regularly to help your team stay aligned on priorities.</div>
                    <div>Completed tasks automatically update the phase progress indicators!</div>
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

      {/* Phase Timeline - Always visible */}
      <div className="mb-6">
        <PhaseTimeline
          phases={phases}
          selectedPhaseId={selectedPhaseId}
          onPhaseClick={handlePhaseClick}
        />
      </div>

      {/* Search Bar and New Task Button */}
      {selectedPhaseId && selectedPhase && (
        <div className="flex items-center gap-4 mb-6">
          <div className="flex-1 max-w-md">
            <SearchBar
              value={searchTerm}
              onChange={setSearchTerm}
              onClear={clearSearch}
              placeholder="Search tasks..."
            />
          </div>
          {isSearching && (
            <span className="text-sm text-text-secondary">
              {filteredTasks.length} of {tasks.length} tasks
            </span>
          )}
          <button
            onClick={() => setIsCreatingNewTask(true)}
            disabled={isCreatingNewTask}
            className="ml-auto px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 text-sm font-medium flex items-center gap-1 transition-colors disabled:opacity-50"
          >
            <svg
              className="w-4 h-4"
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
            New Task
          </button>
        </div>
      )}

      {/* Task List - Shown when phase is selected */}
      {selectedPhaseId && selectedPhase && (
        <div className="mb-6">
          <TaskList
            projectId={projectId}
            phaseId={selectedPhaseId}
            tasks={displayTasks}
            projectMembers={project.members || []}
            onTaskUpdate={handleTaskUpdate}
            phaseTitle={`${selectedPhase.order}. ${selectedPhase.name}`}
            hideNewTaskButton
            isCreatingNewTaskExternal={isCreatingNewTask}
            onIsCreatingNewTaskChange={setIsCreatingNewTask}
          />
        </div>
      )}
    </div>
  );
}
