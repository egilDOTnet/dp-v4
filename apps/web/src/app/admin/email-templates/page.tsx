"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import Link from "next/link";
import { useSearch } from "@/hooks/useSearch";
import { Breadcrumbs, SearchBar, Card, CardBody, Button, LoadingSpinner, EmptyState, PageHeader, Badge } from "@/components/ui";

interface EmailTemplate {
  id: string;
  name: string;
  content?: string | null;
  isGlobal: boolean;
  createdAt: string;
  updatedAt: string;
  languages: Array<{
    id: string;
    languageCode: string;
    subject?: string | null;
    content: string;
  }>;
}

export default function EmailTemplatesPage() {
  const router = useRouter();
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  const { searchTerm, setSearchTerm, filteredItems, clearSearch, isSearching } = useSearch(templates, {
    searchKeys: ["name"],
  });

  const displayItems = isSearching ? filteredItems : templates;

  useEffect(() => {
    api.admin.emailTemplates
      .list()
      .then((data) => {
        setTemplates(data);
      })
      .catch((err) => {
        console.error("Failed to load templates:", err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this email template?")) return;
    
    try {
      await api.admin.emailTemplates.delete(id);
      setTemplates(templates.filter((t) => t.id !== id));
    } catch (err: any) {
      alert(err.message || "Failed to delete template");
    }
  };

  const breadcrumbItems = [
    { label: "Admin Home", href: "/admin" },
    { label: "Email Templates" },
  ];

  if (loading) {
    return (
      <div>
        <Breadcrumbs items={breadcrumbItems} />
        <div className="flex flex-col items-center justify-center min-h-[400px]">
          <LoadingSpinner size="lg" />
          <p className="mt-4 text-text-secondary">Loading templates...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Breadcrumbs items={breadcrumbItems} />
      
      <PageHeader
        title="Email Templates"
        actions={
          <Button
            variant="primary"
            onClick={() => router.push("/admin/email-templates/new")}
          >
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Template
          </Button>
        }
      />

      {templates.length > 0 && (
        <div className="flex items-center gap-4 mb-6">
          <div className="w-1/2">
            <SearchBar
              value={searchTerm}
              onChange={setSearchTerm}
              onClear={clearSearch}
              placeholder="Search templates..."
            />
          </div>
          {isSearching && (
            <span className="text-sm text-text-secondary">
              {displayItems.length} of {templates.length} templates
            </span>
          )}
        </div>
      )}

      {displayItems.length === 0 ? (
        <EmptyState
          title={isSearching ? "No templates found" : "No templates"}
          description={isSearching ? "Try adjusting your search query" : "Get started by creating a new email template"}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {displayItems.map((template) => (
            <Card key={template.id} variant="default">
              <CardBody className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <Link href={`/admin/email-templates/${template.id}`} className="flex-1">
                    <h3 className="text-lg font-semibold text-text-primary hover:text-primary-600">
                      {template.name}
                    </h3>
                  </Link>
                  <button
                    onClick={() => handleDelete(template.id)}
                    className="text-red-600 hover:text-red-700 ml-2"
                    title="Delete template"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
                <div className="space-y-2">
                  {template.languages.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {template.languages.map((lang) => (
                        <Badge key={lang.id} className="bg-primary-100 text-primary-800 dark:bg-primary-900 dark:text-primary-200">
                          {lang.languageCode.toUpperCase()}
                        </Badge>
                      ))}
                    </div>
                  )}
                  {template.languages.length === 0 && (
                    <p className="text-xs text-text-secondary">No language versions</p>
                  )}
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}


