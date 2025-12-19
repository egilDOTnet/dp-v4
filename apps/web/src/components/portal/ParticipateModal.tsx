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
            By clicking OK, you agree to return with an offer before {deliveryDate ? formatISODate(deliveryDate) : "the delivery date"}.
          </DialogDescription>
        </DialogHeader>
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
