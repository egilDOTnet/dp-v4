"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { api, Project } from "@/lib/api";
import Link from "next/link";
import {
  PageHeader,
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
        title="Company Dashboard"
        description={`Welcome back${user?.firstName ? `, ${user.firstName}` : ""}!`}
        actions={
          isAdmin ? (
            <Link href="/projects/new">
              <Button variant="primary">
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
            </Link>
          ) : undefined
        }
      />

      {/* Empty State */}
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
                  onClick: () => router.push("/projects/new"),
                }
              : undefined
          }
        />
      )}

      {/* Project Grid */}
      {projects.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((project) => (
            <Link key={project.id} href={`/projects/${project.id}`}>
              <Card variant="interactive" className="h-full">
                <CardBody>
                  <h2 className="text-xl font-semibold text-text-primary mb-2">
                    {project.name}
                  </h2>
                  {project.type && (
                    <div className="mb-3">
                      <Badge variant="info" size="sm">
                        {project.type}
                      </Badge>
                    </div>
                  )}
                  <div className="space-y-1 text-sm text-text-secondary">
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
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
