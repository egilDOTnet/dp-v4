"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import Link from "next/link";
import { Card, CardBody, LoadingSpinner, Breadcrumbs } from "@/components/ui";

export default function AdminDashboardPage() {
  const _router = useRouter();
  const [stats, setStats] = useState<{
    companies: number;
    users: number;
    requirementTemplates: number;
    emailTemplates: number;
    projects: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.admin
      .stats()
      .then((data) => {
        setStats(data);
      })
      .catch((err) => {
        console.error("Failed to load stats:", err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const breadcrumbItems = [{ label: "Admin Home" }];

  if (loading) {
    return (
      <div>
        <Breadcrumbs items={breadcrumbItems} />
        <div className="flex flex-col items-center justify-center min-h-[400px]">
          <LoadingSpinner size="lg" />
          <p className="mt-4 text-text-secondary">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div>
        <Breadcrumbs items={breadcrumbItems} />
        <div className="text-center py-12">
          <p className="text-text-secondary">Failed to load dashboard stats</p>
        </div>
      </div>
    );
  }

  const widgets = [
    {
      title: "Companies",
      count: stats.companies,
      href: "/admin/companies",
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      ),
    },
    {
      title: "Users",
      count: stats.users,
      href: "/admin/users",
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      ),
    },
    {
      title: "Requirements Templates",
      count: stats.requirementTemplates,
      href: "/admin/requirement-templates",
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
    },
    {
      title: "Email Templates",
      count: stats.emailTemplates,
      href: "/admin/email-templates",
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      ),
    },
    {
      title: "Translations",
      count: null,
      href: "/admin/translations",
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
        </svg>
      ),
    },
    {
      title: "Projects",
      count: stats.projects,
      href: "/admin/projects",
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <Breadcrumbs items={breadcrumbItems} />
      
      <div>
        <h1 className="text-3xl font-bold text-text-primary">Admin Dashboard</h1>
        <p className="mt-2 text-text-secondary">Manage system-wide settings and configurations</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {widgets.map((widget) => (
          <Link key={widget.href} href={widget.href}>
            <Card variant="interactive" className="h-full">
              <CardBody className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="text-primary-600">{widget.icon}</div>
                  {widget.count !== null && (
                    <div className="text-3xl font-bold text-text-primary">
                      {widget.count}
                    </div>
                  )}
                </div>
                <h3 className="text-lg font-semibold text-text-primary">
                  {widget.title}
                </h3>
              </CardBody>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}

