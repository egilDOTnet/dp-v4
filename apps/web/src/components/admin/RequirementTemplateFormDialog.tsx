"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { SlideOver } from "../ui/SlideOver";
import { FormField, Input, Button, Textarea } from "../ui/FormField";

interface RequirementTemplate {
  id: string;
  shortName: string;
  description?: string | null;
  languageCode: string;
  createdAt: string;
  updatedAt: string;
  createdBy: {
    id: string;
    email: string;
    name?: string | null;
  };
}

interface RequirementTemplateFormDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when dialog should close */
  onClose: () => void;
  /** Existing template data for edit mode */
  existingTemplate?: RequirementTemplate;
  /** Callback when template is saved */
  onSave: (data: {
    shortName: string;
    description?: string;
    languageCode: string;
  }) => Promise<void>;
  /** Callback when template is deleted */
  onDelete?: () => Promise<void>;
}

export function RequirementTemplateFormDialog({
  open,
  onClose,
  existingTemplate,
  onSave,
  onDelete: _onDelete,
}: RequirementTemplateFormDialogProps) {
  const [shortName, setShortName] = useState("");
  const [description, setDescription] = useState("");
  const [languageCode, setLanguageCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const shortNameRef = useRef<HTMLInputElement>(null);

  const isEditing = !!existingTemplate;

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (open) {
      if (existingTemplate) {
        setShortName(existingTemplate.shortName);
        setDescription(existingTemplate.description || "");
        setLanguageCode(existingTemplate.languageCode);
      } else {
        setShortName("");
        setDescription("");
        setLanguageCode("");
      }
      setError("");

      // Focus the short name input
      setTimeout(() => {
        shortNameRef.current?.focus();
      }, 100);
    }
  }, [open, existingTemplate]);

  // Validate ISO 639-1 language code (2 letters, lowercase)
  const isValidLanguageCode = (code: string): boolean => {
    if (!code.trim()) return false; // Required field
    const codeRegex = /^[a-z]{2}$/;
    return codeRegex.test(code.trim().toLowerCase());
  };

  const handleSubmit = useCallback(async () => {
    setError("");

    // Validate short name
    if (!shortName.trim()) {
      setError("Short name is required");
      return;
    }

    // Validate language code (required)
    if (!languageCode.trim()) {
      setError("Language code is required");
      return;
    }

    // Validate language code format
    if (!isValidLanguageCode(languageCode)) {
      setError("Language code must be a valid ISO 639-1 code (2 lowercase letters, e.g., 'en', 'no', 'sv')");
      return;
    }

    setSubmitting(true);
    try {
      await onSave({
        shortName: shortName.trim(),
        description: description.trim() || undefined,
        languageCode: languageCode.trim(),
      });
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to save template");
    } finally {
      setSubmitting(false);
    }
  }, [shortName, description, languageCode, onSave, onClose]);


  return (
    <>
      <SlideOver
        open={open}
        onClose={onClose}
        title={isEditing ? "Edit Requirement Template" : "Create Requirement Template"}
        description={
          isEditing
            ? "Update requirement template information"
            : "Create a new requirement template"
        }
        size="md"
        footer={
          <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end w-full">
            <Button
              variant="secondary"
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleSubmit}
              loading={submitting}
            >
              {isEditing ? "Save Changes" : "Create Template"}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <FormField label="Short Name" required>
            <Input
              ref={shortNameRef}
              type="text"
              value={shortName}
              onChange={(e) => setShortName(e.target.value)}
              placeholder="e.g., ISO27001, GDPR"
              hasError={!shortName.trim() && !!error}
            />
          </FormField>

          <FormField label="Description">
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Template description"
              rows={4}
            />
          </FormField>

          <FormField
            label="Language Code (ISO 639-1)"
            required
            helperText="Language code for this template version (e.g., 'en' for English, 'no' for Norwegian, 'sv' for Swedish)"
          >
            <Input
              type="text"
              value={languageCode}
              onChange={(e) => setLanguageCode(e.target.value.toLowerCase())}
              placeholder="e.g., en, no, sv"
              maxLength={2}
              hasError={(!languageCode.trim() || !isValidLanguageCode(languageCode)) && !!error}
            />
          </FormField>

          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-3">
              <p className="text-sm text-red-800 dark:text-red-200 font-medium">
                {error}
              </p>
            </div>
          )}
        </div>
      </SlideOver>
    </>
  );
}

