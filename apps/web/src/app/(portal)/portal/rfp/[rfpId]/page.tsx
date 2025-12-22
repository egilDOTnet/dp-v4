"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { api, RFPDetail, VendorContactPerson } from "@/lib/api";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { Button } from "@/components/ui/FormField";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/Tabs";
import { HeroBanner } from "@/components/HeroBanner";
import { RFPInformation } from "@/components/portal/RFPInformation";
import { RFPQuestions } from "@/components/portal/RFPQuestions";
import { RFPProposal } from "@/components/portal/RFPProposal";
import { ParticipateModal } from "@/components/portal/ParticipateModal";
import { ParticipationBanner } from "@/components/portal/ParticipationBanner";
import { ProjectLogo } from "@/components/ProjectLogo";

export default function RFPDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const rfpId = params.rfpId as string;
  const previewToken = searchParams.get("preview");

  const [rfp, setRfp] = useState<RFPDetail | null>(null);
  const [contactPerson, setContactPerson] = useState<VendorContactPerson | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showParticipateModal, setShowParticipateModal] = useState(false);
  const [activeTab, setActiveTab] = useState("information");
  const [dismissedBanner, setDismissedBanner] = useState(false);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [showQuestionModal, setShowQuestionModal] = useState(false);

  useEffect(() => {
    loadData();
  }, [rfpId, previewToken]);

  const loadData = async () => {
    try {
      if (previewToken) {
        // Preview mode - use preview token to get RFP data
        setIsPreviewMode(true);
        const rfpData = await api.vendorRfp.rfps.getPreview(rfpId, previewToken);
        setRfp(rfpData);
        // In preview mode, no contact person (read-only)
        setContactPerson(null);
        // Store projectId in sessionStorage for layout to use
        if (rfpData.projectId) {
          sessionStorage.setItem('previewProjectId', rfpData.projectId);
        }
      } else {
        // Normal vendor mode
        setIsPreviewMode(false);
        const [rfpData, contactData] = await Promise.all([
          api.vendorRfp.rfps.get(rfpId),
          api.vendorRfp.auth.me(),
        ]);
        setRfp(rfpData);
        setContactPerson(contactData.contactPerson);

        // Set initial tab based on participation status
        if (rfpData.vendorResponse?.status === "Participating" || rfpData.vendorResponse?.status === "ProposalSubmitted") {
          setActiveTab("information");
        }
      }
    } catch (err: any) {
      setError(err.message || "Failed to load RFP");
      console.error("Failed to load RFP:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleParticipate = async () => {
    try {
      await api.vendorRfp.rfps.participate(rfpId);
      await loadData(); // Reload to get updated status
      setShowParticipateModal(false);
    } catch (err: any) {
      setError(err.message || "Failed to participate");
      console.error("Failed to participate:", err);
    }
  };

  const isParticipating =
    rfp?.vendorResponse?.status === "Participating" ||
    rfp?.vendorResponse?.status === "ProposalSubmitted";

  const canParticipate =
    !isPreviewMode &&
    contactPerson?.isMainContact &&
    rfp?.vendorResponse?.status !== "Participating" &&
    rfp?.vendorResponse?.status !== "ProposalSubmitted";

  // Get acceptance deadline
  const acceptanceDate = rfp?.scheduleItems.find((item) => item.type === "AcceptanceDate")?.date;
  const acceptanceDeadlinePassed = acceptanceDate ? new Date(acceptanceDate) < new Date() : false;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingSpinner />
      </div>
    );
  }

  if (error || !rfp) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600 mb-4">{error || "RFP not found"}</p>
        <Button onClick={() => router.push("/portal/rfp")}>Back to RFPs</Button>
      </div>
    );
  }

  return (
    <div>
      {/* Preview Mode Banner */}
      {isPreviewMode && (
        <HeroBanner
          storageKey="rfp-preview-mode-banner"
          title="Preview Mode - Read Only"
          description="You are viewing this RFP in preview mode. This is how vendors will see it."
        />
      )}

      {/* Participation Banner */}
      {!isPreviewMode && !isParticipating && !dismissedBanner && !acceptanceDeadlinePassed && (
        <ParticipationBanner
          onDismiss={() => setDismissedBanner(true)}
          acceptanceDate={acceptanceDate}
        />
      )}

      {/* Logo above banner (if placement is "above" mode) */}
      {rfp.project.logoData && 
       rfp.project.logoPlacement?.startsWith("above") && (
        <div className="mb-8">
          <ProjectLogo
            logoData={rfp.project.logoData}
            logoFileType={rfp.project.logoFileType}
            logoShape={rfp.project.logoShape}
            logoPlacement={rfp.project.logoPlacement}
            logoBorder={rfp.project.logoBorder}
            className=""
          />
        </div>
      )}

      {/* Banner with Logo Overlay */}
      {(rfp.project.bannerData || (rfp.project.logoData && (!rfp.project.logoPlacement || rfp.project.logoPlacement.startsWith("overlay")))) ? (
        <div className="mb-8 relative rounded-lg overflow-hidden min-h-[200px]">
          {rfp.project.bannerData ? (
            <img
              src={`data:${rfp.project.bannerFileType || "image/png"};base64,${rfp.project.bannerData}`}
              alt={`${rfp.project.name} banner`}
              className="w-full h-auto max-h-64 object-contain rounded-lg"
            />
          ) : (
            /* Transparent placeholder when no banner but overlay logo exists */
            <div className="w-full min-h-[200px] bg-transparent rounded-lg" />
          )}
          {/* Logo overlay on banner (if placement is "overlay" mode, null, or undefined - defaults to overlay) */}
          {rfp.project.logoData && 
           (!rfp.project.logoPlacement || rfp.project.logoPlacement.startsWith("overlay")) && (
            <ProjectLogo
              logoData={rfp.project.logoData}
              logoFileType={rfp.project.logoFileType}
              logoShape={rfp.project.logoShape}
              logoPlacement={rfp.project.logoPlacement}
              logoBorder={rfp.project.logoBorder}
              className=""
            />
          )}
        </div>
      ) : null}

      {/* Project Name and Actions */}
      <div className="mb-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h1 className="text-4xl font-bold text-text-primary mb-2">
              {rfp.project.name}
            </h1>
            {rfp.vendorResponse && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-text-secondary">Status:</span>
                <span
                  className={`px-2 py-1 text-xs font-medium rounded-full ${
                    rfp.vendorResponse.status === "Participating"
                      ? "bg-green-100 text-green-800"
                      : rfp.vendorResponse.status === "ProposalSubmitted"
                      ? "bg-purple-100 text-purple-800"
                      : "bg-gray-100 text-gray-800"
                  }`}
                >
                  {rfp.vendorResponse.status}
                </span>
              </div>
            )}
          </div>
          <div className="flex gap-2">
            {canParticipate && (
              <Button onClick={() => setShowParticipateModal(true)}>
                Participate
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      {isPreviewMode ? (
        // Preview mode - show all tabs but read-only
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="flex items-center justify-between border-b border-border-primary">
            <TabsList className="border-0">
              <TabsTrigger value="information">Information</TabsTrigger>
              <TabsTrigger value="questions">Questions and Answers</TabsTrigger>
              <TabsTrigger value="proposal">Delivery of Proposal</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="information">
            <RFPInformation rfp={rfp} />
          </TabsContent>

          <TabsContent value="questions">
            <RFPQuestions rfpId={rfpId} rfp={rfp} onReload={loadData} />
          </TabsContent>

          <TabsContent value="proposal">
            <RFPProposal rfpId={rfpId} rfp={rfp} contactPerson={null} onReload={loadData} isPreviewMode={true} />
          </TabsContent>
        </Tabs>
      ) : isParticipating ? (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="flex items-center justify-between border-b border-border-primary">
            <TabsList className="border-0">
              <TabsTrigger value="information">Information</TabsTrigger>
              <TabsTrigger value="questions">Questions and Answers</TabsTrigger>
              <TabsTrigger value="proposal">Delivery of Proposal</TabsTrigger>
            </TabsList>
            <div className="pb-2">
              <Button onClick={() => setShowQuestionModal(true)}>Ask a Question</Button>
            </div>
          </div>

          <TabsContent value="information">
            <RFPInformation rfp={rfp} />
          </TabsContent>

          <TabsContent value="questions">
            <RFPQuestions rfpId={rfpId} rfp={rfp} onReload={loadData} showQuestionModal={showQuestionModal} onCloseQuestionModal={() => setShowQuestionModal(false)} />
          </TabsContent>

          <TabsContent value="proposal">
            <RFPProposal rfpId={rfpId} rfp={rfp} contactPerson={contactPerson} onReload={loadData} />
          </TabsContent>
        </Tabs>
      ) : (
        <RFPInformation rfp={rfp} />
      )}

      {/* Participate Modal */}
      {showParticipateModal && (
        <ParticipateModal
          rfp={rfp}
          onConfirm={handleParticipate}
          onCancel={() => setShowParticipateModal(false)}
        />
      )}
    </div>
  );
}

