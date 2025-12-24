"use client";

import { useState, useEffect } from "react";
import { VendorContactPerson } from "@/lib/api";

interface ContactPersonFormProps {
  vendorId: string;
  vendorName: string;
  existingContact?: VendorContactPerson;
  isFirstContact: boolean;
  onSubmit: (data: {
    firstName: string;
    lastName: string;
    email: string;
    isMainContact?: boolean;
  }) => Promise<void>;
  onCancel: () => void;
  onDelete?: () => Promise<void>;
}

export default function ContactPersonForm({
  vendorId: _vendorId,
  vendorName: _vendorName,
  existingContact,
  isFirstContact,
  onSubmit,
  onCancel,
  onDelete,
}: ContactPersonFormProps) {
  const [formData, setFormData] = useState({
    firstName: existingContact?.firstName || "",
    lastName: existingContact?.lastName || "",
    email: existingContact?.email || "",
    isMainContact: existingContact?.isMainContact ?? isFirstContact,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Update form when existingContact changes
  useEffect(() => {
    if (existingContact) {
      setFormData({
        firstName: existingContact.firstName,
        lastName: existingContact.lastName,
        email: existingContact.email,
        isMainContact: existingContact.isMainContact,
      });
    }
  }, [existingContact]);

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Validation
    if (!formData.firstName.trim()) {
      setError("First name is required");
      return;
    }

    if (!formData.lastName.trim()) {
      setError("Last name is required");
      return;
    }

    if (!formData.email.trim()) {
      setError("Email is required");
      return;
    }

    if (!validateEmail(formData.email)) {
      setError("Please enter a valid email address");
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit({
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        email: formData.email.trim().toLowerCase(),
        isMainContact: formData.isMainContact,
      });
    } catch (err: any) {
      setError(err.message || "Failed to save contact");
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-1">
            First Name *
          </label>
          <input
            id="firstName"
            type="text"
            value={formData.firstName}
            onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
            onKeyDown={(e) => {
              // Handle Ctrl-A/Command-A to select all text
              if ((e.metaKey || e.ctrlKey) && e.key === "a") {
                e.preventDefault();
                e.currentTarget.select();
                return;
              }
            }}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>

        <div>
          <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-1">
            Last Name *
          </label>
          <input
            id="lastName"
            type="text"
            value={formData.lastName}
            onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
            onKeyDown={(e) => {
              // Handle Ctrl-A/Command-A to select all text
              if ((e.metaKey || e.ctrlKey) && e.key === "a") {
                e.preventDefault();
                e.currentTarget.select();
                return;
              }
            }}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>

        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
            Email *
          </label>
          <input
            id="email"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            onKeyDown={(e) => {
              // Handle Ctrl-A/Command-A to select all text
              if ((e.metaKey || e.ctrlKey) && e.key === "a") {
                e.preventDefault();
                e.currentTarget.select();
                return;
              }
            }}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>

        {/* Only show main contact checkbox if not the first contact */}
        {!isFirstContact && (
          <div className="flex items-center">
            <input
              id="isMainContact"
              type="checkbox"
              checked={formData.isMainContact}
              onChange={(e) => setFormData({ ...formData, isMainContact: e.target.checked })}
              className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
            />
            <label htmlFor="isMainContact" className="ml-2 block text-sm text-gray-900">
              Set as main contact
            </label>
          </div>
        )}

        {isFirstContact && (
          <p className="text-sm text-gray-500 italic">
            This will be set as the main contact automatically.
          </p>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-3">
            <p className="text-sm text-red-800 font-medium">{error}</p>
          </div>
        )}

        <div className="flex gap-2 pt-2">
          <button
            type="submit"
            disabled={submitting}
            className="px-3 py-1.5 text-sm font-medium bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50"
          >
            {submitting ? "Saving..." : existingContact ? "Update" : "Add"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1.5 text-sm font-medium border border-border-primary rounded-md hover:bg-background-primary"
          >
            Cancel
          </button>
          {existingContact && onDelete && (
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              disabled={deleting}
              className="px-3 py-1.5 text-sm font-medium bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 ml-auto"
            >
              Delete
            </button>
          )}
        </div>

        {/* Delete Confirmation Dialog */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-background-tertiary rounded-lg shadow-lg p-6 max-w-md w-full mx-4">
              <h3 className="text-lg font-semibold mb-4">Delete Contact</h3>
              <p className="text-gray-700 mb-6">
                Are you sure you want to delete "{existingContact?.firstName} {existingContact?.lastName}"? This action cannot be undone.
              </p>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={deleting}
                  className="px-4 py-2 text-sm font-medium border border-border-primary rounded-md hover:bg-background-primary disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    if (!onDelete) return;
                    setDeleting(true);
                    try {
                      await onDelete();
                      setShowDeleteConfirm(false);
                    } catch (err: any) {
                      setError(err.message || "Failed to delete contact");
                      setDeleting(false);
                      setShowDeleteConfirm(false);
                    }
                  }}
                  disabled={deleting}
                  className="px-4 py-2 text-sm font-medium bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
                >
                  {deleting ? "Deleting..." : "Delete"}
                </button>
              </div>
            </div>
          </div>
        )}
      </form>
  );
}

