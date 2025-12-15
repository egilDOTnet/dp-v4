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
import { ProfileImageUpload } from "@/components/ProfileImageUpload";
import { PROFILE_COLOR_PALETTE } from "@/lib/profile-colors";

export default function ProfilePage() {
  const router = useRouter();
  const { user: authUser, refreshUser } = useAuth();
  const { preference, setPreference } = useTheme();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [profileColor, setProfileColor] = useState<string | null>(null);
  const [profileImageData, setProfileImageData] = useState<string | null>(null);
  const [profileImageFileType, setProfileImageFileType] = useState<string | null>(null);
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
        setProfileColor(data.profileColor || null);
        setProfileImageData(data.profileImageData || null);
        setProfileImageFileType(data.profileImageFileType || null);
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
        profileImageData?: string | null;
        profileImageFileType?: "image/png" | "image/jpeg" | "image/gif" | null;
        profileColor?: string | null;
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

      // Profile image and color
      if (profileImageData !== (user?.profileImageData || null)) {
        updateData.profileImageData = profileImageData;
        // Extract mime type from data URL if not already set
        if (profileImageData && !profileImageFileType) {
          const mimeTypeMatch = profileImageData.match(/data:image\/(png|jpeg|gif);base64,/);
          updateData.profileImageFileType = mimeTypeMatch 
            ? (`image/${mimeTypeMatch[1]}` as "image/png" | "image/jpeg" | "image/gif")
            : null;
        } else {
          updateData.profileImageFileType = profileImageFileType as "image/png" | "image/jpeg" | "image/gif" | null;
        }
      }
      if (profileColor !== (user?.profileColor || null)) {
        updateData.profileColor = profileColor;
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
      setProfileColor(updated.profileColor || null);
      setProfileImageData(updated.profileImageData || null);
      setProfileImageFileType(updated.profileImageFileType || null);
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
        setProfileColor(user.profileColor || null);
        setProfileImageData(user.profileImageData || null);
        setProfileImageFileType(user.profileImageFileType || null);
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
      setProfileColor(user.profileColor || null);
      setProfileImageData(user.profileImageData || null);
      setProfileImageFileType(user.profileImageFileType || null);
    }
    setError("");
    router.push("/dashboard");
  };

  const handleImageUpload = async (data: string, fileType: string) => {
    // Store the image data locally - will be saved on save
    setProfileImageData(data);
    setProfileImageFileType(fileType);
  };

  const handleImageDelete = async () => {
    // Clear the image data locally - will be saved on save
    setProfileImageData(null);
    setProfileImageFileType(null);
  };

  const getCurrentImageDataUrl = (): string | null => {
    if (profileImageData) {
      return profileImageData;
    }
    if (user?.profileImageData) {
      return user.profileImageData;
    }
    return null;
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
        <p className="mt-4 text-text-secondary">
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
            <h2 className="text-lg font-semibold text-text-primary">
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

        {/* Profile Picture and Color Card */}
        <Card>
          <CardBody className="space-y-6">
            <h2 className="text-lg font-semibold text-text-primary">
              Profile Picture
            </h2>
            <p className="text-sm text-text-secondary">
              Upload a profile picture or choose a color for your avatar
            </p>

            <ProfileImageUpload
              currentImage={getCurrentImageDataUrl()}
              onUpload={handleImageUpload}
              onDelete={handleImageDelete}
            />

            <div>
              <label className="block text-sm font-medium text-text-primary mb-3">
                Avatar Background Color
              </label>
              <div className="grid grid-cols-8 gap-2">
                {PROFILE_COLOR_PALETTE.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setProfileColor(color)}
                    className={`
                      w-10 h-10 rounded-full border-2 transition-all hover:scale-110
                      ${
                        (profileColor || user?.profileColor) === color
                          ? "border-primary-600 ring-2 ring-primary-300 ring-offset-2"
                          : "border-border-primary"
                      }
                    `}
                    style={{ backgroundColor: color }}
                    title={color}
                  />
                ))}
              </div>
              <p className="text-xs text-text-secondary mt-2">
                Selected: {(profileColor || user?.profileColor) || "Default"}
              </p>
            </div>
          </CardBody>
        </Card>

        {/* Theme Selection Card */}
        <Card>
          <CardBody className="space-y-4">
            <h2 className="text-lg font-semibold text-text-primary">
              Theme
            </h2>
            <p className="text-sm text-text-secondary">
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
                        : "border-border-primary hover:border-border-secondary text-text-primary"
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
        <p className="text-xs text-text-tertiary">
          Theme changes are applied immediately and saved locally
        </p>
      </div>
    </div>
  );
}
