"use client";

import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import { api, Project, RFP } from "@/lib/api";
import { Tabs, TabsList, TabsTrigger, TabsContent, HeroBanner, Breadcrumbs } from "@/components/ui";
import RFPOverview from "@/components/rfp/RFPOverview";
import RFPSchedule from "@/components/rfp/RFPSchedule";
import RFPDocuments from "@/components/rfp/RFPDocuments";
import RFPChangelog from "@/components/rfp/RFPChangelog";
import RFPQuestions from "@/components/rfp/RFPQuestions";
import RFPAnnouncements from "@/components/rfp/RFPAnnouncements";
import WysiwygEditor from "@/components/WysiwygEditor";

type TabType = "overview" | "about" | "schedule" | "documents" | "changelog" | "qa" | "announcements";

export default function RFPPage() {
  const params = useParams();
  const projectId = params.id as string;
  const [project, setProject] = useState<Project | null>(null);
  const [rfp, setRfp] = useState<RFP | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<TabType>("overview");
  const [about, setAbout] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const loadingProjectIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (projectId) {
      // Prevent duplicate calls (React Strict Mode protection)
      if (loadingProjectIdRef.current === projectId) {
        return;
      }
      
      loadingProjectIdRef.current = projectId;
      Promise.all([
        loadProject(),
        loadRFP()
      ]).finally(() => {
        // Only clear if we're still loading the same projectId
        if (loadingProjectIdRef.current === projectId) {
          loadingProjectIdRef.current = null;
        }
      });
    }
    // No cleanup needed - the ref check at the start handles projectId changes
    // and the finally block clears it when load completes
  }, [projectId]);

  const loadProject = async () => {
    try {
      const projectData = await api.projects.get(projectId);
      // Only update state if we're still loading the same projectId
      if (loadingProjectIdRef.current === projectId) {
        setProject(projectData);
      }
    } catch (err: any) {
      // Only set error if we're still loading the same projectId
      if (loadingProjectIdRef.current === projectId) {
        setError(err.message || "Failed to load project");
      }
    }
  };

  const loadRFP = async () => {
    try {
      if (loadingProjectIdRef.current === projectId) {
        setLoading(true);
        setError("");
      }
      const rfpData = await api.rfp.get(projectId);
      // Only update state if we're still loading the same projectId
      if (loadingProjectIdRef.current === projectId) {
        setRfp(rfpData);
        setAbout(rfpData.about || "");
      }
    } catch (err: any) {
      console.error("Error loading RFP:", err);
      // Only set error if we're still loading the same projectId
      if (loadingProjectIdRef.current === projectId) {
        setError(err.message || err.error?.message || "Failed to load RFP");
      }
    } finally {
      // Only update loading state if we're still loading the same projectId
      if (loadingProjectIdRef.current === projectId) {
        setLoading(false);
      }
    }
  };

  const handleSaveAbout = async () => {
    setIsSaving(true);
    try {
      await api.rfp.update(projectId, {
        about,
      });
      await loadRFP();
      setError("");
    } catch (err: any) {
      setError(err.message || "Failed to save about information");
    } finally {
      setIsSaving(false);
    }
  };

  const handlePreview = async () => {
    if (!rfp?.id) {
      setError("RFP not loaded");
      return;
    }
    try {
      setError("");
      const { token } = await api.rfp.getPreviewToken(projectId);
      // Open vendor portal in new window
      const baseUrl = process.env.NEXT_PUBLIC_WEB_URL || window.location.origin;
      const previewUrl = `${baseUrl}/portal/rfp/${rfp.id}?preview=${token}`;
      window.open(previewUrl, "_blank", "noopener,noreferrer");
    } catch (err: any) {
      setError(err.message || "Failed to generate preview token");
    }
  };

  const handlePublish = async () => {
    // Warn user that start date will be set to current time
    const confirmMessage = "Publishing the RFP will set the start date to the current time. All required dates must be set, and a main contact person must be assigned. Continue?";
    if (!confirm(confirmMessage)) {
      return;
    }

    setIsPublishing(true);
    try {
      await api.rfp.publish(projectId);
      await loadRFP();
      setError("");
    } catch (err: any) {
      setError(err.message || err.error?.message || "Failed to publish RFP");
    } finally {
      setIsPublishing(false);
    }
  };

  const breadcrumbItems = [
    { label: "Home", href: "/dashboard?noAutoRedirect=true" },
    { label: "Projects", href: "/projects" },
    { label: project?.name || "Project", href: `/projects/${projectId}` },
    { label: "RFP" },
  ];

  if (loading) {
    return (
      <div>
        <Breadcrumbs items={breadcrumbItems} />
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-text-secondary">Loading RFP...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Breadcrumbs items={breadcrumbItems} />

      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-4">Request for Proposal (RFP)</h1>

        {/* Hero Banner */}
        <HeroBanner
          storageKey="rfp-hero-banner"
          title="Welcome to the RFP Module"
          description={
            <>
              A <strong>Request for Proposal (RFP)</strong> is your formal invitation to vendors to submit detailed proposals for your project. Use this module to create comprehensive RFPs, manage schedules, handle vendor questions, and receive proposals.
            </>
          }
          features={[
            {
              label: "About",
              description: "Add detailed information about your RFP that vendors will see",
            },
            {
              label: "Schedule",
              description: "Set important dates including start, acceptance, questions, and delivery deadlines",
            },
            {
              label: "Documents",
              description: "Share project documents and external resources with vendors",
            },
            {
              label: "Q&A",
              description: "Manage questions from vendors and provide answers",
            },
            {
              label: "Preview & Publish",
              description: "Preview how vendors will see your RFP, then publish when ready",
            },
          ]}
          tip={
            <>
              <div className="font-bold not-italic mb-1">Tip:</div>
              <div>Use the Preview button to see exactly how vendors will view your RFP before publishing.</div>
              <div>Make sure all required dates are set and a main contact person is assigned before publishing.</div>
            </>
          }
        />

        {error && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm font-medium text-red-800 mb-1">Error</p>
            <p className="text-sm text-red-700 whitespace-pre-wrap">{error}</p>
          </div>
        )}
      </div>

      {rfp && (
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as TabType)}>
          {/* Tab bar with action buttons */}
          <div className="flex items-end justify-between border-b border-gray-200">
            {/* Tabs on the left */}
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="about">About</TabsTrigger>
              <TabsTrigger value="announcements">Announcements</TabsTrigger>
              <TabsTrigger value="changelog">Changelog</TabsTrigger>
              <TabsTrigger value="documents">Documents</TabsTrigger>
              <TabsTrigger value="schedule">Schedule</TabsTrigger>
              <TabsTrigger value="qa">Q&A</TabsTrigger>
            </TabsList>

            {/* Action buttons on the right */}
            <div className="flex items-end gap-3 pb-2">
              <button
                onClick={handlePreview}
                className="px-4 py-1.5 text-sm bg-gray-600 text-white rounded-md hover:bg-gray-700 disabled:opacity-50"
              >
                Preview
              </button>
              {rfp?.status !== "Published" && (
                <button
                  onClick={handlePublish}
                  disabled={isPublishing}
                  className="px-4 py-1.5 text-sm bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50"
                >
                  {isPublishing ? "Publishing..." : "Publish"}
                </button>
              )}
            </div>
          </div>

          <TabsContent value="overview">
            <RFPOverview projectId={projectId} rfp={rfp} project={project} onTabChange={(tab) => setActiveTab(tab as TabType)} onRfpUpdate={loadRFP} />
          </TabsContent>

          <TabsContent value="about">
            <div className="bg-background-secondary rounded-lg shadow-md p-6 border border-border-primary">
              <div className="space-y-4">
                <div className="mb-6">
                  <h2 className="text-xl font-semibold mb-2">About</h2>
                  <p className="text-sm text-gray-600">
                    Add information about the RFP that will be shown to vendors.
                  </p>
                </div>
                <div>
                  <WysiwygEditor
                    value={about}
                    onChange={setAbout}
                    placeholder="Enter RFP information..."
                  />
                </div>
                <div className="flex justify-end">
                  <button
                    onClick={handleSaveAbout}
                    disabled={isSaving}
                    className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50"
                  >
                    {isSaving ? "Saving..." : "Save"}
                  </button>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="schedule">
            <RFPSchedule projectId={projectId} rfp={rfp} />
          </TabsContent>

          <TabsContent value="documents">
            <RFPDocuments projectId={projectId} rfp={rfp} />
          </TabsContent>

          <TabsContent value="changelog">
            <RFPChangelog projectId={projectId} rfp={rfp} />
          </TabsContent>

          <TabsContent value="qa">
            <RFPQuestions projectId={projectId} rfp={rfp} />
          </TabsContent>

          <TabsContent value="announcements">
            <RFPAnnouncements projectId={projectId} rfp={rfp} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
