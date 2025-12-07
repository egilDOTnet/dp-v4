"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { api, User, Project } from "@/lib/api";

export default function ProjectMembersPage() {
  const { user: _user } = useAuth();
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const projectId = params.id as string;
  const isEditMode = searchParams.get("edit") === "true";

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
  const [showHeroBanner, setShowHeroBanner] = useState(true);

  // Load project and company users
  useEffect(() => {
    if (!projectId) return;

    Promise.all([
      api.projects.get(projectId),
      api.users.getCompanyUsers(),
    ])
      .then(([projectData, users]) => {
        setProject(projectData);
        // In edit mode, pre-select current members
        if (isEditMode && projectData.members) {
          const currentMemberIds = projectData.members.map((m) => m.id);
          setSelectedMemberIds(currentMemberIds);
          // In edit mode, show all users (including current members) so they can be deselected
          setAvailableUsers(users);
        } else {
          // In create mode, exclude current project members from available users
          const projectMemberIds = projectData.members?.map((m) => m.id) || [];
          setAvailableUsers(users.filter((u) => !projectMemberIds.includes(u.id)));
        }
      })
      .catch((err) => {
        console.error("Failed to load data:", err);
        setError(err.message || "Failed to load data");
      });
  }, [projectId, isEditMode]);

  useEffect(() => {
    // Check if user has dismissed the hero banner before
    const dismissed = localStorage.getItem("members-hero-banner-dismissed");
    if (dismissed === "true") {
      setShowHeroBanner(false);
    }
  }, []);

  const handleDismissHeroBanner = () => {
    localStorage.setItem("members-hero-banner-dismissed", "true");
    setShowHeroBanner(false);
  };

  const handleToggleMember = (userId: string) => {
    if (selectedMemberIds.includes(userId)) {
      // Check if we're trying to deselect the last admin
      if (isEditMode && project) {
        const allUsers = [...availableUsers, ...newMembers];
        const userToDeselect = allUsers.find((u) => u.id === userId);
        const isAdmin =
          userToDeselect?.role === "CompanyAdministrator" ||
          userToDeselect?.role === "GlobalAdministrator";

        if (isAdmin) {
          // Count how many admins would remain after deselection
          const remainingAdmins = selectedMemberIds
            .filter((id) => id !== userId)
            .map((id) => allUsers.find((u) => u.id === id))
            .filter(
              (u) =>
                u?.role === "CompanyAdministrator" || u?.role === "GlobalAdministrator"
            );

          if (remainingAdmins.length === 0) {
            setError(
              "Cannot remove the last company administrator from the project. A project must have at least one administrator."
            );
            return;
          }
        }
      }
      setSelectedMemberIds(selectedMemberIds.filter((id) => id !== userId));
      setError(""); // Clear error if validation passes
    } else {
      setSelectedMemberIds([...selectedMemberIds, userId]);
      setError(""); // Clear error when adding members
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
    setSubmitting(true);
    setError("");

    try {
      if (isEditMode && project) {
        // In edit mode, we need to sync the member list
        const currentMemberIds = project.members?.map((m) => m.id) || [];
        const membersToAdd = selectedMemberIds.filter((id) => !currentMemberIds.includes(id));
        const membersToRemove = currentMemberIds.filter((id) => !selectedMemberIds.includes(id));

        // Add new members
        if (membersToAdd.length > 0) {
          await api.projects.addMembers(projectId, membersToAdd);
        }

        // Remove members
        if (membersToRemove.length > 0) {
          await api.projects.removeMembers(projectId, membersToRemove);
        }

        // Reload project to get updated member list
        const updatedProject = await api.projects.get(projectId);
        setProject(updatedProject);
      } else {
        // Create mode - add selected members
        if (selectedMemberIds.length > 0) {
          await api.projects.addMembers(projectId, selectedMemberIds);
        }
      }

      // Navigate back to manage project page
      router.push(`/projects/${projectId}/manage`);
    } catch (err: any) {
      setError(err.message || "Failed to update members");
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
      {/* Breadcrumb Navigation */}
      <nav className="mb-4 text-sm text-gray-600">
        <Link href="/dashboard" className="hover:text-primary-600">
          Dashboard
        </Link>
        <span className="mx-2">/</span>
        <Link href="/projects" className="hover:text-primary-600">
          Projects
        </Link>
        <span className="mx-2">/</span>
        <Link href={`/projects/${projectId}`} className="hover:text-primary-600">
          {project.name}
        </Link>
        <span className="mx-2">/</span>
        <span className="text-gray-900">Members</span>
      </nav>

      <h1 className="text-3xl font-bold mb-2">
        {isEditMode ? "Edit Members" : "Add Members"} to {project.name}
      </h1>
      <p className="text-gray-600 mb-6">
        {isEditMode
          ? "Select or deselect members to update the project membership."
          : "Select existing members or create new ones to add to the project."}
      </p>

      {/* Hero Banner */}
      {showHeroBanner && (
        <div className="mb-6 bg-gradient-to-r from-primary-50 to-blue-50 border border-primary-200 rounded-lg p-6 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-12 h-12 bg-primary-600 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Welcome to Member Management</h3>
              <p className="text-gray-700 mb-3">
                Managing your <strong>project team</strong> ensures the right people have access to project information and can contribute to the procurement process effectively.
              </p>
              <p className="text-gray-700 mb-3">
                <strong>Here's what you can do:</strong>
              </p>
              <ul className="list-disc list-inside text-gray-700 space-y-1 mb-4 ml-2">
                <li><strong>Add existing users:</strong> Select from your company's user list to add to the project</li>
                <li><strong>Create new team members:</strong> Invite new users to your company and project</li>
                <li><strong>Control project access:</strong> Determine who can view and contribute to project activities</li>
                <li><strong>Manage permissions:</strong> Company administrators have full project management rights</li>
              </ul>
              <div className="bg-white/60 border border-primary-300 rounded-md p-3 shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="text-3xl flex-shrink-0">💡</div>
                  <div className="flex-1 text-sm text-gray-700 italic">
                    <div className="font-bold not-italic mb-1">Tip:</div>
                    <div>Include all stakeholders who need visibility into the procurement process!</div>
                    <div>Team members can be assigned as task owners and collaborate effectively.</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="flex justify-end mt-4">
            <button
              onClick={handleDismissHeroBanner}
              className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors shadow-sm"
            >
              Understood
            </button>
          </div>
        </div>
      )}

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
            {submitting
              ? isEditMode
                ? "Saving Changes..."
                : "Adding Members..."
              : isEditMode
                ? "Save Changes"
                : "Finish"}
          </button>
          {!isEditMode && (
            <button
              type="button"
              onClick={() => router.push(`/projects/${projectId}`)}
              className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Skip
            </button>
          )}
          {isEditMode && (
            <button
              type="button"
              onClick={() => router.push(`/projects/${projectId}`)}
              className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

