"use client";

import React from "react";
import { DismissibleBanner } from "@/components/ui/Collapsible";

interface HeroBannerProps {
  /** Unique key for localStorage persistence (e.g., "dashboard-hero-banner") */
  storageKey: string;
  /** Banner title */
  title: string;
  /** Main description text (can include JSX/strong tags) */
  description: React.ReactNode;
  /** Array of feature bullet points */
  features?: Array<{
    /** Feature label (bold text) */
    label: string;
    /** Feature description */
    description: string;
  }>;
  /** Tip text (optional) */
  tip?: React.ReactNode;
  /** Dismiss button text */
  dismissText?: string;
  /** Callback when dismissed */
  onDismiss?: () => void;
}

export function HeroBanner({
  storageKey,
  title,
  description,
  features,
  tip,
  dismissText = "Understood",
  onDismiss,
}: HeroBannerProps) {
  return (
    <div className="mb-6">
      <DismissibleBanner
        storageKey={storageKey}
        variant="hero"
        dismissText={dismissText}
        onDismiss={onDismiss}
      >
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 w-12 h-12 bg-accent-600 rounded-full flex items-center justify-center">
            <svg
              className="w-6 h-6 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-text-primary mb-2">{title}</h3>
            <div className="text-text-primary mb-3">{description}</div>
            {features && features.length > 0 && (
              <>
                <p className="text-text-primary mb-3">
                  <strong>Here's what you can do:</strong>
                </p>
                <ul className="list-disc list-inside text-text-primary space-y-1 mb-4 ml-2">
                  {features.map((feature, index) => (
                    <li key={index}>
                      <strong>{feature.label}:</strong> {feature.description}
                    </li>
                  ))}
                </ul>
              </>
            )}
            {tip && (
              <div className="bg-white dark:bg-gray-800 border border-accent-300 dark:border-accent-700 rounded-md p-3 shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="text-3xl flex-shrink-0">💡</div>
                  <div className="flex-1 text-sm text-text-primary italic">{tip}</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </DismissibleBanner>
    </div>
  );
}

