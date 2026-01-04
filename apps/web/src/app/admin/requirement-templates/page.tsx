"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useSearch } from "@/hooks/useSearch";
import {
  Breadcrumbs,
  SearchBar,
  Button,
  LoadingSpinner,
  EmptyState,
  PageHeader,
  Badge,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui";
import { RequirementTemplateFormDialog } from "@/components/admin/RequirementTemplateFormDialog";
import { ImportWizard } from "@/components/ImportWizard";

interface RequirementTemplate {
  id: string;
  shortName: string;
  description?: string | null;
  languageCode: string;
  createdAt: string;
  updatedAt: string;
  createdBy: {
    id: string;
    email: string;
    name?: string | null;
  };
  requirementCount: number;
}

export default function RequirementTemplatesPage() {
  const router = useRouter();
  const [templates, setTemplates] = useState<RequirementTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<RequirementTemplate | undefined>(undefined);
  const [deletingTemplateId, setDeletingTemplateId] = useState<string | null>(null);
  const [importWizardOpen, setImportWizardOpen] = useState(false);
  const [importingTemplateId, setImportingTemplateId] = useState<string | null>(null);

  const { searchTerm, setSearchTerm, filteredItems, clearSearch, isSearching } = useSearch(templates, {
    searchKeys: ["shortName", "description"],
  });

  const displayItems = isSearching ? filteredItems : templates;

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      const data = await api.admin.requirementTemplates.list();
      setTemplates(data);
    } catch (err) {
      console.error("Failed to load templates:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingTemplate(undefined);
    setDialogOpen(true);
  };

  const handleView = (template: RequirementTemplate) => {
    router.push(`/admin/requirement-templates/${template.id}`);
  };

  const handleEdit = (template: RequirementTemplate) => {
    setEditingTemplate(template);
    setDialogOpen(true);
  };

  const handleImport = (template: RequirementTemplate) => {
    setImportingTemplateId(template.id);
    setImportWizardOpen(true);
  };

  const handleImportSuccess = (count: number) => {
    // Optionally refresh the list or navigate to detail page
    if (importingTemplateId) {
      router.push(`/admin/requirement-templates/${importingTemplateId}`);
    }
  };

  const handleSave = async (data: {
    shortName: string;
    description?: string;
    languageCode: string;
  }) => {
    if (editingTemplate) {
      await api.admin.requirementTemplates.update(editingTemplate.id, data);
    } else {
      await api.admin.requirementTemplates.create(data);
    }
    await loadTemplates();
  };

  const handleDelete = async () => {
    if (!editingTemplate) return;
    
    try {
      await api.admin.requirementTemplates.delete(editingTemplate.id);
      await loadTemplates();
    } catch (err: any) {
      throw new Error(err.message || "Failed to delete template");
    }
  };

  const handleDeleteClick = async (template: RequirementTemplate) => {
    if (!confirm(`Are you sure you want to delete "${template.shortName}"? This will also delete all associated requirement hierarchies. This action cannot be undone.`)) {
      return;
    }
    
    setDeletingTemplateId(template.id);
    try {
      await api.admin.requirementTemplates.delete(template.id);
      await loadTemplates();
    } catch (err: any) {
      alert(err.message || "Failed to delete template");
    } finally {
      setDeletingTemplateId(null);
    }
  };

  const breadcrumbItems = [
    { label: "Admin Home", href: "/admin" },
    { label: "Requirements Templates" },
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
        title="Requirements Templates"
        actions={
          <Button variant="primary" onClick={handleCreate}>
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
          description={isSearching ? "Try adjusting your search query" : "Get started by creating a new requirement template"}
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Short Name</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Language Code</TableHead>
              <TableHead>Requirements</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {displayItems.map((template) => (
              <TableRow key={template.id}>
                <TableCell 
                  className="font-medium cursor-pointer hover:text-primary-600"
                  onClick={() => handleView(template)}
                >
                  {template.shortName}
                </TableCell>
                <TableCell
                  className="cursor-pointer hover:text-primary-600"
                  onClick={() => handleView(template)}
                >
                  {template.description ? (
                    <span className="truncate block max-w-md" title={template.description}>
                      {template.description}
                    </span>
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell>
                  <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                    {template.languageCode.toUpperCase()}
                  </Badge>
                </TableCell>
                <TableCell>{template.requirementCount}</TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleView(template)}
                    >
                      View
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleImport(template)}
                    >
                      Import
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleEdit(template)}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => handleDeleteClick(template)}
                      disabled={deletingTemplateId === template.id}
                      loading={deletingTemplateId === template.id}
                    >
                      Delete
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <RequirementTemplateFormDialog
        open={dialogOpen}
        onClose={() => {
          setDialogOpen(false);
          setEditingTemplate(undefined);
        }}
        existingTemplate={editingTemplate}
        onSave={handleSave}
        onDelete={handleDelete}
      />

      {importingTemplateId && (
        <ImportWizard
          target={{ type: "template", id: importingTemplateId }}
          open={importWizardOpen}
          onOpenChange={(open) => {
            setImportWizardOpen(open);
            if (!open) {
              setImportingTemplateId(null);
            }
          }}
          onSuccess={handleImportSuccess}
        />
      )}
    </div>
  );
}

