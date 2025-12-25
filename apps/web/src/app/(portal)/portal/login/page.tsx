"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Logo } from "@/components/Logo";

export default function PortalLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [step, setStep] = useState<"email" | "password" | "magic-link" | "set-password">("email");
  const [magicLink, setMagicLink] = useState("");
  const [magicLinkToken, setMagicLinkToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const router = useRouter();

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // If password is provided, try to login
      if (password && step === "password") {
        try {
          const result = await api.vendorRfp.auth.login(email, password);
          localStorage.setItem("token", result.token);
          router.push("/portal/rfp");
          return;
        } catch (err: any) {
          setError(err.message || "Invalid credentials");
          setLoading(false);
          return;
        }
      }

      // Check user status first
      const userStatus = await api.vendorRfp.auth.checkUser(email);

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
      if (step !== "magic-link" && step !== "set-password") {
        setError(err.message || "An error occurred");
      }
      setLoading(false);
    }
  };

  const requestMagicLink = async () => {
    try {
      const result = await api.vendorRfp.auth.requestMagicLink(email);
      
      // In dev mode, always show magic link
      if (result.magicLink && result.token) {
        setMagicLink(result.magicLink);
        setMagicLinkToken(result.token);
        setStep("magic-link");
        setLoading(false);
        
        // Also log to browser console in dev mode
        console.log("🔗 Vendor Magic Link:", result.magicLink);
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

  const handleSetPassword = async (e: React.FormEvent, newPassword: string) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const result = await api.vendorRfp.auth.setPassword(magicLinkToken, newPassword);
      localStorage.setItem("token", result.token);
      router.push("/portal/rfp");
    } catch (err: any) {
      setError(err.message || "Failed to set password");
      setLoading(false);
    }
  };

  if (step === "magic-link" && magicLink) {
    return (
      <div className="min-h-screen bg-background-primary flex items-center justify-center px-4">
        <div className="w-full max-w-md p-8 bg-background-tertiary rounded-lg shadow-md">
          <div className="flex justify-center mb-4">
            <Logo height={48} />
          </div>
          <h1 className="text-2xl font-bold mb-4 text-center text-text-primary">Magic Link</h1>
          <p className="text-text-secondary mb-4">
            Click the link below to set your password and log in:
          </p>
          <a
            href={magicLink}
            className="block w-full text-center px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors"
          >
            Set Password & Login
          </a>
          <p className="mt-4 text-sm text-text-secondary">
            Or copy this link: <code className="text-xs break-all text-text-primary">{magicLink}</code>
          </p>
          <button
            onClick={() => {
              setStep("email");
              setMagicLink("");
              setMagicLinkToken("");
              setPassword("");
            }}
            className="mt-4 text-sm text-primary-600 hover:underline"
          >
            Back to login
          </button>
        </div>
      </div>
    );
  }

  if (step === "set-password") {
    return (
      <div className="min-h-screen bg-background-primary flex items-center justify-center px-4">
        <div className="w-full max-w-md p-8 bg-background-tertiary rounded-lg shadow-md">
          <div className="flex justify-center mb-4">
            <Logo height={48} />
          </div>
          <h1 className="text-2xl font-bold mb-4 text-center text-text-primary">Set Password</h1>
          <form onSubmit={(e) => handleSetPassword(e, newPassword)} className="space-y-4">
            <div>
              <label htmlFor="newPassword" className="block text-sm font-medium text-text-primary mb-1">
                New Password
              </label>
              <input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={8}
                autoFocus
                className="w-full px-3 py-2 border border-border-primary rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-background-primary text-text-primary"
                placeholder="Enter your password (min 8 characters)"
              />
            </div>
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-text-primary mb-1">
                Confirm Password
              </label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={8}
                className="w-full px-3 py-2 border border-border-primary rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-background-primary text-text-primary"
                placeholder="Confirm your password"
              />
            </div>
            {newPassword && confirmPassword && newPassword !== confirmPassword && (
              <p className="text-sm text-red-600">Passwords do not match</p>
            )}
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={loading || newPassword !== confirmPassword || newPassword.length < 8}
              className="w-full px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50 transition-colors"
            >
              {loading ? "Setting password..." : "Set Password & Login"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background-primary flex items-center justify-center px-4">
      <div className="w-full max-w-md p-8 bg-background-tertiary rounded-lg shadow-md">
        <div className="flex justify-center mb-6">
          <Logo height={48} />
        </div>
        <h1 className="text-2xl font-bold mb-6 text-center text-text-primary">Vendor Portal Login</h1>
        <form onSubmit={handleEmailSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-text-primary mb-1">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (step === "password") {
                  setStep("email");
                }
              }}
              onKeyDown={(e) => {
                // Handle Ctrl-A/Command-A to select all text
                if ((e.metaKey || e.ctrlKey) && e.key === "a") {
                  e.preventDefault();
                  const input = e.currentTarget;
                  input.select();
                }
              }}
              required
              autoFocus={step === "email"}
              className="w-full px-3 py-2 border border-border-primary rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-background-primary text-text-primary"
              placeholder="Enter your email"
            />
          </div>
          {step === "password" && (
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-text-primary mb-1">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => {
                  // Handle Ctrl-A/Command-A to select all text
                  if ((e.metaKey || e.ctrlKey) && e.key === "a") {
                    e.preventDefault();
                    const input = e.currentTarget;
                    input.select();
                  }
                }}
                required
                autoFocus
                className="w-full px-3 py-2 border border-border-primary rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-background-primary text-text-primary"
                placeholder="Enter your password"
              />
            </div>
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50 transition-colors"
          >
            {loading ? "Loading..." : step === "password" ? "Login" : "Continue"}
          </button>
        </form>
      </div>
    </div>
  );
}


