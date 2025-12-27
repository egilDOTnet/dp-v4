"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useMobileMenu } from "@/contexts/MobileMenuContext";
import { useRouter, usePathname } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { Logo } from "@/components/Logo";
import { api, Notification } from "@/lib/api";
import { UserAvatar } from "./UserAvatar";
import { formatDateTimeISO } from "@/lib/date-utils";

export function Header() {
  const { user, logout } = useAuth();
  const { setPreference, resolvedTheme } = useTheme();
  const { toggleMobileMenu } = useMobileMenu();
  const router = useRouter();
  const pathname = usePathname();
  const [showMenu, setShowMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [hasNewNotifications, setHasNewNotifications] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const notificationsRef = useRef<HTMLDivElement>(null);

  // Check if we're on a project page
  const isProjectPage = pathname?.startsWith("/projects/");

  // Load notifications
  useEffect(() => {
    if (user) {
      loadNotifications();
      
      // Poll for new notifications every 30 seconds
      const interval = setInterval(() => {
        loadNotifications();
      }, 30000);
      
      return () => clearInterval(interval);
    }
  }, [user]);

  // Check for new notifications and trigger animation
  useEffect(() => {
    if (unreadCount > 0) {
      setHasNewNotifications(true);
      // Stop jiggling after 1 second
      const timer = setTimeout(() => {
        setHasNewNotifications(false);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [unreadCount]);

  const loadNotifications = async () => {
    try {
      const data = await api.notifications.list();
      setNotifications(data);
      // Calculate unread count from the notifications array
      const unread = data.filter(n => !n.read).length;
      setUnreadCount(unread);
      console.log("Loaded notifications:", data.length, data);
    } catch (err: any) {
      console.error("Failed to load notifications:", err);
      // Set empty array on error to prevent stale data
      setNotifications([]);
      setUnreadCount(0);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await api.notifications.markAllRead();
      await loadNotifications();
    } catch (err) {
      console.error("Failed to mark all as read:", err);
    }
  };

  const handleNotificationClick = async (notification: Notification) => {
    // Mark as read
    try {
      await api.notifications.markRead(notification.id);
      await loadNotifications();
    } catch (err) {
      console.error("Failed to mark notification as read:", err);
    }
    
    // Navigate based on notification type
    if (notification.type === "RFP_QUESTION" && notification.rfpQuestion) {
      // Navigate to RFP questions page with question ID to scroll to it
      router.push(`/projects/${notification.rfpQuestion.rfp.project.id}/rfp?question=${notification.rfpQuestionId}`);
    } else if (notification.taskId && notification.task) {
      // Navigate to task with task ID to scroll to it
      router.push(`/projects/${notification.task.project.id}/tasks?phase=${notification.task.phaseId}&task=${notification.taskId}`);
    }
    
    setShowNotifications(false);
  };

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
      if (notificationsRef.current && !notificationsRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = async () => {
    await logout();
    router.push("/login");
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
          {/* Mobile menu icon - only show on project pages when screen < xl */}
          {isProjectPage && (
            <button
              onClick={toggleMobileMenu}
              className="xl:hidden p-2 rounded-md hover:bg-background-primary transition-colors"
              aria-label="Toggle menu"
              aria-expanded="false"
            >
              <svg
                className="w-6 h-6 text-text-primary"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            </button>
          )}
          <Logo href="/dashboard" height={36} />
        </div>
        {user && (
          <div className="flex items-center gap-4">
            {/* Notifications bell */}
            <div className="relative" ref={notificationsRef}>
              <button
                onClick={() => {
                  setShowNotifications(!showNotifications);
                  setShowMenu(false);
                  if (!showNotifications) {
                    loadNotifications();
                  }
                }}
                className={`relative p-2 rounded-md hover:bg-background-primary transition-colors cursor-pointer ${
                  hasNewNotifications ? "animate-jiggle" : ""
                }`}
                aria-expanded={showNotifications}
                aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
              >
                <svg
                  className={`w-5 h-5 transition-colors ${
                    unreadCount > 0 ? "text-red-600" : "text-text-secondary"
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                  />
                </svg>
                {unreadCount > 0 && (
                  <span className="absolute top-0 right-0 block h-2 w-2 rounded-full bg-red-600 ring-2 ring-background-tertiary" />
                )}
              </button>
              {showNotifications && (
                <div className="absolute right-0 mt-2 w-80 bg-background-tertiary rounded-lg shadow-2xl border border-border-primary py-1 z-50 animate-fade-in backdrop-blur-sm max-h-96 overflow-y-auto">
                  {/* Clear all button */}
                  {notifications.length > 0 && (
                    <div className="border-b border-border-primary">
                      <button
                        onClick={handleMarkAllRead}
                        className="w-full text-left px-4 py-2 text-sm text-text-secondary hover:bg-background-primary transition-colors cursor-pointer"
                      >
                        Clear all notifications
                      </button>
                    </div>
                  )}
                  {/* Notifications list */}
                  {notifications.length > 0 ? (
                    <div className="py-1">
                      {notifications.map((notification) => {
                        const displayName = notification.mentionedBy
                          ? notification.mentionedBy.firstName && notification.mentionedBy.lastName
                            ? `${notification.mentionedBy.firstName} ${notification.mentionedBy.lastName}`
                            : notification.mentionedBy.firstName || notification.mentionedBy.lastName || notification.mentionedBy.name || notification.mentionedBy.email
                          : "Someone";
                        const date = formatDateTimeISO(notification.createdAt);
                        const text =
                          notification.type === "TASK_MENTION"
                            ? `${displayName} mentioned you in a comment`
                            : notification.type === "RFP_QUESTION"
                            ? "A vendor asked a question about an RFP"
                            : `${displayName} commented on a task`;
                        
                        return (
                          <button
                            key={notification.id}
                            onClick={() => handleNotificationClick(notification)}
                            className={`w-full text-left px-4 py-3 hover:bg-background-primary transition-colors cursor-pointer ${
                              !notification.read ? "bg-primary-50/50" : ""
                            }`}
                          >
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-text-primary">{text}</p>
                              {(notification.task || notification.rfpQuestion) && (
                                <div className="flex items-center justify-between gap-2 mt-1">
                                  <p className="text-xs text-text-secondary truncate">
                                    {notification.task
                                      ? notification.task.name
                                      : notification.rfpQuestion
                                      ? `${notification.rfpQuestion.rfp.project.name} - RFP`
                                      : ""}
                                  </p>
                                  <p className="text-xs text-text-secondary flex-shrink-0">
                                    {date}
                                  </p>
                                </div>
                              )}
                            </div>
                            {!notification.read && (
                              <div className="mt-2 h-0.5 w-full bg-primary-600" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="px-4 py-8 text-center text-sm text-text-secondary">
                      No notifications
                    </div>
                  )}
                </div>
              )}
            </div>
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

                  {/* Navigation items */}
                  <div className="py-1">
                    <button
                      onClick={() => {
                        setShowMenu(false);
                        router.push("/dashboard?noAutoRedirect=true");
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
                          d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                        />
                      </svg>
                      Company Home
                    </button>

                    <button
                      onClick={() => {
                        setShowMenu(false);
                        router.push("/profile");
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
                          d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                        />
                      </svg>
                      Profile
                    </button>
                  </div>

                  {/* Theme toggle */}
                  <div className="border-t border-border-primary py-1">
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

                  {/* Logout */}
                  <div className="border-t border-border-primary py-1">
                    <button
                      onClick={handleLogout}
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
                          d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                        />
                      </svg>
                      Sign out
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
