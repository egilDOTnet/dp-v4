"use client";

import { HeroBanner } from "@/components/HeroBanner";
import { formatISODate } from "@/lib/utils";

interface ParticipationBannerProps {
  onDismiss: () => void;
  acceptanceDate: string | null | undefined;
  isMainContact: boolean;
  mainContactName?: string | null;
}

export function ParticipationBanner({ onDismiss, acceptanceDate, isMainContact, mainContactName }: ParticipationBannerProps) {
  const dateText = acceptanceDate ? formatISODate(acceptanceDate) : "the deadline";
  
  let description: string;
  if (isMainContact) {
    description = `Your company have not yet acknowledged to participate or not. Please remember to do so before ${dateText} to be part of the RFP, and to access all the features (Questions & Answers, Uploading Proposals etc).`;
  } else {
    const mainContactText = mainContactName ? mainContactName : "the main contact";
    description = `Your company have not yet acknowledged to participate or not. Make sure ${mainContactText} does so before ${dateText} to be part of the RFP, and to access all the features (Questions & Answers, Uploading Proposals etc).`;
  }

  return (
    <HeroBanner
      storageKey="rfp-participation-banner"
      title="Reminder to Participate"
      description={description}
      onDismiss={onDismiss}
    />
  );
}


