"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { api, User } from "@/lib/api";

export default function ProfilePage() {
  const { user: authUser, refreshUser } = useAuth();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!authUser) return;

    api.users
      .getProfile()
      .then((data) => {
        setUser(data);
        setName(data.name || "");
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
      const updated = await api.users.updateProfile({
        name: name || undefined,
        companyName: isAdmin ? companyName || undefined : undefined,
      });
      setUser(updated);
      setEditing(false);
      await refreshUser();
    } catch (err: any) {
      setError(err.message || "Failed to update profile");
    } finally {
      setSaving(false);
    }
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

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
          {editing ? (
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          ) : (
            <input
              type="text"
              value={user.name || ""}
              disabled
              className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50"
            />
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Company Name</label>
          {editing && isAdmin ? (
            <input
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          ) : (
            <input
              type="text"
              value={user.companyName || ""}
              disabled
              className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50"
            />
          )}
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
          {editing ? (
            <>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save"}
              </button>
              <button
                onClick={() => {
                  setEditing(false);
                  setName(user.name || "");
                  setCompanyName(user.companyName || "");
                  setError("");
                }}
                className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              onClick={() => setEditing(true)}
              className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700"
            >
              Edit
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

