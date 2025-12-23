"use client";

import { RFPDetail } from "@/lib/api";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, Button } from "@/components/ui";
import { formatISODate } from "@/lib/utils";

interface ParticipateModalProps {
  rfp: RFPDetail;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ParticipateModal({ rfp, onConfirm, onCancel }: ParticipateModalProps) {
  const deliveryDate = rfp.scheduleItems.find((item) => item.type === "DeliveryDate")?.date;

  return (
    <Dialog open={true} onClose={onCancel}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirm Participation</DialogTitle>
          <DialogDescription>
            By clicking OK, you agree to return with an offer at latest within {deliveryDate ? formatISODate(deliveryDate) : "the deadline for delivery"}.
          </DialogDescription>
        </DialogHeader>
        <div className="mt-4 space-y-2">
          <p className="text-sm text-text-secondary">
            By participating, you will get access to all parts of the RFP, including Questions & Answers, Documents, and the ability to upload your proposal.
          </p>
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={onConfirm}>OK</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


