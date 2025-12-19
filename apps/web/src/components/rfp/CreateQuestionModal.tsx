"use client";

import { useState } from "react";
import { api, ProjectVendor } from "@/lib/api";
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui";

interface CreateQuestionModalProps {
  projectId: string;
  vendors: ProjectVendor[];
  onClose: () => void;
}

export default function CreateQuestionModal({
  projectId,
  vendors,
  onClose,
}: CreateQuestionModalProps) {
  const [question, setQuestion] = useState("");
  const [vendorId, setVendorId] = useState("");
  const [contactPersonId, setContactPersonId] = useState("");
  const [createdAt, setCreatedAt] = useState(new Date().toISOString().slice(0, 16));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const selectedVendor = vendors.find((v) => v.vendorId === vendorId);
  const availableContacts = selectedVendor?.vendor.contacts || [];

  const handleSave = async () => {
    try {
      setSaving(true);
      setError("");

      if (!question.trim()) {
        setError("Question is required");
        return;
      }
      if (!vendorId) {
        setError("Vendor is required");
        return;
      }
      if (!contactPersonId) {
        setError("Contact person is required");
        return;
      }

      await api.rfp.questions.create(projectId, {
        question: question.trim(),
        vendorId,
        contactPersonId,
        createdAt: new Date(createdAt).toISOString(),
      });

      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to create question");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add Question Manually</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1">
              Question *
            </label>
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => {
                // Handle Ctrl-A/Command-A to select all text
                if ((e.metaKey || e.ctrlKey) && e.key === "a") {
                  e.preventDefault();
                  e.currentTarget.select();
                  return;
                }
              }}
              rows={4}
              className="w-full px-3 py-2 border border-border-primary rounded-md bg-background-tertiary text-text-primary"
              placeholder="Enter question text..."
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1">
              Vendor *
            </label>
            <select
              value={vendorId}
              onChange={(e) => {
                setVendorId(e.target.value);
                setContactPersonId(""); // Reset contact when vendor changes
              }}
              className="w-full px-3 py-2 border border-border-primary rounded-md bg-background-tertiary text-text-primary"
            >
              <option value="">Select vendor</option>
              {vendors.map((pv) => (
                <option key={pv.id} value={pv.vendorId}>
                  {pv.vendor.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1">
              Contact Person *
            </label>
            <select
              value={contactPersonId}
              onChange={(e) => setContactPersonId(e.target.value)}
              disabled={!vendorId}
              className="w-full px-3 py-2 border border-border-primary rounded-md bg-background-tertiary text-text-primary disabled:opacity-50"
            >
              <option value="">Select contact person</option>
              {availableContacts.map((contact) => (
                <option key={contact.id} value={contact.id}>
                  {contact.firstName} {contact.lastName} ({contact.email})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1">
              Date/Time
            </label>
            <input
              type="datetime-local"
              value={createdAt}
              onChange={(e) => setCreatedAt(e.target.value)}
              className="w-full px-3 py-2 border border-border-primary rounded-md bg-background-tertiary text-text-primary"
            />
          </div>
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}
          <div className="flex gap-2 justify-end">
            <Button onClick={onClose} variant="secondary" size="sm">
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving} variant="primary" size="sm">
              {saving ? "Creating..." : "Create Question"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

