"use client";

import { useState, useEffect } from "react";
import { api, RFI } from "@/lib/api";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/Dialog";
import { Button } from "@/components/ui/FormField";

interface PublishRFIDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  rfi: RFI;
  onConfirm: () => void;
}

export function PublishRFIDialog({
  open,
  onOpenChange,
  projectId,
  rfi,
  onConfirm,
}: PublishRFIDialogProps) {
  const [loading, setLoading] = useState(false);
  const [vendorsWithRFIFlag, setVendorsWithRFIFlag] = useState(0);

  useEffect(() => {
    if (open && projectId) {
      loadVendors();
    }
  }, [open, projectId]);

  const loadVendors = async () => {
    try {
      setLoading(true);
      const vendorsData = await api.projects.vendors.list(projectId);
      // Count vendors marked as shallReceiveRFI
      const count = vendorsData.filter((pv) => pv.vendor.shallReceiveRFI).length;
      setVendorsWithRFIFlag(count);
    } catch (err: any) {
      console.error("Error loading vendors:", err);
    } finally {
      setLoading(false);
    }
  };

  // Validate requirements
  const hasDeadline = rfi.deadline !== null;
  const hasQuestions = rfi.questions && rfi.questions.length > 0;
  const hasVendorsWithRFIFlag = vendorsWithRFIFlag > 0;

  const canPublish = hasDeadline && hasQuestions && hasVendorsWithRFIFlag;

  const handleConfirm = () => {
    onConfirm();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Publish RFI</DialogTitle>
          <DialogDescription>
            Publishing the RFI will send it to all vendors marked as 'shall receive RFI'. Make sure all requirements are met before publishing.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-4 text-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600 mx-auto"></div>
            <p className="mt-2 text-sm text-text-secondary">Loading requirements...</p>
          </div>
        ) : (
          <div className="space-y-4 py-4">
            {/* Deadline Status */}
            {hasDeadline ? (
              <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-green-200 dark:border-green-800">
                <p className="text-sm text-green-800 dark:text-green-200 font-medium mb-1">
                  ✓ Deadline is set
                </p>
                <p className="text-xs text-green-700 dark:text-green-300">
                  Deadline: {new Date(rfi.deadline!).toLocaleDateString()}
                </p>
              </div>
            ) : (
              <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg border border-red-200 dark:border-red-800">
                <p className="text-sm text-red-800 dark:text-red-200 font-medium mb-1">
                  Deadline not set
                </p>
                <p className="text-xs text-red-700 dark:text-red-300">
                  A deadline must be set before publishing the RFI.
                </p>
              </div>
            )}

            {/* Questions Status */}
            {hasQuestions ? (
              <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-green-200 dark:border-green-800">
                <p className="text-sm text-green-800 dark:text-green-200 font-medium mb-1">
                  ✓ At least one question exists
                </p>
                <p className="text-xs text-green-700 dark:text-green-300">
                  {rfi.questions?.length || 0} question{(rfi.questions?.length || 0) !== 1 ? "s" : ""} configured.
                </p>
              </div>
            ) : (
              <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg border border-red-200 dark:border-red-800">
                <p className="text-sm text-red-800 dark:text-red-200 font-medium mb-1">
                  No questions added
                </p>
                <p className="text-xs text-red-700 dark:text-red-300">
                  At least one question must be added before publishing the RFI.
                </p>
              </div>
            )}

            {/* Vendors with RFI Flag Status */}
            {hasVendorsWithRFIFlag ? (
              <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-green-200 dark:border-green-800">
                <p className="text-sm text-green-800 dark:text-green-200 font-medium mb-1">
                  ✓ At least one vendor marked as 'shall receive RFI'
                </p>
                <p className="text-xs text-green-700 dark:text-green-300">
                  {vendorsWithRFIFlag} vendor{vendorsWithRFIFlag !== 1 ? "s" : ""} {vendorsWithRFIFlag === 1 ? "is" : "are"} marked to receive the RFI.
                </p>
              </div>
            ) : (
              <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg border border-red-200 dark:border-red-800">
                <p className="text-sm text-red-800 dark:text-red-200 font-medium mb-1">
                  No vendors marked as 'shall receive RFI'
                </p>
                <p className="text-xs text-red-700 dark:text-red-300">
                  At least one vendor must be marked as 'shall receive RFI' before publishing the RFI.
                </p>
              </div>
            )}

            {/* Success Message */}
            {canPublish && (
              <div className="bg-background-secondary p-4 rounded-lg border border-border-primary">
                <p className="text-sm text-text-primary font-medium mb-1">
                  Ready to publish
                </p>
                <p className="text-xs text-text-secondary">
                  All requirements are met. You can proceed with publishing the RFI.
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
            Publish RFI
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

