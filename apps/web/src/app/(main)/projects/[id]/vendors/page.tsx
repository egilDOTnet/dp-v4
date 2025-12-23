"use client";

import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import { api, Project, ProjectVendor, VendorStatus } from "@/lib/api";
import VendorList from "@/components/VendorList";
import { useSearch } from "@/hooks/useSearch";
import {
  PageHeader,
  SearchBar,
  Breadcrumbs,
  LoadingSpinner,
  HeroBanner,
} from "@/components/ui";

export default function VendorsPage() {
  const params = useParams();
  const projectId = params.id as string;
  const [project, setProject] = useState<Project | null>(null);
  const [vendors, setVendors] = useState<ProjectVendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showAddVendorForm, setShowAddVendorForm] = useState(false);
  const loadingProjectIdRef = useRef<string | null>(null);

  // Search across vendor name, org number, email domain, and contacts
  const { searchTerm, setSearchTerm, filteredItems, clearSearch, isSearching } =
    useSearch(vendors, {
      searchKeys: [
        "vendor.name",
        "vendor.organizationNumber",
        "vendor.emailDomain",
      ],
    });

  // Display items - use vendors directly if not searching, otherwise use filteredItems
  const displayItems = isSearching ? filteredItems : vendors;

  const loadProject = async () => {
    try {
      const projectData = await api.projects.get(projectId);
      // Only update state if we're still loading the same projectId
      if (loadingProjectIdRef.current === projectId) {
        setProject(projectData);
      }
    } catch (err: any) {
      // Only set error if we're still loading the same projectId
      if (loadingProjectIdRef.current === projectId) {
        setError(err.message || "Failed to load project");
      }
    }
  };

  const loadVendors = async (forceUpdate = false) => {
    try {
      const vendorsData = await api.projects.vendors.list(projectId);
      // Update state if we're still loading the same projectId, or if forceUpdate is true
      if (forceUpdate || loadingProjectIdRef.current === projectId) {
        setVendors(vendorsData);
        setError("");
      }
    } catch (err: any) {
      // Only set error if we're still loading the same projectId, or if forceUpdate is true
      if (forceUpdate || loadingProjectIdRef.current === projectId) {
        setError(err.message || "Failed to load vendors");
      }
    } finally {
      // Only update loading state if we're still loading the same projectId
      if (loadingProjectIdRef.current === projectId) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    if (projectId) {
      // Prevent duplicate calls (React Strict Mode protection)
      // Only load if we're not already loading this specific projectId
      if (loadingProjectIdRef.current === projectId) {
        return;
      }
      
      loadingProjectIdRef.current = projectId;
      setLoading(true);
      Promise.all([
        loadProject(),
        loadVendors()
      ]).finally(() => {
        // Only clear if we're still loading the same projectId
        if (loadingProjectIdRef.current === projectId) {
          loadingProjectIdRef.current = null;
        }
      });
    }
    // No cleanup needed - the ref check at the start handles projectId changes
    // and the finally block clears it when load completes
  }, [projectId]);

  const handleAddVendor = async (data: {
    name: string;
    organizationNumber?: string;
    emailDomain?: string;
    shallReceiveRFI?: boolean;
    shallReceiveRFP?: boolean;
    shallReceiveShortlist?: boolean;
    additionalData?: any;
    status?: VendorStatus;
  }) => {
    await api.projects.vendors.create(projectId, data);
    // Force update to refresh the list immediately
    await loadVendors(true);
  };

  const handleUpdateVendor = async (
    vendorId: string,
    data: {
      name?: string;
      organizationNumber?: string;
      emailDomain?: string;
      shallReceiveRFI?: boolean;
      shallReceiveRFP?: boolean;
      shallReceiveShortlist?: boolean;
      additionalData?: any;
      status?: VendorStatus;
    }
  ) => {
    const vendor = vendors.find((pv) => pv.vendor.id === vendorId);
    if (vendor) {
      const hasDetailsChanged =
        (data.name !== undefined && data.name !== vendor.vendor.name) ||
        (data.organizationNumber !== undefined &&
          data.organizationNumber !== (vendor.vendor.organizationNumber || undefined)) ||
        (data.emailDomain !== undefined &&
          data.emailDomain !== (vendor.vendor.emailDomain || undefined)) ||
        (data.shallReceiveRFI !== undefined &&
          data.shallReceiveRFI !== vendor.vendor.shallReceiveRFI) ||
        (data.shallReceiveRFP !== undefined &&
          data.shallReceiveRFP !== vendor.vendor.shallReceiveRFP) ||
        (data.shallReceiveShortlist !== undefined &&
          data.shallReceiveShortlist !== vendor.vendor.shallReceiveShortlist);

      if (hasDetailsChanged) {
        await api.projects.vendors.updateDetails(projectId, vendorId, {
          name: data.name,
          organizationNumber: data.organizationNumber,
          emailDomain: data.emailDomain,
          shallReceiveRFI: data.shallReceiveRFI,
          shallReceiveRFP: data.shallReceiveRFP,
          shallReceiveShortlist: data.shallReceiveShortlist,
          additionalData: data.additionalData,
        });
      }

      if (data.status && data.status !== vendor.status) {
        await api.projects.vendors.update(projectId, vendorId, {
          status: data.status,
        });
      }
    }

    // Force update to refresh the list immediately
    await loadVendors(true);
  };

  const handleStatusChange = async (vendorId: string, status: VendorStatus) => {
    await api.projects.vendors.update(projectId, vendorId, { status });
    // Force update to refresh the list immediately
    await loadVendors(true);
  };

  const handleDeleteVendor = async (vendorId: string) => {
    if (
      !confirm("Are you sure you want to remove this vendor from the project?")
    ) {
      return;
    }
    await api.projects.vendors.delete(projectId, vendorId);
    // Force update to refresh the list immediately
    await loadVendors(true);
  };

  const handleAddContact = async (
    vendorId: string,
    data: {
      firstName: string;
      lastName: string;
      email: string;
      isMainContact?: boolean;
    }
  ) => {
    await api.projects.vendors.contacts.create(projectId, vendorId, data);
    // Force update to refresh the list immediately
    await loadVendors(true);
  };

  const handleEditContact = async (
    vendorId: string,
    contactId: string,
    data: {
      firstName: string;
      lastName: string;
      email: string;
      isMainContact?: boolean;
    }
  ) => {
    await api.projects.vendors.contacts.update(
      projectId,
      vendorId,
      contactId,
      data
    );
    // Force update to refresh the list immediately
    await loadVendors(true);
  };

  const handleDeleteContact = async (vendorId: string, contactId: string) => {
    await api.projects.vendors.contacts.delete(projectId, vendorId, contactId);
    // Force update to refresh the list immediately
    await loadVendors(true);
  };

  const breadcrumbItems = [
    { label: "Home", href: "/dashboard?noAutoRedirect=true" },
    { label: "Projects", href: "/projects" },
    { label: project?.name || "Project", href: `/projects/${projectId}` },
    { label: "Vendors" },
  ];

  if (loading) {
    return (
      <div className="space-y-6">
        <Breadcrumbs items={breadcrumbItems} />
        <div className="flex flex-col items-center justify-center min-h-[400px]">
          <LoadingSpinner size="lg" />
          <p className="mt-4 text-text-secondary">
            Loading vendors...
          </p>
        </div>
      </div>
    );
  }

  if (error && vendors.length === 0) {
    return (
      <div className="space-y-6">
        <Breadcrumbs items={breadcrumbItems} />
        <div className="text-center py-12">
          <p className="text-red-600 dark:text-red-400">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Breadcrumbs items={breadcrumbItems} />

      <PageHeader title="Vendors" />

      {/* Hero Banner */}
      <HeroBanner
        storageKey="vendors-hero-banner"
        title="Welcome to Vendor Management"
        description={
          <>
            Building a comprehensive list of <strong>potential vendors</strong> is crucial for a successful procurement process.
          </>
        }
        features={[
          {
            label: "Add vendors",
            description: "Create vendor profiles with organization details",
          },
          {
            label: "Manage contacts",
            description: "Add multiple contact persons",
          },
          {
            label: "Track status",
            description: "Monitor vendor engagement",
          },
        ]}
        tip={
          <>
            <strong className="not-italic">Tip:</strong> Add contact persons early to streamline RFI and RFP distribution.
          </>
        }
      />

      {/* Search Bar and Add Button */}
      <div className="flex items-center gap-4">
        <div className="flex-1 max-w-md">
          <SearchBar
            value={searchTerm}
            onChange={setSearchTerm}
            onClear={clearSearch}
            placeholder="Search vendors..."
          />
        </div>
        {isSearching && (
          <span className="text-sm text-text-secondary">
            {displayItems.length} of {vendors.length} vendors
          </span>
        )}
        <button
          onClick={() => setShowAddVendorForm(true)}
          className="ml-auto px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 text-sm font-medium flex items-center gap-1 transition-colors"
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
          Add Vendor
        </button>
      </div>

      <VendorList
        projectId={projectId}
        vendors={displayItems}
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
