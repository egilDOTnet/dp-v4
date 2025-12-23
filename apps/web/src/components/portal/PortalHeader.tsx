"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useState, useEffect, useRef, useMemo } from "react";
import { Logo } from "@/components/Logo";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import { VendorContactPerson } from "@/lib/api";
import { UserAvatar } from "../UserAvatar";

interface PortalHeaderProps {
  contactPerson: VendorContactPerson | null;
  onLogout?: () => void;
  isPreviewMode?: boolean;
  isImpersonating?: boolean;
  projectId?: string | null;
}

export function PortalHeader({ contactPerson, onLogout, isPreviewMode = false, isImpersonating = false, projectId }: PortalHeaderProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const previewToken = useMemo(() => searchParams?.get("preview"), [searchParams]);
  const { setPreference, resolvedTheme } = useTheme();
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const getDisplayName = () => {
    if (isPreviewMode && user) {
      if (user.firstName && user.lastName) {
        return `${user.firstName} ${user.lastName}`;
      }
      if (user.firstName) {
        return user.firstName;
      }
      if (user.lastName) {
        return user.lastName;
      }
      return user.name || user.email || "";
    }
    if (contactPerson?.firstName && contactPerson?.lastName) {
      return `${contactPerson.firstName} ${contactPerson.lastName}`;
    }
    if (contactPerson?.firstName) {
      return contactPerson.firstName;
    }
    if (contactPerson?.lastName) {
      return contactPerson.lastName;
    }
    return contactPerson?.email || "";
  };

  // Convert VendorContactPerson or User to User-like object for UserAvatar
  const userForAvatar = isPreviewMode && user
    ? user
    : contactPerson
    ? {
        id: contactPerson.id,
        email: contactPerson.email,
        firstName: contactPerson.firstName,
        lastName: contactPerson.lastName,
        name: `${contactPerson.firstName} ${contactPerson.lastName}`,
        profileImageData: null,
        profileImageFileType: null,
        profileColor: null,
      }
    : null;

  const getEmail = () => {
    if (isPreviewMode && user) {
      return user.email || "";
    }
    return contactPerson?.email || "";
  };

  const handleBackToProject = () => {
    // If impersonating, restore admin token first
    if (isImpersonating && projectId) {
      const adminToken = sessionStorage.getItem('adminToken');
      if (adminToken) {
        // Clean up impersonation state from sessionStorage first
        sessionStorage.removeItem('isImpersonating');
        sessionStorage.removeItem('impersonationToken');
        sessionStorage.removeItem('adminToken');
        sessionStorage.removeItem('impersonateProjectId');
        
        // Remove impersonation token from localStorage
        localStorage.removeItem("token");
        
        // Restore admin token to localStorage
        localStorage.setItem("token", adminToken);
        
        // Use window.location.href to force full page reload so AuthContext re-initializes
        // This ensures the admin token is set before AuthContext checks for authentication
        window.location.href = `/projects/${projectId}/rfp`;
      } else {
        console.warn("No admin token found in sessionStorage. Clearing token and redirecting.");
        // Clean up all impersonation state
        sessionStorage.removeItem('isImpersonating');
        sessionStorage.removeItem('impersonationToken');
        sessionStorage.removeItem('adminToken');
        sessionStorage.removeItem('impersonateProjectId');
        localStorage.removeItem("token");
        // Redirect to login since we don't have the admin token
        window.location.href = "/login";
      }
    } else if (projectId) {
      router.push(`/projects/${projectId}/rfp`);
    } else {
      router.push("/dashboard");
    }
  };

  // Toggle theme between light and dark
  const toggleTheme = () => {
    if (resolvedTheme === "light") {
      setPreference("dark");
    } else {
      setPreference("light");
    }
  };

  // Determine if we should show the user menu
  const shouldShowMenu = isPreviewMode ? (!authLoading && user) : contactPerson;

  // Determine logo href based on mode
  const getLogoHref = () => {
    if (isPreviewMode && previewToken) {
      // In preview mode, only link if we're on an RFP detail page
      // RFP list page requires auth, so we can't navigate there in preview mode
      if (pathname?.startsWith("/portal/rfp/") && pathname !== "/portal/rfp") {
        // On an RFP detail page - link to itself with preview token preserved
        return `${pathname}?preview=${encodeURIComponent(previewToken)}`;
      }
      // On other pages in preview mode - return undefined to make logo non-clickable
      return undefined;
    }
    // Normal mode - link to RFP list
    return "/portal/rfp";
  };

  const getImpersonationName = () => {
    // Try to get name from contactPerson if available
    if (contactPerson) {
      if (contactPerson.firstName && contactPerson.lastName) {
        return `${contactPerson.firstName} ${contactPerson.lastName}`;
      }
      if (contactPerson.firstName) {
        return contactPerson.firstName;
      }
      if (contactPerson.lastName) {
        return contactPerson.lastName;
      }
      if (contactPerson.email) {
        return contactPerson.email;
      }
    }
    // Fallback: try to get from localStorage/sessionStorage or show generic message
    return "vendor contact";
  };

  return (
    <header className="border-b border-border-primary bg-background-tertiary shadow-sm transition-colors">
      {/* Notice banner */}
      {(isImpersonating || isPreviewMode) && (
        <div className="bg-gradient-to-r from-yellow-50 to-amber-50 dark:from-yellow-900/20 dark:to-amber-900/20 border-b border-yellow-200 dark:border-yellow-700">
          <div className="container mx-auto px-4 py-2">
            <p className="text-center text-sm font-semibold text-yellow-800 dark:text-yellow-200">
              {isImpersonating ? `Impersonating ${getImpersonationName()}` : "Preview mode"}
            </p>
          </div>
        </div>
      )}
      <div className="container mx-auto px-4 py-3 flex items-center justify-between">
        <Logo href={getLogoHref()} height={36} />
        {shouldShowMenu && (
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-background-primary transition-colors cursor-pointer"
              aria-expanded={showMenu}
              aria-haspopup="true"
            >
              {userForAvatar && <UserAvatar user={userForAvatar} size="md" />}
              <span className="hidden sm:block text-text-primary">
                {getDisplayName()}
              </span>
              <svg
                className={`w-4 h-4 text-text-secondary transition-transform ${showMenu ? "rotate-180" : ""}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>
            {showMenu && (
              <div className="absolute right-0 mt-2 w-56 bg-background-tertiary rounded-lg shadow-2xl border border-border-primary py-1 z-50 animate-fade-in backdrop-blur-sm">
                {/* User info */}
                <div className="px-4 py-3 border-b border-border-primary">
                  <p className="text-sm font-medium text-text-primary">
                    {getDisplayName()}
                  </p>
                  <p className="text-xs text-text-secondary truncate">
                    {getEmail()}
                  </p>
                  {!isPreviewMode && contactPerson?.isMainContact && (
                    <p className="text-xs text-text-secondary mt-1">
                      Main Contact
                    </p>
                  )}
                </div>

                {/* Navigation items */}
                <div className="py-1">
                  {(isPreviewMode || isImpersonating) ? (
                    <>
                      <button
                        onClick={() => {
                          setShowMenu(false);
                          toggleTheme();
                        }}
                        className="flex items-center gap-3 w-full text-left px-4 py-2 text-sm text-text-primary hover:bg-background-primary transition-colors cursor-pointer"
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
                            d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
                          />
                        </svg>
                        {resolvedTheme === "light" ? "Dark" : "Light"} Mode
                      </button>
                      <div className="border-t border-border-primary my-1"></div>
                      <button
                        onClick={() => {
                          setShowMenu(false);
                          handleBackToProject();
                        }}
                        className="flex items-center gap-3 w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-background-primary transition-colors cursor-pointer"
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
                            d="M10 19l-7-7m0 0l7-7m-7 7h18"
                          />
                        </svg>
                        Back to Project
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => {
                          setShowMenu(false);
                          toggleTheme();
                        }}
                        className="flex items-center gap-3 w-full text-left px-4 py-2 text-sm text-text-primary hover:bg-background-primary transition-colors cursor-pointer"
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
                            d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
                          />
                        </svg>
                        {resolvedTheme === "light" ? "Dark" : "Light"} Mode
                      </button>
                      {onLogout && (
                        <>
                          <div className="border-t border-border-primary my-1"></div>
                          <button
                            onClick={() => {
                              setShowMenu(false);
                              onLogout();
                            }}
                            className="flex items-center gap-3 w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-background-primary transition-colors cursor-pointer"
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
                                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                              />
                            </svg>
                            Logout
                          </button>
                        </>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}


