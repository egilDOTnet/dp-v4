"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api, User } from "@/lib/api";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    try {
      const userData = await api.auth.me();
      setUser(userData);
      setLoading(false);
    } catch {
      // Silently fail if API is not available or token is invalid
      localStorage.removeItem("token");
      setUser(null);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("token");
    
    // Skip token validation if we're in impersonation mode
    // (impersonation uses vendor tokens, not admin tokens)
    const isImpersonating = typeof window !== "undefined" 
      ? sessionStorage.getItem('isImpersonating') === 'true'
      : false;
    
    if (isImpersonating) {
      // In impersonation mode, don't validate the token with admin API
      // The portal layout will handle vendor token validation
      setLoading(false);
      return;
    }
    
    if (token) {
      refreshUser();
    } else {
      setLoading(false);
    }
  }, [refreshUser]);

  const login = (token: string, userData: User) => {
    localStorage.setItem("token", token);
    setUser(userData);
  };

  const logout = async () => {
    // Call API first while token is still available
    try {
      await api.auth.logout();
    } catch {
      // Ignore errors on logout - we'll clear local state anyway
    } finally {
      // Always clear local state
      localStorage.removeItem("token");
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

