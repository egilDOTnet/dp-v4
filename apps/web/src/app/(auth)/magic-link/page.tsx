"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";

function MagicLinkContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { login } = useAuth();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");

  useEffect(() => {
    const token = searchParams.get("token");
    if (!token) {
      router.push("/login");
      return;
    }

    // Verify magic link token
    api.auth
      .verifyMagicLink(token)
      .then((result) => {
        setEmail(result.email);
      })
      .catch(() => {
        setError("Invalid or expired magic link");
      });
  }, [searchParams, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    const token = searchParams.get("token");
    if (!token) {
      setError("Invalid token");
      return;
    }

    setLoading(true);
    try {
      const result = await api.auth.setPassword(token, password);
      login(result.token, result.user);
      router.push("/dashboard");
    } catch (err: any) {
      setError(err.message || "Failed to set password");
    } finally {
      setLoading(false);
    }
  };

  if (!email) {
    return (
      <div className="w-full max-w-md p-8 bg-white rounded-lg shadow-md">
        {error ? (
          <div>
            <h1 className="text-2xl font-bold mb-4 text-red-600">Error</h1>
            <p className="text-gray-600 mb-4">{error}</p>
            <button
              onClick={() => router.push("/login")}
              className="w-full px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700"
            >
              Back to Login
            </button>
          </div>
        ) : (
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Verifying magic link...</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="w-full max-w-md p-8 bg-white rounded-lg shadow-md">
      <h1 className="text-2xl font-bold mb-4">Set Your Password</h1>
      <p className="text-gray-600 mb-6">
        Please set a password for <strong>{email}</strong>
      </p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
            Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            autoFocus
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            placeholder="Enter password (min 8 characters)"
          />
        </div>
        <div>
          <label
            htmlFor="confirmPassword"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Confirm Password
          </label>
          <input
            id="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            minLength={8}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            placeholder="Confirm password"
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50"
        >
          {loading ? "Setting Password..." : "Set Password & Login"}
        </button>
      </form>
    </div>
  );
}

export default function MagicLinkPage() {
  return (
    <Suspense
      fallback={
        <div className="w-full max-w-md p-8 bg-white rounded-lg shadow-md">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading...</p>
          </div>
        </div>
      }
    >
      <MagicLinkContent />
    </Suspense>
  );
}

