"use client";

import { Breadcrumbs, EmptyState } from "@/components/ui";

export default function TranslationsPage() {
  const breadcrumbItems = [
    { label: "Admin Home", href: "/admin" },
    { label: "Translations" },
  ];

  return (
    <div className="space-y-6">
      <Breadcrumbs items={breadcrumbItems} />
      
      <div>
        <h1 className="text-3xl font-bold text-text-primary">Translations</h1>
        <p className="mt-2 text-text-secondary">Manage system translations</p>
      </div>

      <EmptyState
        title="Coming Soon"
        description="Translation management will be available in a future release"
      />
    </div>
  );
}


