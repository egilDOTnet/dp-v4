"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { SlideOver } from "./ui/SlideOver";
import { FormField, Input, Checkbox, Button } from "./ui/FormField";
import { ConfirmDialog } from "./ui/Dialog";
import { VendorContactPerson } from "@/lib/api";

interface ContactPersonFormDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when dialog should close */
  onClose: () => void;
  /** Vendor name for context */
  vendorName: string;
  /** Existing contact data for edit mode */
  existingContact?: VendorContactPerson;
  /** Whether this is the first contact being added */
  isFirstContact: boolean;
  /** Callback when contact is saved */
  onSave: (data: {
    firstName: string;
    lastName: string;
    email: string;
    isMainContact?: boolean;
  }) => Promise<void>;
  /** Callback when contact is deleted */
  onDelete?: () => Promise<void>;
}

export function ContactPersonFormDialog({
  open,
  onClose,
  vendorName,
  existingContact,
  isFirstContact,
  onSave,
  onDelete,
}: ContactPersonFormDialogProps) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [isMainContact, setIsMainContact] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  
  const firstNameRef = useRef<HTMLInputElement>(null);

  const isEditing = !!existingContact;

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (open) {
      if (existingContact) {
        setFirstName(existingContact.firstName);
        setLastName(existingContact.lastName);
        setEmail(existingContact.email);
        setIsMainContact(existingContact.isMainContact);
      } else {
        setFirstName("");
        setLastName("");
        setEmail("");
        setIsMainContact(isFirstContact);
      }
      setError("");
      
      // Focus the first name input
      setTimeout(() => {
        firstNameRef.current?.focus();
      }, 100);
    }
  }, [open, existingContact, isFirstContact]);

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleSubmit = useCallback(async () => {
    setError("");

    // Validation
    if (!firstName.trim()) {
      setError("First name is required");
      return;
    }

    if (!lastName.trim()) {
      setError("Last name is required");
      return;
    }

    if (!email.trim()) {
      setError("Email is required");
      return;
    }

    if (!validateEmail(email)) {
      setError("Please enter a valid email address");
      return;
    }

    setSubmitting(true);
    try {
      await onSave({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim().toLowerCase(),
        isMainContact,
      });
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to save contact");
    } finally {
      setSubmitting(false);
    }
  }, [firstName, lastName, email, isMainContact, onSave, onClose]);

  const handleDelete = useCallback(async () => {
    if (!onDelete) return;
    
    setDeleting(true);
    try {
      await onDelete();
      setShowDeleteConfirm(false);
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to delete contact");
    } finally {
      setDeleting(false);
    }
  }, [onDelete, onClose]);

  return (
    <>
      <SlideOver
        open={open}
        onClose={onClose}
        title={isEditing ? "Edit Contact" : "Add Contact"}
        description={`${isEditing ? "Update" : "Add"} contact person for ${vendorName}`}
        size="sm"
        footer={
          <div className="flex flex-col-reverse sm:flex-row sm:justify-between w-full gap-2">
            {isEditing && onDelete && (
              <Button
                variant="danger"
                onClick={() => setShowDeleteConfirm(true)}
                disabled={deleting || submitting}
              >
                Delete
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
                {isEditing ? "Update" : "Add"}
              </Button>
            </div>
          </div>
        }
      >
        <div className="space-y-4">
          <FormField label="First Name" required>
            <Input
              ref={firstNameRef}
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="Enter first name"
              hasError={!firstName.trim() && !!error}
            />
          </FormField>

          <FormField label="Last Name" required>
            <Input
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Enter last name"
              hasError={!lastName.trim() && !!error}
            />
          </FormField>

          <FormField label="Email" required>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="contact@company.com"
              hasError={!email.trim() && !!error}
            />
          </FormField>

          {/* Only show main contact checkbox if not the first contact */}
          {!isFirstContact && (
            <Checkbox
              checked={isMainContact}
              onChange={(e) => setIsMainContact(e.target.checked)}
              label="Set as main contact"
            />
          )}

          {isFirstContact && (
            <p className="text-sm text-gray-500 dark:text-gray-400 italic">
              This will be set as the main contact automatically.
            </p>
          )}

          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-3">
              <p className="text-sm text-red-800 dark:text-red-200 font-medium">{error}</p>
            </div>
          )}
        </div>
      </SlideOver>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDelete}
        title="Delete Contact"
        message={`Are you sure you want to delete "${existingContact?.firstName} ${existingContact?.lastName}"? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
        loading={deleting}
      />
    </>
  );
}
