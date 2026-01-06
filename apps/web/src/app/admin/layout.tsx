"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AdminHeader } from "@/components/AdminHeader";
import { ProtectedRoute } from "@/components/ProtectedRoute";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (loading) return;

    // Check if user has GlobalAdministrator role
    if (!user) {
      router.push("/login");
      return;
    }

    if (user.role !== "GlobalAdministrator") {
      router.push("/dashboard");
      return;
    }

    // Set admin mode in sessionStorage
    if (typeof window !== "undefined") {
      sessionStorage.setItem("isAdminMode", "true");
    }

    setChecking(false);
  }, [user, loading, router]);

  if (loading || checking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-text-secondary">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user || user.role !== "GlobalAdministrator") {
    return null;
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background-primary transition-colors">
        <AdminHeader />
        <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </main>
      </div>
    </ProtectedRoute>
  );
}


