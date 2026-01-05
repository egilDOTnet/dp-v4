"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Breadcrumbs, Button, Input, LoadingSpinner, PageHeader, Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui";
import WysiwygEditor from "@/components/WysiwygEditor";

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
    createdAt: string;
    updatedAt: string;
  }>;
}

const commonLanguages = [
  { code: "en", name: "English" },
  { code: "no", name: "Norwegian" },
  { code: "sv", name: "Swedish" },
  { code: "da", name: "Danish" },
];

export default function EmailTemplateDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const isNew = id === "new";
  
  const [template, setTemplate] = useState<EmailTemplate | null>(null);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [activeLanguage, setActiveLanguage] = useState<string>("en");
  const [languageContents, setLanguageContents] = useState<Record<string, { subject: string; content: string }>>({});

  useEffect(() => {
    if (isNew) {
      setName("");
      setLanguageContents({});
      setActiveLanguage("en");
      return;
    }

    api.admin.emailTemplates
      .get(id)
      .then((data) => {
        setTemplate(data);
        setName(data.name);
        
        // Initialize language contents
        const contents: Record<string, { subject: string; content: string }> = {};
        data.languages.forEach((lang) => {
          contents[lang.languageCode] = {
            subject: lang.subject || "",
            content: lang.content || "",
          };
        });
        setLanguageContents(contents);
        
        // Set active language to first available or "en"
        if (data.languages.length > 0) {
          setActiveLanguage(data.languages[0].languageCode);
        } else {
          setActiveLanguage("en");
        }
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
    if (!name.trim()) {
      alert("Template name is required");
      return;
    }

    setSaving(true);
    try {
      if (isNew) {
        const newTemplate = await api.admin.emailTemplates.create({
          name,
          content: "",
        });
        // Save all language versions
        for (const [langCode, langData] of Object.entries(languageContents)) {
          if (langData.content.trim()) {
            await api.admin.emailTemplates.addLanguage(newTemplate.id, {
              languageCode: langCode,
              subject: langData.subject || undefined,
              content: langData.content,
            });
          }
        }
        router.push(`/admin/email-templates/${newTemplate.id}`);
      } else {
        await api.admin.emailTemplates.update(id, {
          name,
        });
        // Update all language versions
        for (const [langCode, langData] of Object.entries(languageContents)) {
          if (langData.content.trim()) {
            await api.admin.emailTemplates.addLanguage(id, {
              languageCode: langCode,
              subject: langData.subject || undefined,
              content: langData.content,
            });
          }
        }
        // Reload template to get updated data
        const updated = await api.admin.emailTemplates.get(id);
        setTemplate(updated);
        const contents: Record<string, { subject: string; content: string }> = {};
        updated.languages.forEach((lang) => {
          contents[lang.languageCode] = {
            subject: lang.subject || "",
            content: lang.content || "",
          };
        });
        setLanguageContents(contents);
      }
    } catch (err: any) {
      alert(err.message || "Failed to save template");
    } finally {
      setSaving(false);
    }
  };

  const handleAddLanguage = (langCode: string) => {
    if (!languageContents[langCode]) {
      setLanguageContents({
        ...languageContents,
        [langCode]: { subject: "", content: "" },
      });
    }
    setActiveLanguage(langCode);
  };

  const handleDeleteLanguage = async (langCode: string) => {
    if (!confirm(`Are you sure you want to delete the ${langCode.toUpperCase()} language version?`)) return;
    
    if (isNew) {
      const newContents = { ...languageContents };
      delete newContents[langCode];
      setLanguageContents(newContents);
      // Switch to another language if available
      const remaining = Object.keys(newContents);
      if (remaining.length > 0) {
        setActiveLanguage(remaining[0]);
      }
    } else {
      try {
        await api.admin.emailTemplates.deleteLanguage(id, langCode);
        const newContents = { ...languageContents };
        delete newContents[langCode];
        setLanguageContents(newContents);
        // Switch to another language if available
        const remaining = Object.keys(newContents);
        if (remaining.length > 0) {
          setActiveLanguage(remaining[0]);
        }
        // Reload template
        const updated = await api.admin.emailTemplates.get(id);
        setTemplate(updated);
      } catch (err: any) {
        alert(err.message || "Failed to delete language version");
      }
    }
  };

  const breadcrumbItems = [
    { label: "Admin Home", href: "/admin" },
    { label: "Email Templates", href: "/admin/email-templates" },
    { label: isNew ? "New Template" : template?.name || "Template" },
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

  const availableLanguages = Object.keys(languageContents);
  const _allLanguages = [...new Set([...availableLanguages, ...commonLanguages.map(l => l.code)])];

  return (
    <div className="space-y-6">
      <Breadcrumbs items={breadcrumbItems} />
      
      <PageHeader
        title={isNew ? "New Email Template" : template?.name || "Template"}
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => router.push("/admin/email-templates")}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSave} loading={saving}>
              {isNew ? "Create" : "Save"}
            </Button>
          </div>
        }
      />

      <div className="max-w-4xl space-y-6">
        <Input
          label="Template Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., RFI Email Template"
          required
          autoFocus
        />

        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-text-primary">Language Versions</h2>
            <div className="flex gap-2">
              {commonLanguages.map((lang) => (
                <Button
                  key={lang.code}
                  variant="secondary"
                  size="sm"
                  onClick={() => handleAddLanguage(lang.code)}
                  disabled={!!languageContents[lang.code]}
                >
                  + {lang.name}
                </Button>
              ))}
            </div>
          </div>

          {availableLanguages.length === 0 ? (
            <div className="bg-background-secondary rounded-lg p-6 border border-border-primary text-center">
              <p className="text-text-secondary mb-4">No language versions added yet</p>
              <p className="text-sm text-text-secondary">
                Click a language button above to add a version
              </p>
            </div>
          ) : (
            <Tabs value={activeLanguage} onValueChange={setActiveLanguage}>
              <TabsList>
                {availableLanguages.map((langCode) => {
                  const lang = commonLanguages.find(l => l.code === langCode);
                  return (
                    <TabsTrigger key={langCode} value={langCode}>
                      {lang ? lang.name : langCode.toUpperCase()}
                    </TabsTrigger>
                  );
                })}
              </TabsList>

              {availableLanguages.map((langCode) => {
                const langData = languageContents[langCode] || { subject: "", content: "" };
                const lang = commonLanguages.find(l => l.code === langCode);
                
                return (
                  <TabsContent key={langCode} value={langCode} className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold text-text-primary">
                        {lang ? lang.name : langCode.toUpperCase()} Version
                      </h3>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleDeleteLanguage(langCode)}
                      >
                        Delete Language
                      </Button>
                    </div>

                    <Input
                      label="Email Subject"
                      value={langData.subject}
                      onChange={(e) => {
                        setLanguageContents({
                          ...languageContents,
                          [langCode]: {
                            ...langData,
                            subject: e.target.value,
                          },
                        });
                      }}
                      placeholder="Email subject line"
                    />

                    <div>
                      <label className="block text-sm font-medium text-text-primary mb-2">
                        Email Content
                      </label>
                      <div className="border border-border-primary rounded-md bg-background-primary">
                        <WysiwygEditor
                          value={langData.content}
                          onChange={(content) => {
                            setLanguageContents({
                              ...languageContents,
                              [langCode]: {
                                ...langData,
                                content,
                              },
                            });
                          }}
                          placeholder="Enter email content..."
                        />
                      </div>
                    </div>
                  </TabsContent>
                );
              })}
            </Tabs>
          )}
        </div>
      </div>
    </div>
  );
}

