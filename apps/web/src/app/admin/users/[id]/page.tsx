"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Breadcrumbs, Button, Input, LoadingSpinner, PageHeader, Select } from "@/components/ui";

interface User {
  id: string;
  email: string;
  name?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  role: string;
  tenantId?: string | null;
  tenant?: { id: string; name: string } | null;
  createdAt: string;
  updatedAt: string;
}

interface Company {
  id: string;
  name: string;
}

export default function UserDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const isNew = id === "new";
  
  const [user, setUser] = useState<User | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState("User");
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // Load companies for the dropdown
    api.admin.companies
      .list()
      .then((data) => {
        setCompanies(data);
      })
      .catch((err) => {
        console.error("Failed to load companies:", err);
      });

    if (isNew) {
      setEmail("");
      setFirstName("");
      setLastName("");
      setName("");
      setRole("User");
      setTenantId(null);
      return;
    }

    api.admin.users
      .get(id)
      .then((data) => {
        setUser(data);
        setEmail(data.email);
        setFirstName(data.firstName || "");
        setLastName(data.lastName || "");
        setName(data.name || "");
        setRole(data.role);
        setTenantId(data.tenantId || null);
      })
      .catch((err) => {
        console.error("Failed to load user:", err);
        alert("Failed to load user");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [id, isNew]);

  const handleSave = async () => {
    if (!email.trim()) {
      alert("Email is required");
      return;
    }

    setSaving(true);
    try {
      if (isNew) {
        const newUser = await api.admin.users.create({
          email,
          firstName: firstName || undefined,
          lastName: lastName || undefined,
          name: name || undefined,
          role,
          tenantId,
        });
        router.push(`/admin/users/${newUser.id}`);
      } else {
        await api.admin.users.update(id, {
          email,
          firstName: firstName || undefined,
          lastName: lastName || undefined,
          name: name || undefined,
          role,
          tenantId,
        });
        const updated = await api.admin.users.get(id);
        setUser(updated);
      }
    } catch (err: any) {
      alert(err.message || "Failed to save user");
    } finally {
      setSaving(false);
    }
  };

  const breadcrumbItems = [
    { label: "Admin Home", href: "/admin" },
    { label: "Users", href: "/admin/users" },
    { label: isNew ? "New User" : user?.email || "User" },
  ];

  if (loading) {
    return (
      <div>
        <Breadcrumbs items={breadcrumbItems} />
        <div className="flex flex-col items-center justify-center min-h-[400px]">
          <LoadingSpinner size="lg" />
          <p className="mt-4 text-text-secondary">Loading user...</p>
        </div>
      </div>
    );
  }

  const roleOptions = [
    { value: "User", label: "User" },
    { value: "CompanyAdministrator", label: "Company Administrator" },
    { value: "GlobalAdministrator", label: "Global Administrator" },
    { value: "Vendor", label: "Vendor" },
  ];

  return (
    <div className="space-y-6">
      <Breadcrumbs items={breadcrumbItems} />
      
      <PageHeader
        title={isNew ? "New User" : user?.email || "User"}
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => router.push("/admin/users")}>
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
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="user@example.com"
          required
          autoFocus
        />

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="First Name"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            placeholder="First name"
          />
          <Input
            label="Last Name"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            placeholder="Last name"
          />
        </div>

        <Input
          label="Name (Fallback)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Full name (if first/last not available)"
        />

        <Select
          label="Role"
          value={role}
          onChange={(e) => setRole(e.target.value)}
          options={roleOptions}
        />

        <Select
          label="Company"
          value={tenantId || ""}
          onChange={(e) => setTenantId(e.target.value || null)}
          placeholder="Select a company (optional)"
          options={[
            { value: "", label: "None" },
            ...companies.map((c) => ({ value: c.id, label: c.name })),
          ]}
        />
      </div>
    </div>
  );
}

