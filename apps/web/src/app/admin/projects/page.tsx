"use client";

import { Breadcrumbs, EmptyState } from "@/components/ui";

export default function AdminProjectsPage() {
  const breadcrumbItems = [
    { label: "Admin Home", href: "/admin" },
    { label: "Projects" },
  ];

  return (
    <div className="space-y-6">
      <Breadcrumbs items={breadcrumbItems} />
      
      <div>
        <h1 className="text-3xl font-bold text-text-primary">Projects Overview</h1>
        <p className="mt-2 text-text-secondary">View and manage all projects across companies</p>
      </div>

      <EmptyState
        title="Coming Soon"
        description="Projects overview and management will be available in a future release"
      />
    </div>
  );
}

