"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import Link from "next/link";
import { useSearch } from "@/hooks/useSearch";
import { Breadcrumbs, SearchBar, Card, CardBody, Button, LoadingSpinner, EmptyState, PageHeader, Badge } from "@/components/ui";

interface User {
  id: string;
  email: string;
  name?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  role: string;
  tenantId?: string | null;
  tenant?: { id: string; name: string } | null;
  createdAt: string;
  updatedAt: string;
}

const roleColors: Record<string, string> = {
  GlobalAdministrator: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  CompanyAdministrator: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  User: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200",
  Vendor: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
};

export default function UsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  const { searchTerm, setSearchTerm, filteredItems, clearSearch, isSearching } = useSearch(users, {
    searchKeys: ["email", "firstName", "lastName", "name", "tenant.name" as any],
  });

  const displayItems = isSearching ? filteredItems : users;

  useEffect(() => {
    api.admin.users
      .list()
      .then((data) => {
        setUsers(data);
      })
      .catch((err) => {
        console.error("Failed to load users:", err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this user?")) return;
    
    try {
      await api.admin.users.delete(id);
      setUsers(users.filter((u) => u.id !== id));
    } catch (err: any) {
      alert(err.message || "Failed to delete user");
    }
  };

  const getDisplayName = (user: User) => {
    if (user.firstName && user.lastName) {
      return `${user.firstName} ${user.lastName}`;
    }
    if (user.firstName) {
      return user.firstName;
    }
    if (user.lastName) {
      return user.lastName;
    }
    return user.name || user.email;
  };

  const breadcrumbItems = [
    { label: "Admin Home", href: "/admin" },
    { label: "Users" },
  ];

  if (loading) {
    return (
      <div>
        <Breadcrumbs items={breadcrumbItems} />
        <div className="flex flex-col items-center justify-center min-h-[400px]">
          <LoadingSpinner size="lg" />
          <p className="mt-4 text-text-secondary">Loading users...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Breadcrumbs items={breadcrumbItems} />
      
      <PageHeader
        title="Users"
        actions={
          <Button
            variant="primary"
            onClick={() => router.push("/admin/users/new")}
          >
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New User
          </Button>
        }
      />

      {users.length > 0 && (
        <div className="flex items-center gap-4 mb-6">
          <div className="w-1/2">
            <SearchBar
              value={searchTerm}
              onChange={setSearchTerm}
              onClear={clearSearch}
              placeholder="Search users..."
            />
          </div>
          {isSearching && (
            <span className="text-sm text-text-secondary">
              {displayItems.length} of {users.length} users
            </span>
          )}
        </div>
      )}

      {displayItems.length === 0 ? (
        <EmptyState
          title={isSearching ? "No users found" : "No users"}
          description={isSearching ? "Try adjusting your search query" : "Get started by creating a new user"}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {displayItems.map((user) => (
            <Card key={user.id} variant="default">
              <CardBody className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <Link href={`/admin/users/${user.id}`} className="flex-1">
                    <h3 className="text-lg font-semibold text-text-primary hover:text-primary-600">
                      {getDisplayName(user)}
                    </h3>
                    <p className="text-sm text-text-secondary mt-1">{user.email}</p>
                  </Link>
                  <button
                    onClick={() => handleDelete(user.id)}
                    className="text-red-600 hover:text-red-700 ml-2"
                    title="Delete user"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
                <div className="space-y-2">
                  <div>
                    <Badge className={roleColors[user.role] || roleColors.User}>
                      {user.role.replace(/([A-Z])/g, " $1").trim()}
                    </Badge>
                  </div>
                  {user.tenant && (
                    <p className="text-sm text-text-secondary">
                      Company: {user.tenant.name}
                    </p>
                  )}
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

