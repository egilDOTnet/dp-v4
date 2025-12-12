"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui";
import WysiwygEditor from "@/components/WysiwygEditor";

interface CreateAnnouncementModalProps {
  projectId: string;
  onClose: () => void;
}

export default function CreateAnnouncementModal({
  projectId,
  onClose,
}: CreateAnnouncementModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSave = async () => {
    try {
      setSaving(true);
      setError("");

      if (!title.trim()) {
        setError("Title is required");
        return;
      }
      if (!description.trim()) {
        setError("Description is required");
        return;
      }

      await api.rfp.announcements.create(projectId, {
        title: title.trim(),
        description,
      });

      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to create announcement");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New Announcement</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1">
              Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-border-primary rounded-md bg-background-tertiary text-text-primary"
              placeholder="Enter announcement title..."
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1">
              Description *
            </label>
            <WysiwygEditor
              value={description}
              onChange={setDescription}
              placeholder="Enter announcement description..."
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
              {saving ? "Creating..." : "Create Announcement"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

