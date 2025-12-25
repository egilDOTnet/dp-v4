"use client";

import { useState, useEffect } from "react";
import { api, RFP, RFPScheduleItem } from "@/lib/api";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/Dialog";
import { Button } from "@/components/ui/FormField";

interface PublishRFPDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  rfp: RFP;
  onConfirm: () => void;
}

export function PublishRFPDialog({
  open,
  onOpenChange,
  projectId,
  rfp,
  onConfirm,
}: PublishRFPDialogProps) {
  const [loading, setLoading] = useState(false);
  const [scheduleItems, setScheduleItems] = useState<RFPScheduleItem[]>([]);
  const [vendorsWithRFPFlag, setVendorsWithRFPFlag] = useState(0);

  useEffect(() => {
    if (open && projectId) {
      loadScheduleItems();
    }
  }, [open, projectId]);

  const loadScheduleItems = async () => {
    try {
      setLoading(true);
      const [items, vendorsData] = await Promise.all([
        api.rfp.schedule.list(projectId),
        api.projects.vendors.list(projectId),
      ]);
      setScheduleItems(items);
      // Count vendors marked as shallReceiveRFP
      const count = vendorsData.filter((pv) => pv.vendor.shallReceiveRFP).length;
      setVendorsWithRFPFlag(count);
    } catch (err: any) {
      console.error("Error loading schedule items:", err);
    } finally {
      setLoading(false);
    }
  };

  // Validate requirements
  const hasContactPerson = rfp.contactPersonId !== null;
  
  // Check required schedule dates (skip StartDate as it will be set automatically)
  const requiredItems = scheduleItems.filter(
    (item) => item.isRequired && item.type !== "StartDate"
  );
  const missingDates = requiredItems.filter((item) => !item.date);
  const allDatesSet = missingDates.length === 0;

  // Check that at least one vendor is marked to receive RFP
  const hasVendorsWithRFPFlag = vendorsWithRFPFlag > 0;

  const canPublish = hasContactPerson && allDatesSet && hasVendorsWithRFPFlag;

  const handleConfirm = () => {
    onConfirm();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Publish RFP</DialogTitle>
          <DialogDescription>
            Publishing the RFP will set the start date to the current time. Make sure all requirements are met before publishing.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-4 text-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600 mx-auto"></div>
            <p className="mt-2 text-sm text-text-secondary">Loading requirements...</p>
          </div>
        ) : (
          <div className="space-y-4 py-4">
            {/* Contact Person Status */}
            {hasContactPerson ? (
              <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-green-200 dark:border-green-800">
                <p className="text-sm text-green-800 dark:text-green-200 font-medium mb-1">
                  ✓ Main contact person assigned
                </p>
                {rfp.contactPerson && (
                  <p className="text-xs text-green-700 dark:text-green-300">
                    {rfp.contactPerson.name || 
                     `${rfp.contactPerson.firstName || ""} ${rfp.contactPerson.lastName || ""}`.trim() || 
                     rfp.contactPerson.email}
                  </p>
                )}
              </div>
            ) : (
              <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg border border-red-200 dark:border-red-800">
                <p className="text-sm text-red-800 dark:text-red-200 font-medium mb-1">
                  Main contact person not assigned
                </p>
                <p className="text-xs text-red-700 dark:text-red-300">
                  A main contact person must be assigned before publishing the RFP.
                </p>
              </div>
            )}

            {/* Required Dates Status */}
            {allDatesSet ? (
              <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-green-200 dark:border-green-800">
                <p className="text-sm text-green-800 dark:text-green-200 font-medium mb-1">
                  ✓ All required dates are set
                </p>
                <p className="text-xs text-green-700 dark:text-green-300">
                  {requiredItems.length} required date{requiredItems.length !== 1 ? "s" : ""} configured.
                </p>
              </div>
            ) : (
              <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg border border-red-200 dark:border-red-800">
                <p className="text-sm text-red-800 dark:text-red-200 font-medium mb-2">
                  Missing required dates
                </p>
                <p className="text-xs text-red-700 dark:text-red-300 mb-2">
                  The following required dates must be set before publishing:
                </p>
                <ul className="text-xs text-red-700 dark:text-red-300 list-disc list-inside space-y-1">
                  {missingDates.map((item) => (
                    <li key={item.id}>{item.description}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Vendors with RFP Flag Status */}
            {hasVendorsWithRFPFlag ? (
              <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-green-200 dark:border-green-800">
                <p className="text-sm text-green-800 dark:text-green-200 font-medium mb-1">
                  ✓ At least one vendor marked as 'shall receive RFP'
                </p>
                <p className="text-xs text-green-700 dark:text-green-300">
                  {vendorsWithRFPFlag} vendor{vendorsWithRFPFlag !== 1 ? "s" : ""} {vendorsWithRFPFlag === 1 ? "is" : "are"} marked to receive the RFP.
                </p>
              </div>
            ) : (
              <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg border border-red-200 dark:border-red-800">
                <p className="text-sm text-red-800 dark:text-red-200 font-medium mb-1">
                  No vendors marked as 'shall receive RFP'
                </p>
                <p className="text-xs text-red-700 dark:text-red-300">
                  At least one vendor must be marked as 'shall receive RFP' before publishing the RFP.
                </p>
              </div>
            )}

            {/* Info Box */}
            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
              <p className="text-sm text-blue-800 dark:text-blue-200 font-medium mb-1">
                Important Note
              </p>
              <p className="text-xs text-blue-700 dark:text-blue-300">
                Publishing the RFP this way instead of letting it auto-publish at the given start date, will set the start date to the current time.
              </p>
            </div>

            {/* Success Message */}
            {canPublish && (
              <div className="bg-background-secondary p-4 rounded-lg border border-border-primary">
                <p className="text-sm text-text-primary font-medium mb-1">
                  Ready to publish
                </p>
                <p className="text-xs text-text-secondary">
                  All requirements are met. You can proceed with publishing the RFP.
                </p>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button
            variant="secondary"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleConfirm}
            disabled={loading || !canPublish}
          >
            Publish RFP
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

