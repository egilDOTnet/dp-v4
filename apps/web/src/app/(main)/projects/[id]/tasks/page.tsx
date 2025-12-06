"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { api, Project, Phase, Task } from "@/lib/api";
import PhaseTimeline from "@/components/PhaseTimeline";
import TaskList from "@/components/TaskList";

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
      {selectedPhaseId && selectedPhase && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">
              {selectedPhase.order}. {selectedPhase.name}
            </h2>
          </div>
          <TaskList
            projectId={projectId}
            phaseId={selectedPhaseId}
            tasks={tasks}
            projectMembers={project.members || []}
            onTaskUpdate={handleTaskUpdate}
          />
        </div>
      )}
    </div>
  );
}
