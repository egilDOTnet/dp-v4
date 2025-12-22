"use client";

import { HeroBanner } from "@/components/HeroBanner";
import { formatISODate } from "@/lib/utils";

interface ParticipationBannerProps {
  onDismiss: () => void;
  acceptanceDate: string | null | undefined;
}

export function ParticipationBanner({ onDismiss, acceptanceDate }: ParticipationBannerProps) {
  return (
    <HeroBanner
      storageKey="rfp-participation-banner"
      title="Reminder to Participate"
      description={`Please participate before ${acceptanceDate ? formatISODate(acceptanceDate) : "the deadline"} to access all RFP features.`}
      onDismiss={onDismiss}
    />
  );
}

