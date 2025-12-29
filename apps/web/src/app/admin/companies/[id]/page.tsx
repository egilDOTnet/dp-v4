"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Breadcrumbs, Button, Input, LoadingSpinner, PageHeader } from "@/components/ui";

interface Company {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export default function CompanyDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const isNew = id === "new";
  
  const [company, setCompany] = useState<Company | null>(null);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isNew) {
      setName("");
      return;
    }

    api.admin.companies
      .get(id)
      .then((data) => {
        setCompany(data);
        setName(data.name);
      })
      .catch((err) => {
        console.error("Failed to load company:", err);
        alert("Failed to load company");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [id, isNew]);

  const handleSave = async () => {
    if (!name.trim()) {
      alert("Company name is required");
      return;
    }

    setSaving(true);
    try {
      if (isNew) {
        const newCompany = await api.admin.companies.create({ name });
        router.push(`/admin/companies/${newCompany.id}`);
      } else {
        await api.admin.companies.update(id, { name });
        setCompany({ ...company!, name, updatedAt: new Date().toISOString() });
      }
    } catch (err: any) {
      alert(err.message || "Failed to save company");
    } finally {
      setSaving(false);
    }
  };

  const breadcrumbItems = [
    { label: "Admin Home", href: "/admin" },
    { label: "Companies", href: "/admin/companies" },
    { label: isNew ? "New Company" : company?.name || "Company" },
  ];

  if (loading) {
    return (
      <div>
        <Breadcrumbs items={breadcrumbItems} />
        <div className="flex flex-col items-center justify-center min-h-[400px]">
          <LoadingSpinner size="lg" />
          <p className="mt-4 text-text-secondary">Loading company...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Breadcrumbs items={breadcrumbItems} />
      
      <PageHeader
        title={isNew ? "New Company" : company?.name || "Company"}
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => router.push("/admin/companies")}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSave} loading={saving}>
              {isNew ? "Create" : "Save"}
            </Button>
          </div>
        }
      />

      <div className="max-w-2xl">
        <Input
          label="Company Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Enter company name"
          autoFocus
        />
      </div>
    </div>
  );
}

