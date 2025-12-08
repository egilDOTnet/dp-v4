"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme, ThemePreference } from "@/contexts/ThemeContext";
import { api, User } from "@/lib/api";
import {
  Card,
  CardBody,
  FormField,
  Input,
  Button,
  LoadingSpinner,
  PageHeader,
} from "@/components/ui";

export default function ProfilePage() {
  const router = useRouter();
  const { user: authUser, refreshUser } = useAuth();
  const { preference, setPreference } = useTheme();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const firstInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!authUser) return;

    api.users
      .getProfile()
      .then((data) => {
        setUser(data);
        setFirstName(data.firstName || "");
        setLastName(data.lastName || "");
        setCompanyName(data.companyName || "");
      })
      .catch((err) => {
        console.error("Failed to load profile:", err);
        setError(err.message);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [authUser]);

  // Auto-focus first editable input on load
  useEffect(() => {
    if (!loading && firstInputRef.current) {
      firstInputRef.current.focus();
    }
  }, [loading]);

  const isAdmin =
    authUser?.role === "CompanyAdministrator" ||
    authUser?.role === "GlobalAdministrator";

  const handleSave = async () => {
    setSaving(true);
    setError("");

    try {
      const updateData: {
        firstName?: string;
        lastName?: string;
        companyName?: string;
      } = {};

      // Only send fields that have changed
      if (firstName !== (user?.firstName || "")) {
        updateData.firstName = firstName;
      }
      if (lastName !== (user?.lastName || "")) {
        updateData.lastName = lastName;
      }

      // Only include companyName if user is admin and it has changed
      if (isAdmin && companyName !== (user?.companyName || "")) {
        updateData.companyName = companyName || undefined;
      }

      // If nothing changed, just return early
      if (Object.keys(updateData).length === 0) {
        setSaving(false);
        router.push("/dashboard");
        return;
      }

      const updated = await api.users.updateProfile(updateData);
      setUser(updated);
      setFirstName(updated.firstName || "");
      setLastName(updated.lastName || "");
      if (updated.companyName) {
        setCompanyName(updated.companyName);
      }
      await refreshUser();

      // Redirect to dashboard after successful save
      router.push("/dashboard");
    } catch (err: any) {
      setError(err.message || "Failed to update profile");
      // Revert to original values on error
      if (user) {
        setFirstName(user.firstName || "");
        setLastName(user.lastName || "");
        setCompanyName(user.companyName || "");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (user) {
      setFirstName(user.firstName || "");
      setLastName(user.lastName || "");
      setCompanyName(user.companyName || "");
    }
    setError("");
    router.push("/dashboard");
  };

  const themeOptions: { value: ThemePreference; label: string; icon: string }[] =
    [
      { value: "light", label: "Light", icon: "☀️" },
      { value: "dark", label: "Dark", icon: "🌙" },
      { value: "system", label: "System", icon: "💻" },
    ];

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <LoadingSpinner size="lg" />
        <p className="mt-4 text-gray-600 dark:text-gray-400">
          Loading profile...
        </p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="text-red-600 dark:text-red-400">
        Failed to load profile
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <PageHeader title="Profile" className="mb-6" />

      <div className="space-y-6">
        {/* Profile Information Card */}
        <Card>
          <CardBody className="space-y-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Personal Information
            </h2>

            <FormField label="Email">
              <Input value={user.email} disabled />
            </FormField>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="First Name">
                <Input
                  ref={firstInputRef}
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  disabled={saving}
                  placeholder="Enter your first name"
                />
              </FormField>

              <FormField label="Last Name">
                <Input
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  disabled={saving}
                  placeholder="Enter your last name"
                />
              </FormField>
            </div>

            <FormField
              label="Company Name"
              helperText={
                !isAdmin ? "Only administrators can edit company name" : undefined
              }
            >
              <Input
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                disabled={!isAdmin || saving}
                placeholder="Company name"
              />
            </FormField>

            <FormField label="Role">
              <Input value={user.role} disabled />
            </FormField>
          </CardBody>
        </Card>

        {/* Theme Selection Card */}
        <Card>
          <CardBody className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Appearance
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Choose how the application looks to you
            </p>

            <div className="flex flex-wrap gap-3">
              {themeOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setPreference(option.value)}
                  className={`
                    flex items-center gap-2 px-4 py-3 rounded-lg border-2 transition-all
                    ${
                      preference === option.value
                        ? "border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300"
                        : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 text-gray-700 dark:text-gray-300"
                    }
                  `}
                >
                  <span className="text-xl">{option.icon}</span>
                  <span className="font-medium">{option.label}</span>
                </button>
              ))}
            </div>
          </CardBody>
        </Card>

        {/* Error Message */}
        {error && (
          <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center gap-3">
          <Button
            variant="primary"
            onClick={handleSave}
            loading={saving}
            disabled={saving}
          >
            {saving ? "Saving..." : "Save Changes"}
          </Button>
          <Button variant="secondary" onClick={handleCancel} disabled={saving}>
            Cancel
          </Button>
        </div>

        {/* Keyboard hints */}
        <p className="text-xs text-gray-400 dark:text-gray-500">
          Theme changes are applied immediately and saved locally
        </p>
      </div>
    </div>
  );
}
