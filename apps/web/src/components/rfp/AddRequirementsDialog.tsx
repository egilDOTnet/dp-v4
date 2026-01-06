"use client";

import { useState, useEffect } from "react";
import { api, Requirement } from "@/lib/api";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/Dialog";
import { Button } from "@/components/ui/FormField";

interface AddRequirementsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  onConfirm: () => void;
}

export function AddRequirementsDialog({
  open,
  onOpenChange,
  projectId,
  onConfirm,
}: AddRequirementsDialogProps) {
  const [loading, setLoading] = useState(false);
  const [approvedRequirements, setApprovedRequirements] = useState<Requirement[]>([]);
  const [allRequirements, setAllRequirements] = useState<Requirement[]>([]);
  const [bulkApproving, setBulkApproving] = useState(false);

  useEffect(() => {
    if (open && projectId) {
      loadRequirements();
    }
  }, [open, projectId]);

  const loadRequirements = async () => {
    try {
      setLoading(true);
      const [approved, all] = await Promise.all([
        api.requirements.approved(projectId),
        api.requirements.list(projectId),
      ]);
      setApprovedRequirements(approved);
      setAllRequirements(all);
    } catch (err: any) {
      console.error("Error loading requirements:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleBulkApprove = async () => {
    try {
      setBulkApproving(true);
      await api.requirements.bulkApprove(projectId);
      await loadRequirements();
    } catch (err: any) {
      console.error("Error bulk approving requirements:", err);
      alert("Failed to approve requirements. Please try again.");
    } finally {
      setBulkApproving(false);
    }
  };

  const unapprovedCount = allRequirements.length - approvedRequirements.length;
  const hasUnapproved = unapprovedCount > 0;

  const handleConfirm = () => {
    onConfirm();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Requirements Document</DialogTitle>
          <DialogDescription>
            Add a requirements document to your RFP. This will display the list of approved requirements to vendors.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-4 text-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600 mx-auto"></div>
            <p className="mt-2 text-sm text-text-secondary">Loading requirements...</p>
          </div>
        ) : (
          <div className="space-y-4 py-4">
            <div className="bg-background-secondary p-4 rounded-lg border border-border-primary">
              <p className="text-sm text-text-primary font-medium mb-2">
                Approved Requirements: {approvedRequirements.length}
              </p>
              <p className="text-xs text-text-secondary">
                Only approved requirements will be included in the RFP document.
              </p>
            </div>

            {hasUnapproved && (
              <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg border border-yellow-200 dark:border-yellow-800">
                <p className="text-sm text-yellow-800 dark:text-yellow-200 font-medium mb-2">
                  {unapprovedCount} requirement{unapprovedCount !== 1 ? "s" : ""} not yet approved
                </p>
                <p className="text-xs text-yellow-700 dark:text-yellow-300 mb-3">
                  You have {unapprovedCount} requirement{unapprovedCount !== 1 ? "s" : ""} that {unapprovedCount === 1 ? "is" : "are"} not approved. Would you like to mark all requirements as approved?
                </p>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleBulkApprove}
                  disabled={bulkApproving}
                  loading={bulkApproving}
                >
                  Approve All Requirements
                </Button>
              </div>
            )}

            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
              <p className="text-sm text-blue-800 dark:text-blue-200 font-medium mb-1">
                Important Note
              </p>
              <p className="text-xs text-blue-700 dark:text-blue-300">
                Changes to approved requirements will be automatically reflected in the RFP document. Make sure all requirements are finalized before adding them to the RFP.
              </p>
            </div>

            {approvedRequirements.length === 0 && (
              <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg border border-red-200 dark:border-red-800">
                <p className="text-sm text-red-800 dark:text-red-200 font-medium">
                  No approved requirements
                </p>
                <p className="text-xs text-red-700 dark:text-red-300 mt-1">
                  You need at least one approved requirement to create a requirements document.
                </p>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button
            variant="secondary"
            onClick={() => onOpenChange(false)}
            disabled={loading || bulkApproving}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleConfirm}
            disabled={loading || bulkApproving || approvedRequirements.length === 0}
          >
            Add Requirements Document
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}




