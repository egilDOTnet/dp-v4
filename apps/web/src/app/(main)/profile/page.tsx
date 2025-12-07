"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { api, User } from "@/lib/api";

export default function ProfilePage() {
  const router = useRouter();
  const { user: authUser, refreshUser } = useAuth();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

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

  const isAdmin =
    authUser?.role === "CompanyAdministrator" || authUser?.role === "GlobalAdministrator";

  const handleSave = async () => {
    setSaving(true);
    setError("");

    try {
      const updateData: { firstName?: string; lastName?: string; companyName?: string } = {};
      
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
    
    // Redirect to dashboard
    router.push("/dashboard");
  };

  if (loading) {
    return (
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">Loading profile...</p>
      </div>
    );
  }

  if (!user) {
    return <div className="text-red-600">Failed to load profile</div>;
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-3xl font-bold mb-6">Profile</h1>

      <div className="bg-white rounded-lg shadow-md p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <input
            type="email"
            value={user.email}
            disabled
            className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
            <input
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              disabled={saving}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
            <input
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              disabled={saving}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Company Name</label>
          <input
            type="text"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            disabled={!isAdmin || saving}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50 disabled:bg-gray-50"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
          <input
            type="text"
            value={user.role}
            disabled
            className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex gap-2 pt-4">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save"}
          </button>
          <button
            onClick={handleCancel}
            disabled={saving}
            className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
