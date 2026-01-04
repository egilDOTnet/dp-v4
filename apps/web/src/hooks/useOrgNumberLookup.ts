"use client";

import { useState, useEffect, useRef } from "react";
import { api, BrregCompanyDetails } from "@/lib/api";

interface UseOrgNumberLookupOptions {
  /** Whether the lookup should be enabled (e.g., when a dialog is open) */
  enabled?: boolean;
  /** Callback to update the company name when brreg data is found */
  onNameUpdate?: (name: string) => void;
  /** Callback to update the email domain when brreg data is found */
  onEmailDomainUpdate?: (domain: string) => void;
  /** Callback to update additional data when brreg data is found */
  onAdditionalDataUpdate?: (data: any) => void;
  /** Debounce delay in milliseconds (default: 500) */
  debounceMs?: number;
}

interface UseOrgNumberLookupResult {
  /** The company name from brreg, or null if not found/not looked up */
  brregName: string | null;
  /** Whether a lookup is currently in progress */
  lookingUp: boolean;
  /** Error message if lookup failed */
  error: string | null;
}

/**
 * Hook for looking up Norwegian organization numbers in brreg.no
 * 
 * Automatically debounces input and looks up company information when
 * a valid 9-digit organization number is entered.
 * 
 * @param orgNumber - The organization number to look up (will be cleaned of non-digits)
 * @param options - Configuration options
 * @returns Object with brregName, lookingUp, and error
 */
export function useOrgNumberLookup(
  orgNumber: string,
  options: UseOrgNumberLookupOptions = {}
): UseOrgNumberLookupResult {
  const {
    enabled = true,
    onNameUpdate,
    onEmailDomainUpdate,
    onAdditionalDataUpdate,
    debounceMs = 500,
  } = options;

  const [brregName, setBrregName] = useState<string | null>(null);
  const [lookingUp, setLookingUp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastLookedUpRef = useRef<string>("");
  const callbacksRef = useRef({ onNameUpdate, onEmailDomainUpdate, onAdditionalDataUpdate });

  // Update callbacks ref when they change
  useEffect(() => {
    callbacksRef.current = { onNameUpdate, onEmailDomainUpdate, onAdditionalDataUpdate };
  }, [onNameUpdate, onEmailDomainUpdate, onAdditionalDataUpdate]);

  useEffect(() => {
    if (!enabled) {
      setBrregName(null);
      setError(null);
      lastLookedUpRef.current = "";
      return;
    }

    const cleanOrgNumber = orgNumber.replace(/\D/g, "");
    if (cleanOrgNumber.length !== 9) {
      setBrregName(null);
      setError(null);
      lastLookedUpRef.current = "";
      return;
    }

    // Don't look up if we've already looked up this org number
    if (cleanOrgNumber === lastLookedUpRef.current) {
      return;
    }

    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Set up debounced lookup
    timeoutRef.current = setTimeout(async () => {
      // Check again if we've already looked this up (race condition protection)
      if (cleanOrgNumber === lastLookedUpRef.current) {
        return;
      }
      lastLookedUpRef.current = cleanOrgNumber;

      setLookingUp(true);
      setError(null);
      try {
        const details: BrregCompanyDetails = await api.vendors.getBrregData(cleanOrgNumber);
        setBrregName(details.name);

        // Call optional callbacks to update parent component state
        if (callbacksRef.current.onNameUpdate) {
          callbacksRef.current.onNameUpdate(details.name);
        }

        if (callbacksRef.current.onAdditionalDataUpdate) {
          callbacksRef.current.onAdditionalDataUpdate(details.rawData);
        }

        if (details.website && callbacksRef.current.onEmailDomainUpdate) {
          try {
            const url = new URL(
              details.website.startsWith("http") ? details.website : `https://${details.website}`
            );
            const domain = url.hostname.replace("www.", "");
            callbacksRef.current.onEmailDomainUpdate(domain);
          } catch {
            // Invalid URL, ignore
          }
        }
      } catch (err: any) {
        const errorMessage = err.message || "Failed to look up organization number";
        if (
          errorMessage.includes("not found") ||
          errorMessage.includes("404")
        ) {
          setBrregName(null);
          setError("Organization number not found");
        } else {
          setBrregName(null);
          setError(errorMessage);
          console.error("Error looking up organization number:", err);
        }
      } finally {
        setLookingUp(false);
      }
    }, debounceMs);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [orgNumber, enabled, debounceMs]);

  return { brregName, lookingUp, error };
}
