"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [step, setStep] = useState<"email" | "password" | "magic-link">("email");
  const [magicLink, setMagicLink] = useState("");
  const [userExists, setUserExists] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const { login } = useAuth();

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // If password is provided, try to login
      if (password && step === "password") {
        try {
          const result = await api.auth.login(email, password);
          login(result.token, result.user);
          router.push("/dashboard");
          return;
        } catch (err: any) {
          setError(err.message || "Invalid credentials");
          setLoading(false);
          return;
        }
      }

      // Check user status first
      const userStatus = await api.auth.checkUser(email);
      setUserExists(userStatus.exists);

      // If user exists and has password, show password field
      if (userStatus.exists && userStatus.hasPassword) {
        setStep("password");
        setLoading(false);
        return;
      }

      // User doesn't exist or has no password - request magic link
      await requestMagicLink();
      // requestMagicLink handles its own loading state
    } catch (err: any) {
      // Only set error if we haven't already handled it in requestMagicLink
      if (step !== "magic-link") {
        setError(err.message || "An error occurred");
      }
      setLoading(false);
    }
  };

  const requestMagicLink = async () => {
    try {
      const result = await api.auth.requestMagicLink(email);
      
      // In dev mode, always show magic link
      if (result.magicLink) {
        setMagicLink(result.magicLink);
        setStep("magic-link");
        setLoading(false);
        
        // Also log to browser console in dev mode
        console.log("🔗 Magic Link:", result.magicLink);
        console.log("Token:", result.token);
      } else {
        setError("Magic link sent to your email");
        setLoading(false);
      }
    } catch (err: any) {
      // If error occurs, still try to show a helpful message in dev mode
      if (process.env.NODE_ENV === "development") {
        console.error("Error requesting magic link:", err);
        setError(err.message || "Failed to generate magic link. Check server console for details.");
      } else {
        setError(err.message || "Failed to request magic link");
      }
      setLoading(false);
      throw err;
    }
  };

  if (step === "magic-link" && magicLink) {
    return (
      <div className="w-full max-w-md p-8 bg-white rounded-lg shadow-md">
        <h1 className="text-2xl font-bold mb-4">Magic Link</h1>
        <p className="text-gray-600 mb-4">
          Click the link below to set your password and log in:
        </p>
        <a
          href={magicLink}
          className="block w-full text-center px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700"
        >
          Set Password & Login
        </a>
        <p className="mt-4 text-sm text-gray-500">
          Or copy this link: <code className="text-xs break-all">{magicLink}</code>
        </p>
        <button
          onClick={() => {
            setStep("email");
            setMagicLink("");
            setPassword("");
            setUserExists(null);
          }}
          className="mt-4 text-sm text-primary-600 hover:underline"
        >
          Back to login
        </button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md p-8 bg-white rounded-lg shadow-md">
      <h1 className="text-2xl font-bold mb-6">Login</h1>
      <form onSubmit={handleEmailSubmit} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              // Reset user status when email changes
              setUserExists(null);
              if (step === "password") {
                setStep("email");
              }
            }}
            required
            autoFocus={step === "email"}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            placeholder="Enter your email"
          />
        </div>
        {step === "password" && (
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
              autoFocus
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="Enter your password"
            />
          </div>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50"
        >
          {loading ? "Loading..." : step === "password" ? "Login" : "Continue"}
        </button>
      </form>
    </div>
  );
}

