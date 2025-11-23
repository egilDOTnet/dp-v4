"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { api, User, Project } from "@/lib/api";

export default function ProjectMembersPage() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useParams();
  const projectId = params.id as string;

  const [project, setProject] = useState<Project | null>(null);
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [newMemberForm, setNewMemberForm] = useState({
    email: "",
    firstName: "",
    lastName: "",
  });
  const [newMembers, setNewMembers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Load project and company users
  useEffect(() => {
    if (!projectId) return;

    Promise.all([
      api.projects.get(projectId),
      api.users.getCompanyUsers(),
    ])
      .then(([projectData, users]) => {
        setProject(projectData);
        // Exclude current project members from available users
        const projectMemberIds = projectData.members?.map((m) => m.id) || [];
        setAvailableUsers(users.filter((u) => !projectMemberIds.includes(u.id)));
      })
      .catch((err) => {
        console.error("Failed to load data:", err);
        setError(err.message || "Failed to load data");
      });
  }, [projectId]);

  const handleToggleMember = (userId: string) => {
    if (selectedMemberIds.includes(userId)) {
      setSelectedMemberIds(selectedMemberIds.filter((id) => id !== userId));
    } else {
      setSelectedMemberIds([...selectedMemberIds, userId]);
    }
  };

  const handleAddNewMember = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!newMemberForm.email || !newMemberForm.firstName || !newMemberForm.lastName) {
      setError("All fields are required");
      return;
    }

    setLoading(true);
    try {
      const newUser = await api.users.create({
        email: newMemberForm.email,
        firstName: newMemberForm.firstName,
        lastName: newMemberForm.lastName,
      });
      setNewMembers([...newMembers, newUser]);
      setSelectedMemberIds([...selectedMemberIds, newUser.id]);
      setNewMemberForm({ email: "", firstName: "", lastName: "" });
      setError("");
    } catch (err: any) {
      setError(err.message || "Failed to create user");
    } finally {
      setLoading(false);
    }
  };

  const handleFinish = async () => {
    if (selectedMemberIds.length === 0) {
      // No members to add, just navigate to project
      router.push(`/projects/${projectId}`);
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      // Add all selected members to the project
      await api.projects.addMembers(projectId, selectedMemberIds);
      
      // Navigate to project detail page
      router.push(`/projects/${projectId}`);
    } catch (err: any) {
      setError(err.message || "Failed to add members");
      setSubmitting(false);
    }
  };

  if (!project) {
    return (
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">Loading...</p>
      </div>
    );
  }

  const allAvailableUsers = [...availableUsers, ...newMembers];
  const selectedMembers = allAvailableUsers.filter((u) => selectedMemberIds.includes(u.id));

  return (
    <div className="max-w-4xl">
      <h1 className="text-3xl font-bold mb-2">Add Members to {project.name}</h1>
      <p className="text-gray-600 mb-6">Select existing members or create new ones to add to the project.</p>

      <div className="space-y-6">
        {/* Existing Members List */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4">Company Members</h2>
          {allAvailableUsers.length === 0 ? (
            <p className="text-gray-500">No other members available in your company.</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto border border-gray-300 rounded-md p-4">
              {allAvailableUsers.map((member) => {
                const displayName = member.firstName && member.lastName
                  ? `${member.firstName} ${member.lastName}`
                  : member.firstName || member.lastName || member.name || member.email;
                return (
                  <label
                    key={member.id}
                    className="flex items-center space-x-3 cursor-pointer hover:bg-gray-50 p-2 rounded"
                  >
                    <input
                      type="checkbox"
                      checked={selectedMemberIds.includes(member.id)}
                      onChange={() => handleToggleMember(member.id)}
                      className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                    <div className="flex-1">
                      <span className="text-sm font-medium text-gray-900">{displayName}</span>
                      <span className="text-sm text-gray-500 ml-2">({member.email})</span>
                    </div>
                  </label>
                );
              })}
            </div>
          )}
        </div>

        {/* Create New Member Form */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4">Create New Member</h2>
          <form onSubmit={handleAddNewMember} className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                  Email *
                </label>
                <input
                  id="email"
                  type="email"
                  value={newMemberForm.email}
                  onChange={(e) => setNewMemberForm({ ...newMemberForm, email: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-1">
                  First Name *
                </label>
                <input
                  id="firstName"
                  type="text"
                  value={newMemberForm.firstName}
                  onChange={(e) => setNewMemberForm({ ...newMemberForm, firstName: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-1">
                  Last Name *
                </label>
                <input
                  id="lastName"
                  type="text"
                  value={newMemberForm.lastName}
                  onChange={(e) => setNewMemberForm({ ...newMemberForm, lastName: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50"
            >
              {loading ? "Adding..." : "Add Member"}
            </button>
          </form>
        </div>

        {/* Selected Members Summary */}
        {selectedMembers.length > 0 && (
          <div className="bg-blue-50 rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4">Selected Members ({selectedMembers.length})</h2>
            <ul className="space-y-2">
              {selectedMembers.map((member) => {
                const displayName = member.firstName && member.lastName
                  ? `${member.firstName} ${member.lastName}`
                  : member.firstName || member.lastName || member.name || member.email;
                return (
                  <li key={member.id} className="text-sm text-gray-700">
                    {displayName} ({member.email})
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex gap-2 pt-4">
          <button
            onClick={handleFinish}
            disabled={submitting}
            className="px-6 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50"
          >
            {submitting ? "Adding Members..." : "Finish"}
          </button>
          <button
            type="button"
            onClick={() => router.push(`/projects/${projectId}`)}
            className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Skip
          </button>
        </div>
      </div>
    </div>
  );
}

