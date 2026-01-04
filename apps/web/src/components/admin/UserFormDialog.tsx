"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { SlideOver } from "../ui/SlideOver";
import { FormField, Input, Button, Select } from "../ui/FormField";
import { api } from "@/lib/api";

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

interface UserFormDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when dialog should close */
  onClose: () => void;
  /** Existing user data for edit mode */
  existingUser?: User;
  /** Callback when user is saved */
  onSave: (data: {
    email: string;
    firstName?: string;
    lastName?: string;
    name?: string;
    role: string;
    tenantId?: string | null;
  }) => Promise<void>;
}

export function UserFormDialog({
  open,
  onClose,
  existingUser,
  onSave,
}: UserFormDialogProps) {
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState("User");
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loadingCompanies, setLoadingCompanies] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const emailRef = useRef<HTMLInputElement>(null);

  const isEditing = !!existingUser;

  // Load companies when dialog opens
  useEffect(() => {
    if (open) {
      setLoadingCompanies(true);
      api.admin.companies
        .list()
        .then((data) => {
          setCompanies(data);
        })
        .catch((err) => {
          console.error("Failed to load companies:", err);
        })
        .finally(() => {
          setLoadingCompanies(false);
        });
    }
  }, [open]);

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (open) {
      if (existingUser) {
        setEmail(existingUser.email);
        setFirstName(existingUser.firstName || "");
        setLastName(existingUser.lastName || "");
        setName(existingUser.name || "");
        setRole(existingUser.role);
        setTenantId(existingUser.tenantId || null);
      } else {
        setEmail("");
        setFirstName("");
        setLastName("");
        setName("");
        setRole("User");
        setTenantId(null);
      }
      setError("");

      // Focus the email input
      setTimeout(() => {
        emailRef.current?.focus();
      }, 100);
    }
  }, [open, existingUser]);

  const handleSubmit = useCallback(async () => {
    setError("");

    // Validate email
    if (!email.trim()) {
      setError("Email is required");
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setError("Please enter a valid email address");
      return;
    }

    // Validate role
    if (!role) {
      setError("Role is required");
      return;
    }

    setSubmitting(true);
    try {
      await onSave({
        email: email.trim(),
        firstName: firstName.trim() || undefined,
        lastName: lastName.trim() || undefined,
        name: name.trim() || undefined,
        role,
        tenantId,
      });
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to save user");
    } finally {
      setSubmitting(false);
    }
  }, [email, firstName, lastName, name, role, tenantId, onSave, onClose]);

  const roleOptions = [
    { value: "User", label: "User" },
    { value: "CompanyAdministrator", label: "Company Administrator" },
    { value: "GlobalAdministrator", label: "Global Administrator" },
    { value: "Vendor", label: "Vendor" },
  ];

  const companyOptions = [
    { value: "", label: "None" },
    ...companies.map((c) => ({ value: c.id, label: c.name })),
  ];

  return (
    <>
      <SlideOver
        open={open}
        onClose={onClose}
        title={isEditing ? "Edit User" : "Create User"}
        description={
          isEditing
            ? "Update user information and role"
            : "Create a new user account"
        }
        size="md"
        footer={
          <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
            <Button
              variant="secondary"
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleSubmit}
              loading={submitting}
            >
              {isEditing ? "Save Changes" : "Create User"}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <FormField label="Email" required>
            <Input
              ref={emailRef}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.com"
              hasError={(!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) && !!error}
            />
          </FormField>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="First Name">
              <Input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="First name"
              />
            </FormField>
            <FormField label="Last Name">
              <Input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Last name"
              />
            </FormField>
          </div>

          <FormField
            label="Name (Fallback)"
            helperText="Full name if first/last name not available"
          >
            <Input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Full name (if first/last not available)"
            />
          </FormField>

          <FormField label="Role" required>
            <Select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              options={roleOptions}
            />
            <p className="text-sm text-text-secondary mt-1">
              {role === "GlobalAdministrator" && "Full access to all companies and users"}
              {role === "CompanyAdministrator" && "Administrative access to assigned company"}
              {role === "User" && "Standard user access"}
              {role === "Vendor" && "Vendor access for responding to RFIs and RFPs"}
            </p>
          </FormField>

          <FormField
            label="Company"
            helperText="Assign user to a company (optional)"
          >
            <Select
              value={tenantId || ""}
              onChange={(e) => setTenantId(e.target.value || null)}
              options={companyOptions}
              disabled={loadingCompanies}
            />
          </FormField>

          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-3">
              <p className="text-sm text-red-800 dark:text-red-200 font-medium">
                {error}
              </p>
            </div>
          )}
        </div>
      </SlideOver>

    </>
  );
}

