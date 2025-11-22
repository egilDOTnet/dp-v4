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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const { login } = useAuth();

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // Try to login with password first
      if (password) {
        try {
          const result = await api.auth.login(email, password);
          login(result.token, result.user);
          router.push("/dashboard");
          return;
        } catch (err: any) {
          if (err.message.includes("Password not set")) {
            // User needs magic link
            setStep("magic-link");
            await requestMagicLink();
            return;
          }
          throw err;
        }
      }

      // Check if user exists by requesting magic link
      await requestMagicLink();
    } catch (err: any) {
      setError(err.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const requestMagicLink = async () => {
    try {
      const result = await api.auth.requestMagicLink(email);
      if (result.magicLink) {
        setMagicLink(result.magicLink);
        setStep("magic-link");
      } else {
        setError("Magic link sent to your email (check console in dev mode)");
      }
    } catch (err: any) {
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
            onChange={(e) => setEmail(e.target.value)}
            required
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
        {step === "email" && (
          <button
            type="button"
            onClick={() => setStep("password")}
            className="w-full text-sm text-primary-600 hover:underline"
          >
            I have a password
          </button>
        )}
      </form>
    </div>
  );
}

