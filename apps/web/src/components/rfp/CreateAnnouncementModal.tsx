"use client";

import { useState, useEffect } from "react";
import { api, RFPAnnouncement } from "@/lib/api";
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui";
import WysiwygEditor from "@/components/WysiwygEditor";

interface CreateAnnouncementModalProps {
  projectId: string;
  announcement?: RFPAnnouncement;
  onClose: () => void;
}

export default function CreateAnnouncementModal({
  projectId,
  announcement,
  onClose,
}: CreateAnnouncementModalProps) {
  const isEditMode = !!announcement;
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [sendImmediately, setSendImmediately] = useState(true);
  const [scheduledSendAt, setScheduledSendAt] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  // Initialize form when announcement is provided (edit mode)
  useEffect(() => {
    if (announcement) {
      setTitle(announcement.title);
      setDescription(announcement.description);
      // If announcement is sent, disable form
      if (announcement.sentAt) {
        setSendImmediately(true);
        setScheduledSendAt("");
      } else {
        // Check if there's a scheduled send time
        if (announcement.scheduledSendAt) {
          setSendImmediately(false);
          // Convert ISO datetime to datetime-local format
          const scheduledDate = new Date(announcement.scheduledSendAt);
          const localDatetime = new Date(scheduledDate.getTime() - scheduledDate.getTimezoneOffset() * 60000)
            .toISOString()
            .slice(0, 16);
          setScheduledSendAt(localDatetime);
        } else {
          setSendImmediately(true);
          setScheduledSendAt("");
        }
      }
    }
  }, [announcement]);

  const getMinDatetime = () => {
    const now = new Date();
    const localDatetime = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
    return localDatetime;
  };

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

      if (!sendImmediately && !scheduledSendAt) {
        setError("Please select a date and time for scheduled sending");
        return;
      }

      // Validate that scheduled time is not in the past
      if (!sendImmediately && scheduledSendAt) {
        const scheduledDate = new Date(scheduledSendAt);
        const now = new Date();
        if (scheduledDate <= now) {
          setError("Scheduled send time must be in the future");
          return;
        }
      }

      // Convert datetime-local to ISO string for API
      const scheduledSendAtISO = !sendImmediately && scheduledSendAt
        ? new Date(scheduledSendAt).toISOString()
        : undefined;

      if (isEditMode && announcement) {
        // Prevent editing sent announcements
        if (announcement.sentAt) {
          setError("Cannot edit sent announcements");
          return;
        }

        await api.rfp.announcements.update(projectId, announcement.id, {
          title: title.trim(),
          description,
          sendImmediately,
          scheduledSendAt: scheduledSendAtISO,
        });
      } else {
        await api.rfp.announcements.create(projectId, {
          title: title.trim(),
          description,
          sendImmediately,
          scheduledSendAt: scheduledSendAtISO,
        });
      }

      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to save announcement");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!announcement) return;

    if (!confirm(`Are you sure you want to delete this announcement?`)) {
      return;
    }

    try {
      setDeleting(true);
      setError("");
      await api.rfp.announcements.delete(projectId, announcement.id);
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to delete announcement");
    } finally {
      setDeleting(false);
    }
  };

  const isFormDisabled = !!(isEditMode && announcement?.sentAt);

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditMode ? "Edit Announcement" : "New Announcement"}</DialogTitle>
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
              disabled={isFormDisabled}
              className="w-full px-3 py-2 border border-border-primary rounded-md bg-background-tertiary text-text-primary disabled:opacity-50 disabled:cursor-not-allowed"
              placeholder="Enter a clear, concise title for this announcement..."
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1">
              Description *
            </label>
            <div className={isFormDisabled ? "opacity-50 pointer-events-none" : ""}>
              <WysiwygEditor
                value={description}
                onChange={setDescription}
                placeholder="Provide detailed information about this announcement. Use formatting to make it easy to read..."
              />
            </div>
          </div>

          {!isFormDisabled && (
            <div className="space-y-3">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="sendImmediately"
                  checked={sendImmediately}
                  onChange={(e) => {
                    setSendImmediately(e.target.checked);
                    if (e.target.checked) {
                      setScheduledSendAt("");
                    }
                  }}
                  className="w-4 h-4 text-primary-600 border-border-primary rounded focus:ring-primary-500"
                />
                <label htmlFor="sendImmediately" className="ml-2 text-sm font-medium text-text-primary">
                  Send immediately
                </label>
              </div>

              {!sendImmediately && (
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-1">
                    Schedule send date and time *
                  </label>
                  <input
                    type="datetime-local"
                    value={scheduledSendAt}
                    onChange={(e) => setScheduledSendAt(e.target.value)}
                    min={getMinDatetime()}
                    className="w-full px-3 py-2 border border-border-primary rounded-md bg-background-tertiary text-text-primary"
                  />
                  <p className="mt-1 text-xs text-text-secondary">
                    The announcement will be sent at the scheduled time
                  </p>
                </div>
              )}
            </div>
          )}

          {isFormDisabled && (
            <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md">
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                This announcement has already been sent and cannot be edited.
              </p>
            </div>
          )}

          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
              <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
            </div>
          )}

          <div className="flex gap-2 justify-end items-center">
            <Button onClick={onClose} variant="secondary" size="sm">
              Cancel
            </Button>
            {isEditMode && !isFormDisabled && (
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? "Deleting..." : "Delete"}
              </button>
            )}
            <Button
              onClick={handleSave}
              disabled={saving || isFormDisabled}
              variant="primary"
              size="sm"
            >
              {saving
                ? isEditMode
                  ? "Updating..."
                  : "Creating..."
                : isEditMode
                ? "Update Announcement"
                : "Create Announcement"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
