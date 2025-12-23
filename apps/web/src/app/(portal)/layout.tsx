"use client";

import { ReactNode, useEffect, useState, useMemo } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { PortalHeader } from "@/components/portal/PortalHeader";
import { PortalFooter } from "@/components/portal/PortalFooter";
import { api, VendorContactPerson } from "@/lib/api";

export default function PortalLayout({
  children,
}: {
  children: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [contactPerson, setContactPerson] = useState<VendorContactPerson | null>(null);
  const [loading, setLoading] = useState(true);
  const [projectId, setProjectId] = useState<string | null>(null);

  // Create stable preview token value
  const previewToken = useMemo(() => searchParams.get("preview"), [searchParams]);
  const isImpersonating = useMemo(() => searchParams.get("impersonate") === "true", [searchParams]);

  useEffect(() => {
    // Check if we're in preview mode (has preview token in URL)
    if (previewToken) {
      // Preview mode - skip vendor authentication
      setContactPerson(null);
      // Try to get projectId from sessionStorage (set by RFP detail page)
      const storedProjectId = sessionStorage.getItem('previewProjectId');
      if (storedProjectId) {
        setProjectId(storedProjectId);
      }
      setLoading(false);
      return;
    }

    // Check if we're in impersonation mode
    if (isImpersonating) {
      // Get projectId from sessionStorage (set by RFP Overview when impersonating)
      const storedProjectId = sessionStorage.getItem('impersonateProjectId');
      if (storedProjectId) {
        setProjectId(storedProjectId);
      }
    }

    // Check if user is authenticated
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/portal/login");
      return;
    }

    // Load vendor contact info (works for both normal and impersonation mode)
    loadContactPerson();
  }, [pathname, previewToken, isImpersonating, router]);

  const loadContactPerson = async () => {
    try {
      const data = await api.vendorRfp.auth.me();
      setContactPerson(data.contactPerson);
    } catch (err) {
      console.error("Failed to load vendor contact:", err);
      // If impersonating, don't redirect to login - just show error
      // The user can use "Back to Project" to exit impersonation
      if (isImpersonating) {
        console.error("Impersonation token may be invalid. Use 'Back to Project' to exit.");
      } else {
        // Clear token and redirect to login
        localStorage.removeItem("token");
        router.push("/portal/login");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    // If impersonating, restore admin token and go back to RFP Overview
    if (isImpersonating && projectId) {
      // Restore the admin token if it was saved
      const adminToken = sessionStorage.getItem('adminToken');
      if (adminToken) {
        // Remove impersonation token first
        localStorage.removeItem("token");
        // Restore admin token
        localStorage.setItem("token", adminToken);
        // Clean up sessionStorage
        sessionStorage.removeItem('adminToken');
        sessionStorage.removeItem('impersonateProjectId');
        // Use window.location.href to force full page reload so AuthContext re-initializes
        // This ensures the admin token is used for all API calls
        window.location.href = `/projects/${projectId}/rfp`;
      } else {
        // If no admin token was saved, clear everything and redirect to login
        console.warn("No admin token found in sessionStorage. Redirecting to login.");
        localStorage.removeItem("token");
        sessionStorage.removeItem('impersonateProjectId');
        router.push("/portal/login");
      }
    } else {
      localStorage.removeItem("token");
      router.push("/portal/login");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background-primary flex items-center justify-center">
        <div className="text-text-secondary">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background-primary transition-colors flex flex-col">
      <PortalHeader 
        contactPerson={contactPerson} 
        onLogout={handleLogout}
        isPreviewMode={!!previewToken}
        isImpersonating={isImpersonating}
        projectId={projectId}
      />
      <main className="flex-1 container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
      <PortalFooter />
    </div>
  );
}


