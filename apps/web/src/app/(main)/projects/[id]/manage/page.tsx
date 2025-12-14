"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { api, Project, User } from "@/lib/api";
import { HeroBanner, Tabs, TabsList, TabsTrigger, TabsContent, SearchBar, LoadingSpinner, Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, Button } from "@/components/ui";
import { ImportWizard } from "@/components/ImportWizard";
import { GraphicsUpload } from "@/components/GraphicsUpload";
import { useSearch } from "@/hooks/useSearch";

export default function ManageProjectPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const projectId = params.id as string;
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showImportWizard, setShowImportWizard] = useState(false);
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const [newMemberForm, setNewMemberForm] = useState({
    email: "",
    firstName: "",
    lastName: "",
  });
  const [addingMember, setAddingMember] = useState(false);
  const [showAddMemberForm, setShowAddMemberForm] = useState(false);

  const isAdmin =
    user?.role === "CompanyAdministrator" || user?.role === "GlobalAdministrator";

  // Prepopulate start date with current date
  const getCurrentDate = () => {
    const today = new Date();
    return today.toISOString().split("T")[0];
  };

  const [formData, setFormData] = useState({
    name: "",
    type: "",
    startDate: getCurrentDate(),
    endDate: "",
  });

  // Search for members
  const { searchTerm, setSearchTerm, filteredItems: filteredMembers, clearSearch, isSearching } = useSearch(
    project?.members || [],
    {
      searchKeys: ["firstName", "lastName", "name", "email"],
    }
  );

  const displayMembers = isSearching ? filteredMembers : (project?.members || []);

  useEffect(() => {
    if (!isAdmin) {
      router.push(`/projects/${projectId}`);
      return;
    }

    Promise.all([
      api.projects.get(projectId),
      api.users.getCompanyUsers(),
    ])
      .then(([projectData, users]) => {
        setProject(projectData);
        setAvailableUsers(users);
        setFormData({
          name: projectData.name,
          type: projectData.type || "",
          startDate: projectData.startDate
            ? new Date(projectData.startDate).toISOString().split("T")[0]
            : getCurrentDate(),
          endDate: projectData.endDate
            ? new Date(projectData.endDate).toISOString().split("T")[0]
            : "",
        });
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || "Failed to load project");
        setLoading(false);
      });
  }, [projectId, isAdmin, router]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    setSaving(true);

    try {
      const updatedProject = await api.projects.update(projectId, {
        name: formData.name,
        type: formData.type || null,
        startDate: formData.startDate || null,
        endDate: formData.endDate || null,
      });
      setProject(updatedProject);
      setSaving(false);
      // Redirect back to project dashboard
      router.push(`/projects/${projectId}`);
    } catch (err: any) {
      setFormError(err.message || "Failed to update project");
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await api.projects.delete(projectId);
      router.push("/dashboard");
    } catch (err: any) {
      setFormError(err.message || "Failed to delete project");
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };


  const handleRemoveMember = async (memberId: string) => {
    if (!confirm("Are you sure you want to remove this member from the project?")) {
      return;
    }

    try {
      await api.projects.removeMembers(projectId, [memberId]);
      const [updatedProject, updatedUsers] = await Promise.all([
        api.projects.get(projectId),
        api.users.getCompanyUsers(),
      ]);
      setProject(updatedProject);
      setAvailableUsers(updatedUsers);
    } catch (err: any) {
      setFormError(err.message || "Failed to remove member");
    }
  };

  if (loading) {
    return (
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">Loading project...</p>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="text-center">
        <p className="text-red-600">{error || "Project not found"}</p>
      </div>
    );
  }

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
        <span className="text-gray-900">Manage</span>
      </nav>

      <h1 className="text-3xl font-bold mb-6">Manage Project</h1>

      {/* Hero Banner */}
      <HeroBanner
        storageKey="manage-hero-banner"
        title="Welcome to Project Management"
        description={
          <>
            This section provides <strong>administrative controls</strong> for your project. Here you can update project information, manage team members, and maintain overall project settings.
          </>
        }
        features={[
          {
            label: "Edit project details",
            description: "Update project name, type, and description",
          },
          {
            label: "Manage dates",
            description: "Set and adjust project start and end dates",
          },
          {
            label: "Team management",
            description: "Add or remove project members and control access",
          },
          {
            label: "View project information",
            description: "See a complete overview of your project setup",
          },
        ]}
        tip={
          <>
            <div className="font-bold not-italic mb-1">Tip:</div>
            <div>Keep project dates updated to help with deadline planning!</div>
            <div>Accurate dates ensure your team knows when key milestones are approaching.</div>
          </>
        }
      />

      <Tabs defaultValue="details" className="mt-6">
        <TabsList>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="graphics">Graphics</TabsTrigger>
          <TabsTrigger value="import-export">Import/Export</TabsTrigger>
          <TabsTrigger value="members">Members</TabsTrigger>
        </TabsList>

        <TabsContent value="details">
          <div className="space-y-6">
            <div className="bg-background-secondary rounded-lg shadow-md p-6">
              <h2 className="text-2xl font-semibold mb-4">Project Details</h2>
              <form onSubmit={handleSave} className="space-y-4">
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
                    <label
                      htmlFor="startDate"
                      className="block text-sm font-medium text-gray-700 mb-1"
                    >
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
                    <label
                      htmlFor="endDate"
                      className="block text-sm font-medium text-gray-700 mb-1"
                    >
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

                {formError && <p className="text-sm text-red-600">{formError}</p>}

                <div className="flex gap-2 pt-4">
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50"
                  >
                    {saving ? "Saving..." : "Save Changes"}
                  </button>
                  <Link
                    href={`/projects/${projectId}`}
                    className="px-4 py-2 border border-gray-300 rounded-md hover:bg-background-primary inline-flex items-center"
                  >
                    Cancel
                  </Link>
                </div>
              </form>
            </div>

            {/* Danger Zone */}
            <div className="bg-red-50 border border-red-200 rounded-lg shadow-md p-6">
              <h2 className="text-2xl font-semibold text-red-900 mb-4">Danger Zone</h2>
              <p className="text-gray-700 mb-4">
                Deleting this project will permanently remove all associated data including phases, tasks,
                requirements, and vendor information. This action cannot be undone.
              </p>
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                disabled={deleting}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
              >
                Delete Project
              </button>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="members">
          <div className="space-y-6">
            {/* Search Bar and Add Button */}
            <div className="flex items-center gap-4">
              <div className="flex-1 max-w-md">
                <SearchBar
                  value={searchTerm}
                  onChange={setSearchTerm}
                  onClear={clearSearch}
                  placeholder="Search members..."
                />
              </div>
              {isSearching && (
                <span className="text-sm text-text-secondary">
                  {displayMembers.length} of {project.members?.length || 0} members
                </span>
              )}
              <button
                onClick={() => setShowAddMemberForm(true)}
                disabled={showAddMemberForm}
                className="ml-auto px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 text-sm font-medium flex items-center gap-1 transition-colors disabled:opacity-50"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                Add Member
              </button>
            </div>

            {/* Members List */}
            <div className="bg-background-secondary rounded-lg shadow-md p-6">
              <h2 className="text-xl font-semibold mb-4">Project Members</h2>
              {displayMembers.length === 0 && !showAddMemberForm ? (
                <p className="text-text-secondary italic">No members found</p>
              ) : (
                <div className="space-y-2">
                  {/* Inline Add Member Form */}
                  {showAddMemberForm && (
                    <div className="border-2 border-primary-500 rounded-lg bg-background-secondary animate-in fade-in slide-in-from-top-2 duration-200">
                      <div className="px-4 py-3 bg-background-tertiary">
                        <form
                          onSubmit={async (e) => {
                            e.preventDefault();
                            if (!newMemberForm.email || !newMemberForm.firstName || !newMemberForm.lastName) {
                              setFormError("All fields are required");
                              return;
                            }
                            setAddingMember(true);
                            setFormError("");
                            try {
                              // Check if user exists, if not create
                              let userToAdd: User;
                              const existingUser = availableUsers.find(u => u.email === newMemberForm.email);
                              if (existingUser) {
                                userToAdd = existingUser;
                              } else {
                                userToAdd = await api.users.create({
                                  email: newMemberForm.email,
                                  firstName: newMemberForm.firstName,
                                  lastName: newMemberForm.lastName,
                                });
                              }
                              
                              await api.projects.addMembers(projectId, [userToAdd.id]);
                              
                              // Reload project and available users
                              const [updatedProject, updatedUsers] = await Promise.all([
                                api.projects.get(projectId),
                                api.users.getCompanyUsers(),
                              ]);
                              setProject(updatedProject);
                              setAvailableUsers(updatedUsers);
                              
                              setNewMemberForm({ email: "", firstName: "", lastName: "" });
                              setShowAddMemberForm(false);
                              setFormError("");
                            } catch (err: any) {
                              setFormError(err.message || "Failed to add member");
                            } finally {
                              setAddingMember(false);
                            }
                          }}
                          className="space-y-3"
                        >
                          <div className="grid grid-cols-3 gap-3">
                            <div>
                              <label className="block text-sm font-medium text-text-primary mb-1">
                                Email *
                              </label>
                              <input
                                type="email"
                                value={newMemberForm.email}
                                onChange={(e) => setNewMemberForm({ ...newMemberForm, email: e.target.value })}
                                required
                                className="w-full px-3 py-2 border border-border-primary rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                                placeholder="email@example.com"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-text-primary mb-1">
                                First Name *
                              </label>
                              <input
                                type="text"
                                value={newMemberForm.firstName}
                                onChange={(e) => setNewMemberForm({ ...newMemberForm, firstName: e.target.value })}
                                required
                                className="w-full px-3 py-2 border border-border-primary rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-text-primary mb-1">
                                Last Name *
                              </label>
                              <input
                                type="text"
                                value={newMemberForm.lastName}
                                onChange={(e) => setNewMemberForm({ ...newMemberForm, lastName: e.target.value })}
                                required
                                className="w-full px-3 py-2 border border-border-primary rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                              />
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="submit"
                              disabled={addingMember}
                              className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50 text-sm"
                            >
                              {addingMember ? "Adding..." : "Add"}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setShowAddMemberForm(false);
                                setNewMemberForm({ email: "", firstName: "", lastName: "" });
                                setFormError("");
                              }}
                              className="px-4 py-2 border border-border-primary rounded-md hover:bg-background-primary text-sm"
                            >
                              Cancel
                            </button>
                            {formError && (
                              <span className="text-sm text-red-600">{formError}</span>
                            )}
                          </div>
                        </form>
                      </div>
                    </div>
                  )}

                  {/* Add Member from Company Users */}
                  {showAddMemberForm && (() => {
                    const availableCompanyUsers = availableUsers.filter(u => !project.members?.some(m => m.id === u.id));
                    return availableCompanyUsers.length > 0;
                  })() && (
                    <div className="border-2 border-primary-500 rounded-lg bg-background-secondary animate-in fade-in slide-in-from-top-2 duration-200">
                      <div className="px-4 py-3 bg-background-tertiary">
                        <form
                          onSubmit={async (e) => {
                            e.preventDefault();
                            const select = e.currentTarget.querySelector('select') as HTMLSelectElement;
                            const userId = select.value;
                            if (!userId) {
                              setFormError("Please select a user");
                              return;
                            }
                            setAddingMember(true);
                            setFormError("");
                            try {
                              await api.projects.addMembers(projectId, [userId]);
                              
                              // Reload project and available users
                              const [updatedProject, updatedUsers] = await Promise.all([
                                api.projects.get(projectId),
                                api.users.getCompanyUsers(),
                              ]);
                              setProject(updatedProject);
                              setAvailableUsers(updatedUsers);
                              
                              setShowAddMemberForm(false);
                              setFormError("");
                            } catch (err: any) {
                              setFormError(err.message || "Failed to add member");
                            } finally {
                              setAddingMember(false);
                            }
                          }}
                          className="space-y-3"
                        >
                          <div>
                            <label className="block text-sm font-medium text-text-primary mb-1">
                              Select from Company Users
                            </label>
                            <select
                              required
                              className="w-full px-3 py-2 border border-border-primary rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                              defaultValue=""
                            >
                              <option value="">Select a user...</option>
                              {availableUsers
                                .filter(u => !project.members?.some(m => m.id === u.id))
                                .map((user) => {
                                  const displayName =
                                    user.firstName && user.lastName
                                      ? `${user.firstName} ${user.lastName}`
                                      : user.firstName || user.lastName || user.name || user.email;
                                  return (
                                    <option key={user.id} value={user.id}>
                                      {displayName} ({user.email}) - {user.role}
                                    </option>
                                  );
                                })}
                            </select>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="submit"
                              disabled={addingMember}
                              className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50 text-sm"
                            >
                              {addingMember ? "Adding..." : "Add"}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setShowAddMemberForm(false);
                                setFormError("");
                              }}
                              className="px-4 py-2 border border-border-primary rounded-md hover:bg-background-primary text-sm"
                            >
                              Cancel
                            </button>
                            {formError && (
                              <span className="text-sm text-red-600">{formError}</span>
                            )}
                          </div>
                        </form>
                      </div>
                    </div>
                  )}

                  {/* Existing Members */}
                  {displayMembers.map((member) => {
                    const displayName =
                      member.firstName && member.lastName
                        ? `${member.firstName} ${member.lastName}`
                        : member.firstName || member.lastName || member.name || member.email;
                    // Find full user object to get role
                    const fullUser = availableUsers.find(u => u.id === member.id);
                    const role = fullUser?.role || "User";
                    return (
                      <div
                        key={member.id}
                        className="border-2 border-primary-500 rounded-lg bg-background-secondary"
                      >
                        <div className="flex items-center justify-between px-4 py-3 bg-background-tertiary">
                          <div className="flex items-center space-x-3">
                            <span className="w-2 h-2 bg-primary-600 rounded-full"></span>
                            <div>
                              <span className="font-medium text-text-primary">{displayName}</span>
                              <span className="text-text-secondary text-sm ml-2">({member.email})</span>
                              <span className="text-text-tertiary text-sm ml-2">- {role}</span>
                            </div>
                          </div>
                          <button
                            onClick={() => handleRemoveMember(member.id)}
                            className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="graphics">
          <div className="space-y-6">
            {/* Logo Section */}
            <div className="bg-background-secondary rounded-lg shadow-md p-6">
              <h2 className="text-2xl font-semibold mb-4">Logo</h2>
              <p className="text-text-secondary mb-4">
                Upload a logo image for your project. Accepted formats: JPG, GIF, SVG, PNG (PNG recommended).
                Maximum size: 500×500 pixels. For bitmap formats, you can select the portion of the image to use.
              </p>
              <GraphicsUpload
                type="logo"
                currentImage={project.logoData ? `data:${project.logoFileType || "image/png"};base64,${project.logoData}` : null}
                currentFileName={project.logoFileName || null}
                onUpload={async (data, fileName, fileType) => {
                  try {
                    // Extract base64 data (remove data URL prefix if present)
                    // data URL format: "data:image/png;base64,<base64string>"
                    let base64Data = data;
                    if (data.startsWith("data:")) {
                      const commaIndex = data.indexOf(",");
                      if (commaIndex !== -1) {
                        base64Data = data.substring(commaIndex + 1);
                      }
                    }
                    
                    // Validate base64 data is not empty
                    if (!base64Data || base64Data.trim().length === 0) {
                      throw new Error("Invalid image data");
                    }
                    
                    const updateResponse = await api.projects.updateGraphics(projectId, {
                      logoData: base64Data.trim(),
                      logoFileName: fileName,
                      logoFileType: fileType,
                    });
                    
                    // The update response should contain the logo data
                    // Merge with existing project data to preserve members and other fields
                    setProject((prev) => prev ? { ...prev, ...updateResponse } : updateResponse);
                  } catch (err: any) {
                    const errorMessage = err.message || "Failed to upload logo";
                    setFormError(errorMessage);
                    console.error("Logo upload error:", err);
                    throw err;
                  }
                }}
                onDelete={async () => {
                  await api.projects.deleteLogo(projectId);
                  const updatedProject = await api.projects.get(projectId);
                  setProject(updatedProject);
                }}
                projectId={projectId}
              />
            </div>

            {/* Banner Section */}
            <div className="bg-background-secondary rounded-lg shadow-md p-6">
              <h2 className="text-2xl font-semibold mb-4">Banner</h2>
              <p className="text-text-secondary mb-4">
                Upload a banner image for your project. Accepted formats: JPG, PNG.
                Maximum size: 2000×2000 pixels. The selected portion will be resized to 1200×300 pixels.
              </p>
              <GraphicsUpload
                type="banner"
                currentImage={project.bannerData ? `data:${project.bannerFileType || "image/png"};base64,${project.bannerData}` : null}
                currentFileName={project.bannerFileName || null}
                onUpload={async (data, fileName, fileType) => {
                  try {
                    // Extract base64 data (remove data URL prefix if present)
                    // data URL format: "data:image/png;base64,<base64string>"
                    let base64Data = data;
                    if (data.startsWith("data:")) {
                      const commaIndex = data.indexOf(",");
                      if (commaIndex !== -1) {
                        base64Data = data.substring(commaIndex + 1);
                      }
                    }
                    
                    // Validate base64 data is not empty
                    if (!base64Data || base64Data.trim().length === 0) {
                      throw new Error("Invalid image data");
                    }
                    
                    const updateResponse = await api.projects.updateGraphics(projectId, {
                      bannerData: base64Data.trim(),
                      bannerFileName: fileName,
                      bannerFileType: fileType,
                    });
                    
                    // The update response should contain the banner data
                    // Merge with existing project data to preserve members and other fields
                    setProject((prev) => prev ? { ...prev, ...updateResponse } : updateResponse);
                  } catch (err: any) {
                    const errorMessage = err.message || "Failed to upload banner";
                    setFormError(errorMessage);
                    console.error("Banner upload error:", err);
                    throw err;
                  }
                }}
                onDelete={async () => {
                  await api.projects.deleteBanner(projectId);
                  const updatedProject = await api.projects.get(projectId);
                  setProject(updatedProject);
                }}
                projectId={projectId}
              />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="import-export">
          <div className="space-y-6">
            <div className="bg-background-secondary rounded-lg shadow-md p-6">
              <h2 className="text-2xl font-semibold mb-4">Import Data</h2>
              <p className="text-text-secondary mb-4">
                Import Tasks, RFI Questionnaires, or Requirements + Hierarchy from CSV files.
              </p>
              <button
                onClick={() => setShowImportWizard(true)}
                className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700"
              >
                Start Import
              </button>
            </div>

            <div className="bg-background-secondary rounded-lg shadow-md p-6">
              <h2 className="text-2xl font-semibold mb-4">Export Data</h2>
              <p className="text-text-secondary">
                Export functionality coming soon.
              </p>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && (
        <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Project</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete "{project.name}"? This action cannot be undone and
                will delete all associated phases and tasks.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="ghost"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? "Deleting..." : "Delete"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}


      {/* Import Wizard */}
      <ImportWizard
        projectId={projectId}
        open={showImportWizard}
        onOpenChange={setShowImportWizard}
      />
    </div>
  );
}
