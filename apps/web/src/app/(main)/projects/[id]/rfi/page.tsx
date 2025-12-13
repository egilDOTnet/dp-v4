"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { api, Project, RFI } from "@/lib/api";
import QuestionList from "@/components/QuestionList";
import RFIStatusTable from "@/components/RFIStatusTable";
import QuestionResponseSummary from "@/components/QuestionResponseSummary";
import WysiwygEditor from "@/components/WysiwygEditor";
import { HeroBanner } from "@/components/ui";

type TabType = "email" | "rfi-info" | "questionnaire" | "status";

export default function RFIPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;
  const [project, setProject] = useState<Project | null>(null);
  const [rfi, setRfi] = useState<RFI | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<TabType>("questionnaire");
  const [deadline, setDeadline] = useState("");
  const [autoPublishDate, setAutoPublishDate] = useState("");
  const [isPublishing, setIsPublishing] = useState(false);
  const [emailSubject, setEmailSubject] = useState("");
  const [emailText, setEmailText] = useState("");
  const [rfiInformation, setRfiInformation] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (projectId) {
      loadProject();
      loadRFI();
    }
  }, [projectId]);

  const loadProject = async () => {
    try {
      const projectData = await api.projects.get(projectId);
      setProject(projectData);
    } catch (err: any) {
      setError(err.message || "Failed to load project");
    }
  };

  const loadRFI = async () => {
    try {
      setLoading(true);
      setError("");
      const rfiData = await api.rfi.get(projectId);
      
      // Check if we got valid data
      if (!rfiData || typeof rfiData !== 'object' || !rfiData.id) {
        console.error("Invalid RFI data received:", rfiData);
        setError("Received invalid RFI data from server. Please refresh the page.");
        setLoading(false);
        return;
      }
      
      setRfi(rfiData);
      
      // Set default tab based on published status
      if (rfiData.isPublished) {
        setActiveTab("status");
      } else {
        setActiveTab("questionnaire");
      }
      
      // Safely parse dates - handle both string and Date object formats
      const parseDate = (date: string | Date | null | undefined): string => {
        if (!date) return "";
        if (typeof date === "string") {
          return date.split("T")[0];
        }
        if (date instanceof Date) {
          return date.toISOString().split("T")[0];
        }
        return "";
      };
      
      setDeadline(parseDate(rfiData.deadline));
      setAutoPublishDate(parseDate(rfiData.autoPublishDate));
      setEmailSubject(rfiData.emailSubject || "");
      setEmailText(rfiData.emailText || "");
      setRfiInformation(rfiData.rfiInformation || "");
    } catch (err: any) {
      console.error("Error loading RFI:", err);
      const errorMessage = err.message || err.error?.message || "Failed to load RFI";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateDeadline = async (newDeadline: string) => {
    try {
      await api.rfi.update(projectId, {
        deadline: newDeadline || null,
      });
      setDeadline(newDeadline);
      await loadRFI();
    } catch (err: any) {
      setError(err.message || "Failed to update deadline");
    }
  };

  const handleUpdateAutoPublishDate = async (newDate: string) => {
    if (!deadline) {
      setError("Please set deadline first");
      return;
    }
    if (newDate && deadline && newDate >= deadline) {
      setError("Auto publish date must be before deadline");
      return;
    }
    try {
      await api.rfi.update(projectId, {
        autoPublishDate: newDate || null,
      });
      setAutoPublishDate(newDate);
      setError("");
      await loadRFI();
    } catch (err: any) {
      setError(err.message || "Failed to update auto publish date");
    }
  };

  const handleSaveEmailContent = async () => {
    setIsSaving(true);
    try {
      await api.rfi.update(projectId, {
        emailSubject,
        emailText,
      });
      await loadRFI();
      setError("");
    } catch (err: any) {
      setError(err.message || "Failed to save email content");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveRfiInformation = async () => {
    setIsSaving(true);
    try {
      await api.rfi.update(projectId, {
        rfiInformation,
      });
      await loadRFI();
      setError("");
    } catch (err: any) {
      setError(err.message || "Failed to save RFI information");
    } finally {
      setIsSaving(false);
    }
  };

  const handlePublish = async () => {
    if (!deadline) {
      setError("Deadline is required before publishing");
      return;
    }
    setIsPublishing(true);
    try {
      await api.rfi.publish(projectId);
      await loadRFI();
      // Auto-send to vendors if published
      await api.rfi.send(projectId);
      setError("");
    } catch (err: any) {
      setError(err.message || "Failed to publish RFI");
    } finally {
      setIsPublishing(false);
    }
  };

  const handleUnpublish = async () => {
    if (
      !confirm(
        "Are you sure you want to unpublish? No more RFI responses can be received."
      )
    ) {
      return;
    }
    setIsPublishing(true);
    try {
      await api.rfi.unpublish(projectId);
      await loadRFI();
      setError("");
    } catch (err: any) {
      setError(err.message || "Failed to unpublish RFI");
    } finally {
      setIsPublishing(false);
    }
  };

  const handlePreview = () => {
    router.push(`/projects/${projectId}/rfi/preview`);
  };

  if (loading) {
    return (
      <div>
        <nav className="mb-4 text-sm text-text-secondary">
          <Link href="/dashboard" className="hover:text-primary-600">
            Dashboard
          </Link>
          <span className="mx-2">/</span>
          <Link href="/projects" className="hover:text-primary-600">
            Projects
          </Link>
          <span className="mx-2">/</span>
          <Link href={`/projects/${projectId}`} className="hover:text-primary-600">
            {project?.name || "Project"}
          </Link>
          <span className="mx-2">/</span>
          <span className="text-text-primary">RFI</span>
        </nav>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading RFI...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <nav className="mb-4 text-sm text-gray-600">
        <Link href="/dashboard" className="hover:text-primary-600">
          Dashboard
        </Link>
        <span className="mx-2">/</span>
        <Link href="/projects" className="hover:text-primary-600">
          Projects
        </Link>
        <span className="mx-2">/</span>
        <Link href={`/projects/${projectId}`} className="hover:text-primary-600">
          {project?.name || "Project"}
        </Link>
        <span className="mx-2">/</span>
        <span className="text-gray-900">RFI</span>
      </nav>

      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-4">Request for Information (RFI)</h1>

        {/* Hero Banner */}
        <HeroBanner
          storageKey="rfi-hero-banner"
          title="Welcome to the RFI Module"
          description={
            <>
              A <strong>Request for Information (RFI)</strong> is your first step in the procurement process. It helps you gather preliminary information from potential vendors about their capabilities, experience, and solutions before diving into detailed proposals.
            </>
          }
          features={[
            {
              label: "Email text",
              description: "Compose the invitation email that vendors will receive",
            },
            {
              label: "RFI information",
              description: "Add context about your project and what you're looking for",
            },
            {
              label: "Questionnaire",
              description: "Create questions to understand vendors' capabilities",
            },
            {
              label: "Publish & Send",
              description: "When ready, set a deadline and publish to send the RFI to all your vendors",
            },
          ]}
          tip={
            <>
              <div className="font-bold not-italic mb-1">Tip:</div>
              <div>Take your time crafting clear questions.</div>
              <div>Good questions lead to valuable insights that help you make informed decisions!</div>
            </>
          }
        />

        {/* Tab bar with action buttons */}
        <div className="flex items-end justify-between border-b border-gray-200">
          {/* Tabs on the left */}
          <div className="flex space-x-1">
            <button
              onClick={() => setActiveTab("email")}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === "email"
                  ? "border-primary-600 text-primary-600"
                  : "border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300"
              }`}
            >
              Email text
            </button>
            <button
              onClick={() => setActiveTab("rfi-info")}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === "rfi-info"
                  ? "border-primary-600 text-primary-600"
                  : "border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300"
              }`}
            >
              RFI information
            </button>
            <button
              onClick={() => setActiveTab("questionnaire")}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === "questionnaire"
                  ? "border-primary-600 text-primary-600"
                  : "border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300"
              }`}
            >
              Questionnaire
            </button>
            {rfi?.isPublished && (
              <button
                onClick={() => setActiveTab("status")}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === "status"
                    ? "border-primary-600 text-primary-600"
                    : "border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300"
                }`}
              >
                Status
              </button>
            )}
          </div>

          {/* Action buttons on the right */}
          <div className="flex items-end gap-3 pb-2">
            {!rfi?.isPublished && (
              <div className="flex flex-col">
                <label htmlFor="autoPublishDate" className="text-xs text-gray-600 mb-1">
                  Auto-publish date
                </label>
                <input
                  id="autoPublishDate"
                  type="date"
                  value={autoPublishDate}
                  onChange={(e) => handleUpdateAutoPublishDate(e.target.value)}
                  disabled={!deadline}
                  max={deadline ? deadline : undefined}
                  className="px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                />
              </div>
            )}
            <div className="flex flex-col">
              <label htmlFor="deadline" className="text-xs text-gray-600 mb-1">
                Deadline
              </label>
              <input
                id="deadline"
                type="date"
                value={deadline}
                onChange={(e) => handleUpdateDeadline(e.target.value)}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <button
              onClick={handlePreview}
              className="px-4 py-1.5 text-sm bg-gray-600 text-white rounded-md hover:bg-gray-700"
            >
              Preview
            </button>
            {rfi?.isPublished ? (
              <button
                onClick={handleUnpublish}
                disabled={isPublishing}
                className="px-4 py-1.5 text-sm bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
              >
                {isPublishing ? "Unpublishing..." : "Unpublish"}
              </button>
            ) : (
              <button
                onClick={handlePublish}
                disabled={isPublishing || !deadline}
                className="px-4 py-1.5 text-sm bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50"
              >
                {isPublishing ? "Publishing..." : "Publish"}
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm font-medium text-red-800 mb-1">Error</p>
            <p className="text-sm text-red-700 whitespace-pre-wrap">{error}</p>
          </div>
        )}
      </div>

      {/* Tab content */}
      <div className="bg-background-secondary rounded-lg shadow-md p-6 border border-border-primary">
        {activeTab === "email" && (
          <div className="space-y-4">
            <div className="mb-6">
              <h2 className="text-xl font-semibold mb-2">Email text</h2>
              <p className="text-sm text-gray-600">
                Compose the email that will be sent to vendors when the RFI is published. A link to the RFI will be automatically included in the email.
              </p>
            </div>
            <div>
              <label htmlFor="emailSubject" className="block text-sm font-medium text-gray-700 mb-2">
                Subject
              </label>
              <input
                id="emailSubject"
                type="text"
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="Email subject"
              />
            </div>
            <div>
              <label htmlFor="emailBody" className="block text-sm font-medium text-gray-700 mb-2">
                Email Body
              </label>
              <WysiwygEditor
                value={emailText}
                onChange={setEmailText}
                placeholder="Enter email content..."
              />
            </div>
            <div className="flex justify-end">
              <button
                onClick={handleSaveEmailContent}
                disabled={isSaving}
                className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50"
              >
                {isSaving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        )}

        {activeTab === "rfi-info" && (
          <div className="space-y-4">
            <div className="mb-6">
              <h2 className="text-xl font-semibold mb-2">RFI Information</h2>
              <p className="text-sm text-gray-600">
                Add information about the RFI that will be shown to vendors before they fill out the questionnaire.
              </p>
            </div>
            <div>
              <WysiwygEditor
                value={rfiInformation}
                onChange={setRfiInformation}
                placeholder="Enter RFI information..."
              />
            </div>
            <div className="flex justify-end">
              <button
                onClick={handleSaveRfiInformation}
                disabled={isSaving}
                className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50"
              >
                {isSaving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        )}

        {activeTab === "status" && (
          <div className="space-y-8">
            <div>
              <h2 className="text-xl font-semibold mb-4">Vendor Responses</h2>
              <RFIStatusTable projectId={projectId} />
            </div>
            <div>
              <QuestionResponseSummary projectId={projectId} />
            </div>
          </div>
        )}

        {activeTab === "questionnaire" && (
          <div>
            {/* Questionnaire section */}
            {rfi && rfi.id ? (
              <div>
                <h2 className="text-xl font-semibold mb-4">Questionnaire</h2>
                <QuestionList projectId={projectId} rfiId={rfi.id} />
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <p>Loading RFI data...</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
