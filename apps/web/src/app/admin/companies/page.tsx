"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useSearch } from "@/hooks/useSearch";
import {
  Breadcrumbs,
  SearchBar,
  Button,
  LoadingSpinner,
  EmptyState,
  PageHeader,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Badge,
} from "@/components/ui";
import { CompanyFormDialog } from "@/components/admin/CompanyFormDialog";

type SubscriptionStatus = "Trial" | "Active" | "Expired";
type SubscriptionTier = "Projects1" | "Projects2" | "Projects5" | "Unlimited" | null;

interface Company {
  id: string;
  name: string;
  organizationNumber?: string | null;
  emailDomain?: string | null;
  subscriptionStatus: SubscriptionStatus;
  subscriptionTier?: SubscriptionTier;
  subscriptionExpiresAt?: string | null;
  trialStartedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  _count: {
    User: number;
    Project: number;
  };
}

export default function CompaniesPage() {
  const { user: currentUser } = useAuth();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingCompany, setEditingCompany] = useState<Company | undefined>();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { searchTerm, setSearchTerm, filteredItems, clearSearch, isSearching } = useSearch(companies, {
    searchKeys: ["name", "organizationNumber", "emailDomain"],
  });

  const displayItems = isSearching ? filteredItems : companies;

  const loadCompanies = async () => {
    try {
      const data = await api.admin.companies.list();
      setCompanies(data as Company[]);
    } catch (err) {
      console.error("Failed to load companies:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCompanies();
  }, []);

  const handleCreate = async (data: {
    name: string;
    organizationNumber?: string | null;
    emailDomain?: string | null;
    subscriptionStatus: SubscriptionStatus;
    subscriptionTier?: SubscriptionTier;
    subscriptionExpiresAt?: string | null;
  }) => {
    await api.admin.companies.create(data);
    await loadCompanies();
    setShowCreateDialog(false);
  };

  const handleUpdate = async (data: {
    name: string;
    organizationNumber?: string | null;
    emailDomain?: string | null;
    subscriptionStatus: SubscriptionStatus;
    subscriptionTier?: SubscriptionTier;
    subscriptionExpiresAt?: string | null;
  }) => {
    if (!editingCompany) return;
    await api.admin.companies.update(editingCompany.id, data);
    await loadCompanies();
    setEditingCompany(undefined);
  };

  const handleDelete = async () => {
    if (!editingCompany) return;
    await api.admin.companies.delete(editingCompany.id);
    await loadCompanies();
    setEditingCompany(undefined);
  };

  const getSubscriptionStatusBadge = (status: SubscriptionStatus) => {
    const variants = {
      Trial: "warning" as const,
      Active: "success" as const,
      Expired: "error" as const,
    };
    return <Badge variant={variants[status]}>{status}</Badge>;
  };

  const getSubscriptionTierLabel = (tier: SubscriptionTier): string => {
    if (!tier) return "-";
    const labels = {
      Projects1: "1 Project",
      Projects2: "2 Projects",
      Projects5: "5 Projects",
      Unlimited: "Unlimited",
    };
    return labels[tier];
  };

  const formatDate = (dateString: string | null | undefined): string => {
    if (!dateString) return "-";
    const date = new Date(dateString);
    return date.toLocaleDateString();
  };

  const breadcrumbItems = [
    { label: "Admin Home", href: "/admin" },
    { label: "Companies" },
  ];

  if (loading) {
    return (
      <div>
        <Breadcrumbs items={breadcrumbItems} />
        <div className="flex flex-col items-center justify-center min-h-[400px]">
          <LoadingSpinner size="lg" />
          <p className="mt-4 text-text-secondary">Loading companies...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Breadcrumbs items={breadcrumbItems} />

      <PageHeader
        title="Companies"
        actions={
          <Button
            variant="primary"
            onClick={() => setShowCreateDialog(true)}
          >
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Company
          </Button>
        }
      />

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-4 mb-4">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="text-sm font-medium text-red-800 dark:text-red-200">
                Error
              </h3>
              <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                {error}
              </p>
            </div>
            <button
              onClick={() => setError(null)}
              className="text-red-400 hover:text-red-600 dark:hover:text-red-300"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {companies.length > 0 && (
        <div className="flex items-center gap-4 mb-6">
          <div className="w-1/2">
            <SearchBar
              value={searchTerm}
              onChange={setSearchTerm}
              onClear={clearSearch}
              placeholder="Search companies..."
            />
          </div>
          {isSearching && (
            <span className="text-sm text-text-secondary">
              {displayItems.length} of {companies.length} companies
            </span>
          )}
        </div>
      )}

      {displayItems.length === 0 ? (
        <EmptyState
          title={isSearching ? "No companies found" : "No companies"}
          description={isSearching ? "Try adjusting your search query" : "Get started by creating a new company"}
        />
      ) : (
        <div className="bg-background-secondary rounded-lg border border-border-primary overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Organization Number</TableHead>
                <TableHead>Email Domain</TableHead>
                <TableHead>Subscription Status</TableHead>
                <TableHead>Subscription Tier</TableHead>
                <TableHead>Users</TableHead>
                <TableHead>Projects</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayItems.map((company) => (
                <TableRow key={company.id}>
                  <TableCell className="font-medium">{company.name}</TableCell>
                  <TableCell>{company.organizationNumber || "-"}</TableCell>
                  <TableCell>{company.emailDomain || "-"}</TableCell>
                  <TableCell>{getSubscriptionStatusBadge(company.subscriptionStatus)}</TableCell>
                  <TableCell>{getSubscriptionTierLabel(company.subscriptionTier)}</TableCell>
                  <TableCell>{company._count.User}</TableCell>
                  <TableCell>{company._count.Project}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="secondary"
                        onClick={() => setEditingCompany(company)}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="danger"
                        onClick={async () => {
                          if (confirm(`Are you sure you want to delete "${company.name}"?`)) {
                            setError(null);
                            try {
                              await api.admin.companies.delete(company.id);
                              await loadCompanies();
                            } catch (err: any) {
                              setError(err.message || "Failed to delete company");
                            }
                          }
                        }}
                        disabled={company.id === currentUser?.tenantId}
                        title={company.id === currentUser?.tenantId ? "You cannot delete your own company" : undefined}
                      >
                        Delete
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Create Dialog */}
      <CompanyFormDialog
        open={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        onSave={handleCreate}
      />

      {/* Edit Dialog */}
      {editingCompany && (
        <CompanyFormDialog
          open={!!editingCompany}
          onClose={() => setEditingCompany(undefined)}
          existingCompany={editingCompany}
          onSave={handleUpdate}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
}