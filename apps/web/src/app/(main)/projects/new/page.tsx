"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";

export default function NewProjectPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [formData, setFormData] = useState({
    name: "",
    type: "",
    startDate: "",
    endDate: "",
  });
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [availableUsers, setAvailableUsers] = useState<Array<{ id: string; email: string; name: string | null; firstName: string | null; lastName: string | null }>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Load company users for member selection
  useEffect(() => {
    if (user && (user.role === "CompanyAdministrator" || user.role === "GlobalAdministrator")) {
      api.users
        .getCompanyUsers()
        .then((users) => {
          setAvailableUsers(users);
        })
        .catch((err) => {
          console.error("Failed to load users:", err);
        });
    }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const project = await api.projects.create({
        name: formData.name,
        type: formData.type || undefined,
        startDate: formData.startDate || undefined,
        endDate: formData.endDate || undefined,
        memberIds: memberIds.length > 0 ? memberIds : undefined,
      });
      router.push(`/projects/${project.id}`);
    } catch (err: any) {
      setError(err.message || "Failed to create project");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl">
      <h1 className="text-3xl font-bold mb-6">Create New Project</h1>

      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-md p-6 space-y-4">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
            Project Name *
          </label>
          <input
            id="name"
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>

        <div>
          <label htmlFor="type" className="block text-sm font-medium text-gray-700 mb-1">
            Type
          </label>
          <input
            id="type"
            type="text"
            value={formData.type}
            onChange={(e) => setFormData({ ...formData, type: e.target.value })}
            placeholder="e.g., CRM system"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="startDate" className="block text-sm font-medium text-gray-700 mb-1">
              Start Date
            </label>
            <input
              id="startDate"
              type="date"
              value={formData.startDate}
              onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div>
            <label htmlFor="endDate" className="block text-sm font-medium text-gray-700 mb-1">
              End Date
            </label>
            <input
              id="endDate"
              type="date"
              value={formData.endDate}
              onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>

        {availableUsers.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Members</label>
            <div className="space-y-2 max-h-48 overflow-y-auto border border-gray-300 rounded-md p-2">
              {availableUsers.map((user) => (
                <label key={user.id} className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={memberIds.includes(user.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setMemberIds([...memberIds, user.id]);
                      } else {
                        setMemberIds(memberIds.filter((id) => id !== user.id));
                      }
                    }}
                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  <span className="text-sm">
                    {(() => {
                      const displayName = user.firstName && user.lastName
                        ? `${user.firstName} ${user.lastName}`
                        : user.firstName || user.lastName || user.name || user.email;
                      return displayName !== user.email ? `${displayName} (${user.email})` : displayName;
                    })()}
                  </span>
                </label>
              ))}
            </div>
          </div>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex gap-2 pt-4">
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50"
          >
            {loading ? "Creating..." : "Create Project"}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

