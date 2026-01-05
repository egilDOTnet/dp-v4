"use client";

import { ReactNode, useEffect, useState, useMemo, useCallback } from "react";
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
  const [error, setError] = useState<string | null>(null);

  // Create stable preview token value
  const previewToken = useMemo(() => searchParams.get("preview"), [searchParams]);
  // Check both URL param and sessionStorage for impersonation state (persists across reloads)
  const isImpersonating = useMemo(() => {
    const urlParam = searchParams.get("impersonate") === "true";
    // Only check sessionStorage on client side
    const stored = typeof window !== "undefined" 
      ? sessionStorage.getItem('isImpersonating') === 'true'
      : false;
    return urlParam || stored;
  }, [searchParams]);

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
      // Persist impersonation state to sessionStorage for reloads
      sessionStorage.setItem('isImpersonating', 'true');
      
      // Get projectId from sessionStorage (set by RFP Overview when impersonating)
      const storedProjectId = sessionStorage.getItem('impersonateProjectId');
      if (storedProjectId) {
        setProjectId(storedProjectId);
      }
      
      // Check if we have an impersonation token in localStorage
      // If not, try to restore it from sessionStorage (in case of reload)
      const token = localStorage.getItem("token");
      if (!token) {
        // Try to restore token from sessionStorage if available
        const storedToken = sessionStorage.getItem('impersonationToken');
        if (storedToken) {
          localStorage.setItem("token", storedToken);
        } else {
          // No token available, redirect to login
          router.push("/portal/login");
          return;
        }
      } else {
        // Save current token to sessionStorage as backup for reloads
        sessionStorage.setItem('impersonationToken', token);
      }
    } else {
      // Not impersonating - clear impersonation state
      sessionStorage.removeItem('isImpersonating');
      sessionStorage.removeItem('impersonationToken');
    }

    // Check if user is authenticated
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/portal/login");
      return;
    }

    // Load vendor contact info (works for both normal and impersonation mode)
    loadContactPerson();
  }, [pathname, previewToken, isImpersonating, router, loadContactPerson]);

  const loadContactPerson = useCallback(async () => {
    try {
      setError(null);
      const data = await api.vendorRfp.auth.me();
      setContactPerson(data.contactPerson);
    } catch (err: any) {
      console.error("Failed to load vendor contact:", err);
      
      // Extract error message from API response
      const errorMessage = err?.response?.data?.message || err?.response?.data?.error || err?.message || "Failed to load vendor contact information";
      
      // If impersonating, don't redirect to login - just show error
      // The user can use "Back to Project" to exit impersonation
      if (isImpersonating) {
        setError(
          `Unable to load vendor contact: ${errorMessage}. Use 'Back to Project' to exit impersonation mode.`
        );
      } else {
        // Clear token and redirect to login
        localStorage.removeItem("token");
        router.push("/portal/login");
      }
    } finally {
      setLoading(false);
    }
  }, [isImpersonating, router]);

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
        sessionStorage.removeItem('isImpersonating');
        sessionStorage.removeItem('impersonationToken');
        // Use window.location.href to force full page reload so AuthContext re-initializes
        // This ensures the admin token is used for all API calls
        window.location.href = `/projects/${projectId}/rfp`;
      } else {
        // If no admin token was saved, clear everything and redirect to login
        console.warn("No admin token found in sessionStorage. Redirecting to login.");
        localStorage.removeItem("token");
        sessionStorage.removeItem('impersonateProjectId');
        sessionStorage.removeItem('isImpersonating');
        sessionStorage.removeItem('impersonationToken');
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
        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-red-600 dark:text-red-400 font-medium">Error</p>
            <p className="text-red-600 dark:text-red-400 text-sm mt-1">{error}</p>
          </div>
        )}
        {children}
      </main>
      <PortalFooter />
    </div>
  );
}


