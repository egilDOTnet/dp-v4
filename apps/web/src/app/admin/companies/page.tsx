"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import Link from "next/link";
import { useSearch } from "@/hooks/useSearch";
import { Breadcrumbs, SearchBar, Card, CardBody, Button, LoadingSpinner, EmptyState, PageHeader } from "@/components/ui";

interface Company {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  _count: {
    User: number;
    Project: number;
  };
}

export default function CompaniesPage() {
  const router = useRouter();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);

  const { searchTerm, setSearchTerm, filteredItems, clearSearch, isSearching } = useSearch(companies, {
    searchKeys: ["name"],
  });

  const displayItems = isSearching ? filteredItems : companies;

  useEffect(() => {
    api.admin.companies
      .list()
      .then((data) => {
        setCompanies(data);
      })
      .catch((err) => {
        console.error("Failed to load companies:", err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this company?")) return;
    
    try {
      await api.admin.companies.delete(id);
      setCompanies(companies.filter((c) => c.id !== id));
    } catch (err: any) {
      alert(err.message || "Failed to delete company");
    }
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
            onClick={() => router.push("/admin/companies/new")}
          >
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Company
          </Button>
        }
      />

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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {displayItems.map((company) => (
            <Card key={company.id} variant="default">
              <CardBody className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <Link href={`/admin/companies/${company.id}`} className="flex-1">
                    <h3 className="text-lg font-semibold text-text-primary hover:text-primary-600">
                      {company.name}
                    </h3>
                  </Link>
                  <button
                    onClick={() => handleDelete(company.id)}
                    className="text-red-600 hover:text-red-700 ml-2"
                    title="Delete company"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
                <div className="space-y-2 text-sm text-text-secondary">
                  <p>{company._count.User} user{company._count.User !== 1 ? "s" : ""}</p>
                  <p>{company._count.Project} project{company._count.Project !== 1 ? "s" : ""}</p>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

