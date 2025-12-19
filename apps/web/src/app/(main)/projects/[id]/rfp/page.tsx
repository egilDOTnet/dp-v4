"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { api, Project, RFP } from "@/lib/api";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui";
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

  useEffect(() => {
    if (projectId) {
      loadProject();
      loadRFP();
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

  const loadRFP = async () => {
    try {
      setLoading(true);
      setError("");
      const rfpData = await api.rfp.get(projectId);
      setRfp(rfpData);
      setAbout(rfpData.about || "");
    } catch (err: any) {
      console.error("Error loading RFP:", err);
      setError(err.message || err.error?.message || "Failed to load RFP");
    } finally {
      setLoading(false);
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
          <span className="text-text-primary">RFP</span>
        </nav>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-text-secondary">Loading RFP...</p>
        </div>
      </div>
    );
  }

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
        <span className="text-text-primary">RFP</span>
      </nav>

      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-4">Request for Proposal (RFP)</h1>

        {error && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm font-medium text-red-800 mb-1">Error</p>
            <p className="text-sm text-red-700 whitespace-pre-wrap">{error}</p>
          </div>
        )}
      </div>

      {rfp && (
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as TabType)}>
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="about">About</TabsTrigger>
            <TabsTrigger value="schedule">Schedule</TabsTrigger>
            <TabsTrigger value="documents">Documents/Links</TabsTrigger>
            <TabsTrigger value="changelog">Changelog</TabsTrigger>
            <TabsTrigger value="qa">Q&A</TabsTrigger>
            <TabsTrigger value="announcements">Announcements</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <RFPOverview projectId={projectId} rfp={rfp} />
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
