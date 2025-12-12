"use client";

import { useEffect, useState } from "react";
import { api, RFP, RFPAnnouncement } from "@/lib/api";
import { Button, Card, CardBody } from "@/components/ui";
import { formatISODateTime } from "@/lib/utils";
import CreateAnnouncementModal from "./CreateAnnouncementModal";

interface RFPAnnouncementsProps {
  projectId: string;
  rfp: RFP;
}

export default function RFPAnnouncements({ projectId, rfp }: RFPAnnouncementsProps) {
  const [announcements, setAnnouncements] = useState<RFPAnnouncement[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
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

  const handleSend = async (announcementId: string) => {
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
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Announcements</h2>
        <Button onClick={() => setShowCreateModal(true)} variant="primary">
          New Announcement
        </Button>
      </div>

      {announcements.length === 0 ? (
        <p className="text-text-secondary">No announcements yet.</p>
      ) : (
        <div className="space-y-4">
          {announcements.map((announcement) => (
            <Card key={announcement.id}>
              <CardBody>
                <div className="space-y-4">
                  <div>
                    <div className="text-xl font-semibold text-text-primary mb-2">
                      {announcement.title}
                    </div>
                    <div
                      className="text-text-primary prose prose-sm max-w-none"
                      dangerouslySetInnerHTML={{ __html: announcement.description }}
                    />
                    <div className="text-sm text-text-secondary mt-4">
                      Created {formatISODateTime(announcement.createdAt)} by {getUserName(announcement)}
                      {announcement.sentAt && (
                        <> • Sent {formatISODateTime(announcement.sentAt)}</>
                      )}
                    </div>
                  </div>
                  {!announcement.sentAt && (
                    <Button
                      onClick={() => handleSend(announcement.id)}
                      disabled={sendingId === announcement.id}
                      variant="primary"
                      size="sm"
                    >
                      {sendingId === announcement.id ? "Sending..." : "Send to Vendors"}
                    </Button>
                  )}
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      {showCreateModal && (
        <CreateAnnouncementModal
          projectId={projectId}
          onClose={() => {
            setShowCreateModal(false);
            loadAnnouncements();
          }}
        />
      )}
    </div>
  );
}

