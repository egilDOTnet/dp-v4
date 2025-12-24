"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { SlideOver } from "./ui/SlideOver";
import { FormField, Input, Button } from "./ui/FormField";
import { ConfirmDialog } from "./ui/Dialog";
import { Project } from "@/lib/api";

interface ProjectFormDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when dialog should close */
  onClose: () => void;
  /** Existing project data for edit mode */
  existingProject?: Project;
  /** Callback when project is saved */
  onSave: (data: {
    name: string;
    type?: string;
    startDate?: string;
    endDate?: string;
  }) => Promise<void>;
  /** Callback when project is deleted */
  onDelete?: () => Promise<void>;
}

export function ProjectFormDialog({
  open,
  onClose,
  existingProject,
  onSave,
  onDelete,
}: ProjectFormDialogProps) {
  const [name, setName] = useState("");
  const [type, setType] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  
  const nameRef = useRef<HTMLInputElement>(null);

  const isEditing = !!existingProject;

  // Get current date in YYYY-MM-DD format
  const getCurrentDate = () => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  };

  // Format date for input
  const formatDateForInput = (dateString: string | null | undefined): string => {
    if (!dateString) return "";
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "";
    return date.toISOString().split("T")[0];
  };

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (open) {
      if (existingProject) {
        setName(existingProject.name);
        setType(existingProject.type || "");
        setStartDate(formatDateForInput(existingProject.startDate));
        setEndDate(formatDateForInput(existingProject.endDate));
      } else {
        setName("");
        setType("");
        setStartDate(getCurrentDate());
        setEndDate("");
      }
      setError("");
      
      // Focus the name input
      setTimeout(() => {
        nameRef.current?.focus();
      }, 100);
    }
  }, [open, existingProject]);

  const handleSubmit = useCallback(async () => {
    setError("");

    if (!name.trim()) {
      setError("Project name is required");
      return;
    }

    setSubmitting(true);
    try {
      await onSave({
        name: name.trim(),
        type: type.trim() || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      });
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to save project");
    } finally {
      setSubmitting(false);
    }
  }, [name, type, startDate, endDate, onSave, onClose]);

  const handleDelete = useCallback(async () => {
    if (!onDelete) return;
    
    setDeleting(true);
    try {
      await onDelete();
      setShowDeleteConfirm(false);
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to delete project");
    } finally {
      setDeleting(false);
    }
  }, [onDelete, onClose]);

  return (
    <>
      <SlideOver
        open={open}
        onClose={onClose}
        title={isEditing ? "Edit Project" : "Create Project"}
        description={isEditing ? "Update project details" : "Create a new procurement project"}
        size="md"
        footer={
          <div className="flex flex-col-reverse sm:flex-row sm:justify-between w-full gap-2">
            {isEditing && onDelete && (
              <Button
                variant="danger"
                onClick={() => setShowDeleteConfirm(true)}
                disabled={deleting || submitting}
              >
                Delete Project
              </Button>
            )}
            
            <div className="flex flex-col-reverse sm:flex-row gap-2 sm:ml-auto">
              <Button
                variant="secondary"
                onClick={onClose}
                disabled={submitting || deleting}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleSubmit}
                loading={submitting}
                disabled={deleting}
              >
                {isEditing ? "Save Changes" : "Create Project"}
              </Button>
            </div>
          </div>
        }
      >
        <div className="space-y-4">
          <FormField label="Project Name" required>
            <Input
              ref={nameRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter project name"
              hasError={!name.trim() && !!error}
            />
          </FormField>

          <FormField
            label="Type"
            helperText="E.g., CRM system, ERP implementation"
          >
            <Input
              type="text"
              value={type}
              onChange={(e) => setType(e.target.value)}
              placeholder="e.g., CRM system"
            />
          </FormField>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Start Date">
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </FormField>

            <FormField label="End Date">
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                min={startDate || undefined}
              />
            </FormField>
          </div>

          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-3">
              <p className="text-sm text-red-800 dark:text-red-200 font-medium">{error}</p>
            </div>
          )}
        </div>
      </SlideOver>

      {/* Delete Confirmation */}
      {isEditing && (
        <ConfirmDialog
          open={showDeleteConfirm}
          onClose={() => setShowDeleteConfirm(false)}
          onConfirm={handleDelete}
          title="Delete Project"
          message={`Are you sure you want to delete "${existingProject?.name}"? This will permanently remove all associated data including phases, tasks, requirements, and vendor information. This action cannot be undone.`}
          confirmText="Delete Project"
          cancelText="Cancel"
          variant="danger"
          loading={deleting}
        />
      )}
    </>
  );
}
