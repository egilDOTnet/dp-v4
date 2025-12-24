"use client";

import { useEffect, useState } from "react";
import { api, RFP, RFPAnnouncement } from "@/lib/api";
import { Button, Card, CardBody, CardHeader, EmptyState } from "@/components/ui";
import { formatISODateTime } from "@/lib/utils";
import CreateAnnouncementModal from "./CreateAnnouncementModal";

interface RFPAnnouncementsProps {
  projectId: string;
  rfp: RFP;
}

export default function RFPAnnouncements({ projectId }: RFPAnnouncementsProps) {
  const [announcements, setAnnouncements] = useState<RFPAnnouncement[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState<RFPAnnouncement | null>(null);
  const [sendingId, setSendingId] = useState<string | null>(null);

  useEffect(() => {
    loadAnnouncements();
  }, [projectId]);

  const loadAnnouncements = async () => {
    try {
      setLoading(true);
      const data = await api.rfp.announcements.list(projectId);
      setAnnouncements(data);
    } catch (err: any) {
      console.error("Error loading announcements:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async (announcementId: string, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }
    try {
      setSendingId(announcementId);
      await api.rfp.announcements.send(projectId, announcementId);
      await loadAnnouncements();
    } catch (err: any) {
      console.error("Error sending announcement:", err);
    } finally {
      setSendingId(null);
    }
  };

  const handleAnnouncementClick = (announcement: RFPAnnouncement) => {
    // Only allow editing unsent announcements
    if (!announcement.sentAt) {
      setEditingAnnouncement(announcement);
      setShowModal(true);
    }
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingAnnouncement(null);
    loadAnnouncements();
  };

  const getUserName = (announcement: RFPAnnouncement) => {
    if (announcement.createdBy) {
      if (announcement.createdBy.firstName || announcement.createdBy.lastName) {
        return `${announcement.createdBy.firstName || ""} ${announcement.createdBy.lastName || ""}`.trim();
      }
      return announcement.createdBy.name || announcement.createdBy.email || "Unknown";
    }
    return "Unknown";
  };

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
        <p className="mt-2 text-text-secondary">Loading announcements...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold text-text-primary">Announcements</h2>
            <Button onClick={() => setShowModal(true)} variant="primary">
              New Announcement
            </Button>
          </div>
        </CardHeader>
        <CardBody>
          {announcements.length === 0 ? (
            <EmptyState
              title="No announcements yet"
              description="No announcements have been created yet. Create one to communicate updates to vendors."
            />
          ) : (
            <div className="space-y-4">
              {announcements.map((announcement) => {
                const isClickable = !announcement.sentAt;

                return (
                  <div
                    key={announcement.id}
                    onClick={() => handleAnnouncementClick(announcement)}
                    className={`border-2 border-primary-500 rounded-lg bg-background-secondary overflow-hidden ${
                      isClickable ? "cursor-pointer hover:border-primary-600 transition-colors" : ""
                    }`}
                  >
                    <div className="px-4 py-3 bg-background-tertiary">
                      <div className="space-y-3">
                        {/* Title */}
                        <div className="text-xl font-semibold text-text-primary">
                          {announcement.title}
                        </div>

                        {/* Description */}
                        <div
                          className="text-text-primary prose prose-sm max-w-none"
                          dangerouslySetInnerHTML={{ __html: announcement.description }}
                        />

                        {/* Metadata */}
                        <div className="text-sm text-text-secondary">
                          Created {formatISODateTime(announcement.createdAt)} by {getUserName(announcement)}
                          {announcement.scheduledSendAt && !announcement.sentAt && (
                            <> • Scheduled for {formatISODateTime(announcement.scheduledSendAt)}</>
                          )}
                        </div>

                        {/* Action area - lower right */}
                        <div className="flex items-center justify-end mt-2">
                          {announcement.sentAt ? (
                            <div className="text-sm text-text-secondary">
                              Sent {formatISODateTime(announcement.sentAt)}
                            </div>
                          ) : (
                            <Button
                              onClick={(e) => handleSend(announcement.id, e)}
                              disabled={sendingId === announcement.id}
                              variant="primary"
                              size="sm"
                            >
                              {sendingId === announcement.id ? "Sending..." : "Send to Vendors"}
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardBody>
      </Card>

      {showModal && (
        <CreateAnnouncementModal
          projectId={projectId}
          announcement={editingAnnouncement || undefined}
          onClose={handleCloseModal}
        />
      )}
    </div>
  );
}
