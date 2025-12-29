"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Breadcrumbs, Button, Input, LoadingSpinner, PageHeader, Textarea } from "@/components/ui";

interface RequirementTemplate {
  id: string;
  shortName: string;
  description?: string | null;
  languageCode?: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: {
    id: string;
    email: string;
    name?: string | null;
  };
  hierarchies?: any[];
}

export default function RequirementTemplateDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const isNew = id === "new";
  
  const [template, setTemplate] = useState<RequirementTemplate | null>(null);
  const [shortName, setShortName] = useState("");
  const [description, setDescription] = useState("");
  const [languageCode, setLanguageCode] = useState("");
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isNew) {
      setShortName("");
      setDescription("");
      setLanguageCode("");
      return;
    }

    api.admin.requirementTemplates
      .get(id)
      .then((data) => {
        setTemplate(data);
        setShortName(data.shortName);
        setDescription(data.description || "");
        setLanguageCode(data.languageCode || "");
      })
      .catch((err) => {
        console.error("Failed to load template:", err);
        alert("Failed to load template");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [id, isNew]);

  const handleSave = async () => {
    if (!shortName.trim()) {
      alert("Short name is required");
      return;
    }

    setSaving(true);
    try {
      if (isNew) {
        const newTemplate = await api.admin.requirementTemplates.create({
          shortName,
          description: description || undefined,
          languageCode: languageCode || undefined,
        });
        router.push(`/admin/requirement-templates/${newTemplate.id}`);
      } else {
        await api.admin.requirementTemplates.update(id, {
          shortName,
          description: description || undefined,
          languageCode: languageCode || undefined,
        });
        const updated = await api.admin.requirementTemplates.get(id);
        setTemplate(updated);
      }
    } catch (err: any) {
      alert(err.message || "Failed to save template");
    } finally {
      setSaving(false);
    }
  };

  const breadcrumbItems = [
    { label: "Admin Home", href: "/admin" },
    { label: "Requirements Templates", href: "/admin/requirement-templates" },
    { label: isNew ? "New Template" : template?.shortName || "Template" },
  ];

  if (loading) {
    return (
      <div>
        <Breadcrumbs items={breadcrumbItems} />
        <div className="flex flex-col items-center justify-center min-h-[400px]">
          <LoadingSpinner size="lg" />
          <p className="mt-4 text-text-secondary">Loading template...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Breadcrumbs items={breadcrumbItems} />
      
      <PageHeader
        title={isNew ? "New Requirement Template" : template?.shortName || "Template"}
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => router.push("/admin/requirement-templates")}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSave} loading={saving}>
              {isNew ? "Create" : "Save"}
            </Button>
          </div>
        }
      />

      <div className="max-w-2xl space-y-6">
        <Input
          label="Short Name"
          value={shortName}
          onChange={(e) => setShortName(e.target.value)}
          placeholder="e.g., ISO27001, GDPR"
          required
          autoFocus
        />

        <Textarea
          label="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Template description"
          rows={4}
        />

        <Input
          label="Language Code (ISO 639-1)"
          value={languageCode}
          onChange={(e) => setLanguageCode(e.target.value)}
          placeholder="e.g., en, no, sv"
        />
        <p className="text-xs text-text-secondary">
          Language code for future localization support (e.g., "en" for English, "no" for Norwegian)
        </p>

        {!isNew && template?.hierarchies && template.hierarchies.length > 0 && (
          <div className="mt-8">
            <h2 className="text-xl font-semibold text-text-primary mb-4">Requirement Hierarchies</h2>
            <div className="bg-background-secondary rounded-lg p-4 border border-border-primary">
              <p className="text-sm text-text-secondary">
                This template has {template.hierarchies.length} hierarchy level(s). 
                Requirement hierarchy management for templates will be available in a future update.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

