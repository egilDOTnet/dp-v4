"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  api,
  Project,
  ProjectVendor,
  VendorStatus,
} from "@/lib/api";
import VendorList from "@/components/VendorList";

export default function VendorsPage() {
  const params = useParams();
  const projectId = params.id as string;
  const [project, setProject] = useState<Project | null>(null);
  const [vendors, setVendors] = useState<ProjectVendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showAddVendorForm, setShowAddVendorForm] = useState(false);
  const [showHeroBanner, setShowHeroBanner] = useState(true);

  const loadProject = async () => {
    try {
      const projectData = await api.projects.get(projectId);
      setProject(projectData);
    } catch (err: any) {
      setError(err.message || "Failed to load project");
    }
  };

  const loadVendors = async () => {
    try {
      const vendorsData = await api.projects.vendors.list(projectId);
      setVendors(vendorsData);
      setError("");
    } catch (err: any) {
      setError(err.message || "Failed to load vendors");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (projectId) {
      loadProject();
      loadVendors();
    }
  }, [projectId]);

  useEffect(() => {
    // Check if user has dismissed the hero banner before
    const dismissed = localStorage.getItem("vendors-hero-banner-dismissed");
    if (dismissed === "true") {
      setShowHeroBanner(false);
    }
  }, []);

  const handleDismissHeroBanner = () => {
    localStorage.setItem("vendors-hero-banner-dismissed", "true");
    setShowHeroBanner(false);
  };

  const handleAddVendor = async (data: {
    name: string;
    organizationNumber?: string;
    emailDomain?: string;
    additionalData?: any;
    status?: VendorStatus;
  }) => {
    try {
      await api.projects.vendors.create(projectId, data);
      await loadVendors();
    } catch (error: any) {
      // Re-throw error so VendorForm can display it
      throw error;
    }
  };

  const handleUpdateVendor = async (vendorId: string, data: {
    name: string;
    organizationNumber?: string;
    emailDomain?: string;
    additionalData?: any;
    status?: VendorStatus;
  }) => {
    try {
      // Update vendor details if provided
      const vendor = vendors.find((pv) => pv.vendor.id === vendorId);
      if (vendor) {
        const hasDetailsChanged =
          data.name !== vendor.vendor.name ||
          data.organizationNumber !== (vendor.vendor.organizationNumber || undefined) ||
          data.emailDomain !== (vendor.vendor.emailDomain || undefined);

        if (hasDetailsChanged) {
          await api.projects.vendors.updateDetails(projectId, vendorId, {
            name: data.name,
            organizationNumber: data.organizationNumber,
            emailDomain: data.emailDomain,
            additionalData: data.additionalData,
          });
        }

        // Update status if it changed
        if (data.status && data.status !== vendor.status) {
          await api.projects.vendors.update(projectId, vendorId, {
            status: data.status,
          });
        }
      }

      await loadVendors();
    } catch (error: any) {
      // Re-throw error so VendorForm can display it
      throw error;
    }
  };

  const handleStatusChange = async (vendorId: string, status: VendorStatus) => {
    await api.projects.vendors.update(projectId, vendorId, { status });
    await loadVendors();
  };

  const handleDeleteVendor = async (vendorId: string) => {
    if (!confirm("Are you sure you want to remove this vendor from the project?")) {
      return;
    }
    await api.projects.vendors.delete(projectId, vendorId);
    await loadVendors();
  };

  const handleAddContact = async (vendorId: string, data: {
    firstName: string;
    lastName: string;
    email: string;
    isMainContact?: boolean;
  }) => {
    await api.projects.vendors.contacts.create(projectId, vendorId, data);
    await loadVendors();
  };

  const handleEditContact = async (vendorId: string, contactId: string, data: {
    firstName: string;
    lastName: string;
    email: string;
    isMainContact?: boolean;
  }) => {
    await api.projects.vendors.contacts.update(projectId, vendorId, contactId, data);
    await loadVendors();
  };

  const handleDeleteContact = async (vendorId: string, contactId: string) => {
    await api.projects.vendors.contacts.delete(projectId, vendorId, contactId);
    await loadVendors();
  };

  if (loading) {
    return (
      <div>
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
            {project?.name || "Project"}
          </Link>
          <span className="mx-2">/</span>
          <span className="text-gray-900">Vendors</span>
        </nav>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading vendors...</p>
        </div>
      </div>
    );
  }

  if (error && vendors.length === 0) {
    return (
      <div>
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
            {project?.name || "Project"}
          </Link>
          <span className="mx-2">/</span>
          <span className="text-gray-900">Vendors</span>
        </nav>
        <div className="text-center">
          <p className="text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div>
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
          {project?.name || "Project"}
        </Link>
        <span className="mx-2">/</span>
        <span className="text-gray-900">Vendors</span>
      </nav>

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Vendors</h1>
        <button
          onClick={() => setShowAddVendorForm(true)}
          className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700"
        >
          Add Vendor
        </button>
      </div>

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
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Welcome to Vendor Management</h3>
              <p className="text-gray-700 mb-3">
                Building a comprehensive list of <strong>potential vendors</strong> is crucial for a successful procurement process. This section helps you organize vendor information and track their engagement throughout your project.
              </p>
              <p className="text-gray-700 mb-3">
                <strong>Here's what you can do:</strong>
              </p>
              <ul className="list-disc list-inside text-gray-700 space-y-1 mb-4 ml-2">
                <li><strong>Add vendors:</strong> Create vendor profiles with organization details and email domains</li>
                <li><strong>Manage contacts:</strong> Add multiple contact persons for each vendor organization</li>
                <li><strong>Track status:</strong> Monitor vendors as Potential, Invited, Participating, or Rejected</li>
                <li><strong>Organize information:</strong> Keep all vendor details in one centralized location</li>
              </ul>
              <div className="bg-white/60 border border-primary-300 rounded-md p-3 shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="text-3xl flex-shrink-0">💡</div>
                  <div className="flex-1 text-sm text-gray-700 italic">
                    <div className="font-bold not-italic mb-1">Tip:</div>
                    <div>Add contact persons early in the process!</div>
                    <div>This will streamline RFI and RFP distribution when you're ready to engage vendors.</div>
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

      <VendorList
        projectId={projectId}
        vendors={vendors}
        onStatusChange={handleStatusChange}
        onAddVendor={async (data) => {
          await handleAddVendor(data);
          setShowAddVendorForm(false);
        }}
        onUpdateVendor={handleUpdateVendor}
        onDeleteVendor={handleDeleteVendor}
        onAddContact={handleAddContact}
        onEditContact={handleEditContact}
        onDeleteContact={handleDeleteContact}
        showAddVendorForm={showAddVendorForm}
        onAddVendorFormChange={setShowAddVendorForm}
      />
    </div>
  );
}





