"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { api, Project, RFI } from "@/lib/api";
import QuestionList from "@/components/QuestionList";
import RFIStatusTable from "@/components/RFIStatusTable";
import WysiwygEditor from "@/components/WysiwygEditor";

type TabType = "email" | "rfi-info" | "questionnaire";

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
  const [showHeroBanner, setShowHeroBanner] = useState(true);

  useEffect(() => {
    if (projectId) {
      loadProject();
      loadRFI();
    }
  }, [projectId]);

  useEffect(() => {
    // Check if user has dismissed the hero banner before
    const dismissed = localStorage.getItem("rfi-hero-banner-dismissed");
    if (dismissed === "true") {
      setShowHeroBanner(false);
    }
  }, []);

  const handleDismissHeroBanner = () => {
    localStorage.setItem("rfi-hero-banner-dismissed", "true");
    setShowHeroBanner(false);
  };

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
      setRfi(rfiData);
      setDeadline(rfiData.deadline ? rfiData.deadline.split("T")[0] : "");
      setAutoPublishDate(
        rfiData.autoPublishDate ? rfiData.autoPublishDate.split("T")[0] : ""
      );
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
        {showHeroBanner && (
          <div className="mb-6 bg-gradient-to-r from-primary-50 to-blue-50 border border-primary-200 rounded-lg p-6 shadow-sm">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-12 h-12 bg-primary-600 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-text-primary mb-2">Welcome to the RFI Module</h3>
                <p className="text-text-primary mb-3">
                  A <strong>Request for Information (RFI)</strong> is your first step in the procurement process. It helps you gather preliminary information from potential vendors about their capabilities, experience, and solutions before diving into detailed proposals.
                </p>
                <p className="text-text-primary mb-3">
                  <strong>Here's how this module works:</strong>
                </p>
                <ul className="list-disc list-inside text-text-primary space-y-1 mb-4 ml-2">
                  <li><strong>Email text:</strong> Compose the invitation email that vendors will receive</li>
                  <li><strong>RFI information:</strong> Add context about your project and what you're looking for</li>
                  <li><strong>Questionnaire:</strong> Create questions to understand vendors' capabilities</li>
                  <li><strong>Publish & Send:</strong> When ready, set a deadline and publish to send the RFI to all your vendors</li>
                </ul>
                <div className="bg-background-primary/60 border border-primary-300 rounded-md p-3 shadow-sm">
                  <div className="flex items-start gap-3">
                    <div className="text-3xl flex-shrink-0">💡</div>
                    <div className="flex-1 text-sm text-text-primary italic">
                      <div className="font-bold not-italic mb-1">Tip:</div>
                      <div>Take your time crafting clear questions.</div>
                      <div>Good questions lead to valuable insights that help you make informed decisions!</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex justify-end mt-4">
              <button
                onClick={handleDismissHeroBanner}
                className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors shadow-sm"
              >
                Understood
              </button>
            </div>
          </div>
        )}

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
          </div>

          {/* Action buttons on the right */}
          <div className="flex items-end gap-3 pb-2">
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
                className="px-4 py-1.5 text-sm bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
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

        {activeTab === "questionnaire" && (
          <div>
            {/* Status section - only show when published */}
            {rfi?.isPublished && (
              <div className="mb-6">
                <h2 className="text-xl font-semibold mb-4">Status</h2>
                <RFIStatusTable projectId={projectId} />
              </div>
            )}

            {/* Questionnaire section */}
            {rfi && (
              <div>
                <h2 className="text-xl font-semibold mb-4">Questionnaire</h2>
                <QuestionList projectId={projectId} rfiId={rfi.id} />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
