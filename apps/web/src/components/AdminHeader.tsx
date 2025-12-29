"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { Logo } from "@/components/Logo";
import { UserAvatar } from "./UserAvatar";

export function AdminHeader() {
  const { user } = useAuth();
  const { setPreference, resolvedTheme } = useTheme();
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

  const handleExitAdmin = async () => {
    // Clear admin mode from sessionStorage
    if (typeof window !== "undefined") {
      sessionStorage.removeItem("isAdminMode");
    }
    // Navigate back to dashboard
    router.push("/dashboard");
  };

  // Get display name from firstName/lastName or fallback to name or email
  const getDisplayName = () => {
    if (user?.firstName && user?.lastName) {
      return `${user.firstName} ${user.lastName}`;
    }
    if (user?.firstName) {
      return user.firstName;
    }
    if (user?.lastName) {
      return user.lastName;
    }
    return user?.name || user?.email || "";
  };

  // Toggle theme between light and dark
  const toggleTheme = () => {
    if (resolvedTheme === "light") {
      setPreference("dark");
    } else {
      setPreference("light");
    }
  };

  return (
    <header className="border-b border-border-primary bg-background-tertiary shadow-sm transition-colors">
      <div className="container mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Logo href="/admin" height={36} />
        </div>
        {user && (
          <div className="flex items-center gap-4">
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-background-primary transition-colors cursor-pointer"
                aria-expanded={showMenu}
                aria-haspopup="true"
              >
                {user && <UserAvatar user={user} size="md" />}
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
                      {user.email}
                    </p>
                  </div>

                  {/* Theme toggle */}
                  <div className="py-1">
                    <button
                      onClick={toggleTheme}
                      className="flex items-center justify-between w-full px-4 py-2 text-sm text-text-primary hover:bg-background-secondary transition-colors cursor-pointer"
                    >
                      <span className="flex items-center gap-3">
                        {resolvedTheme === "light" ? (
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
                        ) : (
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
                              d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
                            />
                          </svg>
                        )}
                        {resolvedTheme === "light"
                          ? "Switch to Dark"
                          : "Switch to Light"}
                      </span>
                    </button>
                  </div>

                  {/* Exit Admin */}
                  <div className="border-t border-border-primary py-1">
                    <button
                      onClick={() => {
                        setShowMenu(false);
                        handleExitAdmin();
                      }}
                      className="flex items-center gap-3 w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-background-secondary transition-colors cursor-pointer"
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
                      Exit Admin
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  );
}

