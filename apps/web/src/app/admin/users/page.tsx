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
  Badge,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui";
import { UserFormDialog } from "@/components/admin/UserFormDialog";

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
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | undefined>(undefined);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);

  const { searchTerm, setSearchTerm, filteredItems, clearSearch, isSearching } = useSearch(users, {
    searchKeys: ["email", "firstName", "lastName", "name", "tenant.name" as any],
  });

  const displayItems = isSearching ? filteredItems : users;

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      const data = await api.admin.users.list();
      setUsers(data);
    } catch (err) {
      console.error("Failed to load users:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingUser(undefined);
    setDialogOpen(true);
  };

  const handleEdit = (user: User) => {
    setEditingUser(user);
    setDialogOpen(true);
  };

  const handleSave = async (data: {
    email: string;
    firstName?: string;
    lastName?: string;
    name?: string;
    role: string;
    tenantId?: string | null;
  }) => {
    if (editingUser) {
      await api.admin.users.update(editingUser.id, data);
    } else {
      await api.admin.users.create(data);
    }
    await loadUsers();
  };

  const handleDelete = async () => {
    if (!editingUser) return;
    
    try {
      await api.admin.users.delete(editingUser.id);
      await loadUsers();
    } catch (err: any) {
      throw new Error(err.message || "Failed to delete user");
    }
  };

  const handleDeleteClick = async (user: User) => {
    if (!confirm(`Are you sure you want to delete "${user.email}"? This action cannot be undone.`)) {
      return;
    }
    
    setDeletingUserId(user.id);
    try {
      await api.admin.users.delete(user.id);
      await loadUsers();
    } catch (err: any) {
      alert(err.message || "Failed to delete user");
    } finally {
      setDeletingUserId(null);
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
          <Button variant="primary" onClick={handleCreate}>
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
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Company</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {displayItems.map((user) => (
              <TableRow key={user.id}>
                <TableCell className="font-medium">{user.email}</TableCell>
                <TableCell>{getDisplayName(user)}</TableCell>
                <TableCell>
                  <Badge className={roleColors[user.role] || roleColors.User}>
                    {user.role.replace(/([A-Z])/g, " $1").trim()}
                  </Badge>
                </TableCell>
                <TableCell>{user.tenant?.name || "—"}</TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleEdit(user)}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => handleDeleteClick(user)}
                      disabled={deletingUserId === user.id || user.id === currentUser?.id}
                      loading={deletingUserId === user.id}
                      title={user.id === currentUser?.id ? "You cannot delete your own account" : undefined}
                    >
                      Delete
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <UserFormDialog
        open={dialogOpen}
        onClose={() => {
          setDialogOpen(false);
          setEditingUser(undefined);
        }}
        existingUser={editingUser}
        onSave={handleSave}
      />
    </div>
  );
}

