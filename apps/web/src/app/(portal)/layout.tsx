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

    // Check if user is authenticated
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/portal/login");
      return;
    }

    // Load vendor contact info
    loadContactPerson();
  }, [pathname, previewToken, router]);

  const loadContactPerson = async () => {
    try {
      const data = await api.vendorRfp.auth.me();
      setContactPerson(data.contactPerson);
    } catch (err) {
      console.error("Failed to load vendor contact:", err);
      // Clear token and redirect to login
      localStorage.removeItem("token");
      router.push("/portal/login");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    router.push("/portal/login");
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
        projectId={projectId}
      />
      <main className="flex-1 container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
      <PortalFooter />
    </div>
  );
}
