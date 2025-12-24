"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { api, RFPDetail, RFPProposalFile, VendorContactPerson } from "@/lib/api";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { Button, Textarea } from "@/components/ui/FormField";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/Tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui";
import { HeroBanner } from "@/components/HeroBanner";
import { RFPInformation } from "@/components/portal/RFPInformation";
import { RFPQuestions } from "@/components/portal/RFPQuestions";
import { RFPProposal, RFPProposalSubmitButton } from "@/components/portal/RFPProposal";
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
  const [mainContact, setMainContact] = useState<{ id: string; firstName: string; lastName: string; email: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showParticipateModal, setShowParticipateModal] = useState(false);
  const [showDeclineModal, setShowDeclineModal] = useState(false);
  const [declineNote, setDeclineNote] = useState("");
  const [activeTab, setActiveTab] = useState("information");
  const [dismissedBanner, setDismissedBanner] = useState(false);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [showQuestionModal, setShowQuestionModal] = useState(false);
  const [proposalFiles, setProposalFiles] = useState<RFPProposalFile[]>([]);
  const [proposalRequirementsResponse, setProposalRequirementsResponse] = useState<{
    responses?: Array<{
      id: string;
      requirementId: string;
      requirementNumber: string;
      answer: string | null;
      description: string | null;
      reference: string | null;
    }>;
    totalRequirements: number;
    answeredCount: number;
    percentage: number;
    invalidAnswers?: Array<{ requirementNumber: string; invalidValue: string; row: number }>;
  } | null>(null);

  useEffect(() => {
    loadData();
  }, [rfpId, previewToken]);

  const loadProposalData = async () => {
    if (isPreviewMode) {
      // Don't load proposal data in preview mode
      return;
    }
    try {
      const [filesData, requirementsData] = await Promise.all([
        api.vendorRfp.rfps.getProposal(rfpId),
        api.vendorRfp.rfps.getRequirementsResponses(rfpId).catch(() => null),
      ]);
      setProposalFiles(filesData);
      if (requirementsData) {
        // If totalRequirements > 0, it means a vendorResponse exists (file was uploaded)
        // The backend returns totalRequirements: 0 only when no vendorResponse exists
        // So if totalRequirements > 0, we should show stats even if answeredCount is 0
        if (requirementsData.totalRequirements > 0) {
          setProposalRequirementsResponse({
            responses: requirementsData.responses,
            totalRequirements: requirementsData.totalRequirements,
            answeredCount: requirementsData.answeredCount,
            percentage: requirementsData.percentage,
          });
        } else {
          setProposalRequirementsResponse(null);
        }
      } else {
        setProposalRequirementsResponse(null);
      }
    } catch (err: any) {
      console.error("Failed to load proposal data:", err);
    }
  };

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
        setMainContact(contactData.mainContact);

        // Set initial tab based on participation status
        if (rfpData.vendorResponse?.status === "Participating" || rfpData.vendorResponse?.status === "ProposalSubmitted") {
          setActiveTab("information");
        }

        // Load proposal data if participating
        if (rfpData.vendorResponse?.status === "Participating" || rfpData.vendorResponse?.status === "ProposalSubmitted") {
          await loadProposalData();
        }
      }
    } catch (err: any) {
      setError(err.message || "Failed to load RFP");
      console.error("Failed to load RFP:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleReload = async () => {
    await loadData();
    // Also reload proposal data if participating
    if (rfp?.vendorResponse?.status === "Participating" || rfp?.vendorResponse?.status === "ProposalSubmitted") {
      if (!isPreviewMode) {
        await loadProposalData();
      }
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

  const handleDecline = async (note: string) => {
    try {
      await api.vendorRfp.rfps.decline(rfpId, note);
      await loadData(); // Reload to get updated status
      setShowParticipateModal(false);
    } catch (err: any) {
      setError(err.message || "Failed to decline participation");
      console.error("Failed to decline participation:", err);
    }
  };

  const isParticipating =
    rfp?.vendorResponse?.status === "Participating" ||
    rfp?.vendorResponse?.status === "ProposalSubmitted";

  const canParticipate =
    !isPreviewMode &&
    contactPerson?.isMainContact &&
    rfp?.vendorResponse?.status !== "Participating" &&
    rfp?.vendorResponse?.status !== "ProposalSubmitted" &&
    rfp?.vendorResponse?.status !== "Declined";
  
  const isDeclined = rfp?.vendorResponse?.status === "Declined";

  // Expand enum status values with spaces (e.g., "ProposalSubmitted" -> "Proposal Submitted")
  const expandStatusValue = (status: string): string => {
    return status.replace(/([A-Z])/g, " $1").trim();
  };

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

      {/* Participation Banner - Only visible for main contacts */}
      {!isPreviewMode && !isParticipating && !dismissedBanner && !acceptanceDeadlinePassed && contactPerson?.isMainContact && (
        <ParticipationBanner
          onDismiss={() => setDismissedBanner(true)}
          acceptanceDate={acceptanceDate}
          isMainContact={contactPerson.isMainContact}
          mainContactName={mainContact ? `${mainContact.firstName} ${mainContact.lastName}` : null}
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
        <div className="mb-8 relative rounded-lg overflow-hidden h-64">
          {rfp.project.bannerData ? (
            <img
              src={`data:${rfp.project.bannerFileType || "image/png"};base64,${rfp.project.bannerData}`}
              alt={`${rfp.project.name} banner`}
              className="w-full h-full object-cover rounded-lg"
            />
          ) : (
            /* Transparent placeholder when no banner but overlay logo exists */
            <div className="w-full h-full bg-transparent rounded-lg" />
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
            <h1 className="text-4xl font-bold text-text-primary">
              {rfp.project.name}
            </h1>
          </div>
          <div className="flex gap-2">
            {canParticipate && (
              <>
                <Button variant="danger" onClick={() => setShowDeclineModal(true)}>
                  Won't participate
                </Button>
                <Button onClick={() => setShowParticipateModal(true)}>
                  Participate
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      {isPreviewMode ? (
        // Preview mode - show all tabs but read-only
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="flex items-center justify-between border-b border-border-primary">
            <TabsList>
              <TabsTrigger value="information">Information</TabsTrigger>
              <TabsTrigger value="questions">Questions and Answers</TabsTrigger>
              <TabsTrigger value="proposal">Delivery of Proposal</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="information">
            <RFPInformation rfp={rfp} />
          </TabsContent>

          <TabsContent value="questions">
            <RFPQuestions rfpId={rfpId} rfp={rfp} onReload={handleReload} />
          </TabsContent>

          <TabsContent value="proposal">
            <RFPProposal rfpId={rfpId} rfp={rfp} contactPerson={null} onReload={handleReload} isPreviewMode={true} />
          </TabsContent>
        </Tabs>
      ) : isParticipating ? (
        <Tabs value={activeTab} onValueChange={(value) => {
          setActiveTab(value);
          // Load proposal data when proposal tab becomes active
          if (value === "proposal" && !isPreviewMode) {
            loadProposalData();
          }
        }}>
          <div className="flex items-center justify-between border-b border-border-primary">
            <TabsList>
              <TabsTrigger value="information">Information</TabsTrigger>
              <TabsTrigger value="questions">Questions and Answers</TabsTrigger>
              <TabsTrigger value="proposal">Delivery of Proposal</TabsTrigger>
            </TabsList>
            <div className="pb-2">
              {activeTab === "information" && rfp.vendorResponse && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-text-secondary">Status:</span>
                  <span
                    className={`px-2 py-2 text-sm font-medium rounded-full ${
                      rfp.vendorResponse.status === "Participating" || rfp.vendorResponse.status === "ProposalSubmitted"
                        ? "bg-green-100 text-green-800"
                        : "bg-gray-100 text-gray-800"
                    }`}
                  >
                    {expandStatusValue(rfp.vendorResponse.status)}
                  </span>
                </div>
              )}
              {activeTab === "questions" && (
                <Button onClick={() => setShowQuestionModal(true)}>Ask a Question</Button>
              )}
              {activeTab === "proposal" && (
                <RFPProposalSubmitButton 
                  rfpId={rfpId} 
                  rfp={rfp} 
                  contactPerson={contactPerson} 
                  onReload={handleReload}
                  files={proposalFiles}
                  requirementsResponse={proposalRequirementsResponse}
                />
              )}
            </div>
          </div>

          <TabsContent value="information">
            <RFPInformation rfp={rfp} isDeclined={isDeclined} />
          </TabsContent>

          <TabsContent value="questions">
            <RFPQuestions rfpId={rfpId} rfp={rfp} onReload={handleReload} showQuestionModal={showQuestionModal} onCloseQuestionModal={() => setShowQuestionModal(false)} />
          </TabsContent>

          <TabsContent value="proposal">
            <RFPProposal 
              rfpId={rfpId} 
              rfp={rfp} 
              contactPerson={contactPerson} 
              onReload={handleReload}
              files={proposalFiles}
              requirementsResponse={proposalRequirementsResponse}
              onProposalDataReload={loadProposalData}
            />
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

      {/* Decline Modal */}
      {showDeclineModal && (
        <Dialog open={true} onClose={() => setShowDeclineModal(false)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirm You Won't Participate</DialogTitle>
              <DialogDescription>
                You will not be able to participate further in this RFP. You will lose access to review any further documents.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label htmlFor="declineNote" className="block text-sm font-medium text-text-primary mb-1">
                  Reason (optional)
                </label>
                <Textarea
                  id="declineNote"
                  value={declineNote}
                  onChange={(e) => setDeclineNote(e.target.value)}
                  rows={4}
                  placeholder="Please let us know why you won't participate..."
                  className="w-full"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="secondary" onClick={() => setShowDeclineModal(false)}>
                Cancel
              </Button>
              <Button variant="danger" onClick={() => {
                handleDecline(declineNote);
                setShowDeclineModal(false);
              }}>
                Confirm - Won't Participate
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

