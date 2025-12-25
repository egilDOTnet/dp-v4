"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { RFPDetail, RFPProposalFile, VendorContactPerson, api } from "@/lib/api";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/FormField";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui";
import { Input } from "@/components/ui/FormField";
import { RFPVendorResponseStatus } from "@/lib/api";
import { RequirementsColumnMappingDialog, AvailableColumn, ColumnMapping } from "./RequirementsColumnMappingDialog";

interface RFPProposalProps {
  rfpId: string;
  rfp: RFPDetail;
  contactPerson: VendorContactPerson | null;
  onReload: () => void;
  isPreviewMode?: boolean;
  files?: RFPProposalFile[];
  requirementsResponse?: {
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
  } | null;
  onProposalDataReload?: () => void;
}

export function RFPProposal({ 
  rfpId, 
  rfp, 
  contactPerson, 
  onReload: _onReload, 
  isPreviewMode = false,
  files: filesProp,
  requirementsResponse: requirementsResponseProp,
  onProposalDataReload
}: RFPProposalProps) {
  const [files, setFiles] = useState<RFPProposalFile[]>(filesProp || []);
  const [loading, setLoading] = useState(!filesProp);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [editingFileName, setEditingFileName] = useState<string | null>(null);
  const [editedFileName, setEditedFileName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [requirementsUploading, setRequirementsUploading] = useState(false);
  const [requirementsResponse, setRequirementsResponse] = useState<{
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
  } | null>(requirementsResponseProp || null);
  const [hasUploadedFile, setHasUploadedFile] = useState(false);
  const [showColumnMapping, setShowColumnMapping] = useState(false);
  const [columnMappingData, setColumnMappingData] = useState<{
    file: File;
    availableColumns: AvailableColumn[];
  } | null>(null);
  const requirementsFileInputRef = useRef<HTMLInputElement>(null);

  // Update local state when props change
  useEffect(() => {
    if (filesProp !== undefined) {
      setFiles(filesProp);
    }
  }, [filesProp]);

  useEffect(() => {
    if (requirementsResponseProp !== undefined) {
      setRequirementsResponse(requirementsResponseProp);
      if (requirementsResponseProp && requirementsResponseProp.totalRequirements > 0) {
        setHasUploadedFile(true);
      } else {
        setHasUploadedFile(false);
      }
    }
  }, [requirementsResponseProp]);

  const loadData = useCallback(async () => {
    try {
      const [filesData, requirementsData] = await Promise.all([
        api.vendorRfp.rfps.getProposal(rfpId),
        api.vendorRfp.rfps.getRequirementsResponses(rfpId).catch(() => null),
      ]);
      setFiles(filesData);
      if (requirementsData) {
        // If totalRequirements > 0, it means a vendorResponse exists (file was uploaded)
        // The backend returns totalRequirements: 0 only when no vendorResponse exists
        // So if totalRequirements > 0, we should show stats even if answeredCount is 0
        if (requirementsData.totalRequirements > 0) {
          setRequirementsResponse({
            responses: requirementsData.responses,
            totalRequirements: requirementsData.totalRequirements,
            answeredCount: requirementsData.answeredCount,
            percentage: requirementsData.percentage,
          });
          setHasUploadedFile(true);
        }
      }
    } catch (err: any) {
      setError(err.message || "Failed to load proposal files");
      console.error("Failed to load files:", err);
    } finally {
      setLoading(false);
    }
  }, [rfpId]);

  useEffect(() => {
    if (isPreviewMode) {
      // In preview mode, don't load files (read-only)
      setFiles([]);
      setLoading(false);
    } else if (filesProp === undefined) {
      // Only load data if props are not provided (backward compatibility)
      loadData();
    } else {
      // Props provided, no need to load
      setLoading(false);
    }
  }, [rfpId, isPreviewMode, filesProp, loadData]);

  const loadFiles = async () => {
    if (onProposalDataReload) {
      // If parent provides reload function, use it
      await onProposalDataReload();
    } else {
      // Otherwise, load locally (backward compatibility)
      await loadData();
    }
  };

  const handleFileSelect = async (file: File) => {
    if (!file) return;

    // Validate file size (10MB)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      setError("File size exceeds maximum allowed size (10MB)");
      return;
    }

    setUploading(true);
    setError("");

    try {
      await api.vendorRfp.rfps.uploadFile(rfpId, file);
      await loadFiles();
    } catch (err: any) {
      setError(err.message || "Failed to upload file");
      console.error("Failed to upload file:", err);
    } finally {
      setUploading(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      handleFileSelect(droppedFile);
    }
  };

  const handleDeleteFile = async (fileId: string) => {
    if (!confirm("Are you sure you want to delete this file?")) {
      return;
    }

    try {
      await api.vendorRfp.rfps.deleteFile(rfpId, fileId);
      await loadFiles();
    } catch (err: any) {
      setError(err.message || "Failed to delete file");
      console.error("Failed to delete file:", err);
    }
  };

  const handleUpdateFileName = async (fileId: string) => {
    if (!editedFileName.trim()) {
      setEditingFileName(null);
      return;
    }

    try {
      await api.vendorRfp.rfps.updateFileName(rfpId, fileId, editedFileName.trim());
      setEditingFileName(null);
      await loadFiles();
    } catch (err: any) {
      setError(err.message || "Failed to update file name");
      console.error("Failed to update file name:", err);
    }
  };

  const handleRequirementsUpload = async (file: File, columnMapping?: ColumnMapping) => {
    if (!file) return;

    // Validate file type (must be xlsx)
    if (!file.name.endsWith('.xlsx') && !file.type.includes('spreadsheetml')) {
      setError("File must be an Excel file (.xlsx)");
      return;
    }

    setRequirementsUploading(true);
    setError("");

    try {
      const result = await api.vendorRfp.rfps.uploadRequirementsResponse(rfpId, file, columnMapping);
      
      // Check if column mapping is needed
      if (result.needsColumnMapping && result.availableColumns) {
        setColumnMappingData({
          file,
          availableColumns: result.availableColumns,
        });
        setShowColumnMapping(true);
        setRequirementsUploading(false);
        return;
      }

      // Successfully uploaded
      setRequirementsResponse(result);
      setHasUploadedFile(true);
      setShowColumnMapping(false);
      setColumnMappingData(null);
      await loadFiles(); // Reload to refresh proposal data
    } catch (err: any) {
      setError(err.message || "Failed to upload requirements response");
      console.error("Failed to upload requirements response:", err);
    } finally {
      setRequirementsUploading(false);
    }
  };

  const handleColumnMappingConfirm = (mapping: ColumnMapping) => {
    if (columnMappingData) {
      handleRequirementsUpload(columnMappingData.file, mapping);
    }
  };

  const handleColumnMappingClose = () => {
    setShowColumnMapping(false);
    setColumnMappingData(null);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const isMainContact = contactPerson?.isMainContact ?? false;
  const hasRequirementsDoc = rfp.documents.some((doc) => doc.type === "Requirements");
  const isProposalSubmitted = rfp.vendorResponse?.status === RFPVendorResponseStatus.ProposalSubmitted;

  if (loading) {
    return <div className="text-center py-12">Loading files...</div>;
  }

  if (isPreviewMode) {
    return (
      <Card>
        <CardHeader>
          <h2 className="text-2xl font-semibold text-text-primary">Delivery of Proposal</h2>
        </CardHeader>
        <CardBody>
          <div className="text-center py-12">
            <p className="text-text-secondary">Proposal submission is not available in preview mode.</p>
          </div>
        </CardBody>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <h2 className="text-2xl font-semibold text-text-primary">Delivery of Proposal</h2>
          {!isMainContact && (
            <div className="text-sm text-text-secondary mt-2">
              Only the main contact ({contactPerson?.firstName} {contactPerson?.lastName}, {contactPerson?.email}) can submit the proposal.
            </div>
          )}
        </CardHeader>
        <CardBody>
          <div className="space-y-6">
            {/* Requirements Response Upload Section */}
            {hasRequirementsDoc && (
              <Card>
                <CardHeader>
                  <h3 className="text-lg font-semibold text-text-primary">Requirements Response</h3>
                </CardHeader>
                <CardBody>
                  <div className="space-y-4">
                    <div className="text-sm text-text-secondary">
                      <p>Upload your requirements response Excel file. Download the template from the Information tab if needed.</p>
                    </div>
                    {hasUploadedFile && requirementsResponse && (() => {
                      // Calculate breakdown of answers
                      const breakdown = requirementsResponse.responses?.reduce((acc, r) => {
                        if (r.answer) {
                          const answer = r.answer as "Yes" | "No" | "Partial" | "Development";
                          acc[answer] = (acc[answer] || 0) + 1;
                        }
                        return acc;
                      }, {
                        Yes: 0,
                        No: 0,
                        Partial: 0,
                        Development: 0,
                      } as Record<string, number>) || {
                        Yes: 0,
                        No: 0,
                        Partial: 0,
                        Development: 0,
                      };

                      return (
                        <div className={`p-4 rounded-lg ${
                          requirementsResponse.percentage === 100
                            ? "bg-green-50 border border-green-200"
                            : requirementsResponse.answeredCount === 0
                            ? "bg-red-50 border border-red-200"
                            : "bg-yellow-50 border border-yellow-200"
                        }`}>
                          <div className="text-sm">
                            <p className="font-medium text-text-primary">
                              {requirementsResponse.answeredCount} of {requirementsResponse.totalRequirements} requirements answered
                            </p>
                            <div className="mt-2 space-y-1">
                              <p className="text-text-secondary">{breakdown.Yes} answered Yes</p>
                              <p className="text-text-secondary">{breakdown.No} answered No</p>
                              <p className="text-text-secondary">{breakdown.Partial} answered Partial</p>
                              <p className="text-text-secondary">{breakdown.Development} answered Development</p>
                            </div>
                            {requirementsResponse.answeredCount === 0 && (
                              <p className="text-red-700 mt-1">
                                Warning: No requirements matched. Please check that your requirement numbers match the template.
                              </p>
                            )}
                            {requirementsResponse.percentage < 100 && requirementsResponse.answeredCount > 0 && (
                              <p className="text-yellow-700 mt-1">
                                Warning: Not all requirements have been answered. Please complete all requirements before submitting your proposal.
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })()}
                    {isProposalSubmitted ? (
                      <div className="border-2 border-dashed border-border-primary rounded-lg p-6 text-center">
                        <div className="text-sm text-text-secondary">
                          <p>Your proposal has been submitted. No changes can be made to the requirements response.</p>
                        </div>
                      </div>
                    ) : (
                      <div
                        className={`relative border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer ${
                          requirementsUploading
                            ? "border-primary-500 bg-primary-50"
                            : "border-border-primary hover:border-primary-500"
                        }`}
                        onClick={() => requirementsFileInputRef.current?.click()}
                      >
                        <input
                          ref={requirementsFileInputRef}
                          type="file"
                          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              handleRequirementsUpload(file);
                            }
                          }}
                          className="hidden"
                        />
                        {requirementsUploading ? (
                          <div className="text-text-primary">Uploading...</div>
                        ) : (
                          <div className="space-y-2">
                            <div className="text-sm text-text-primary">
                              <span className="font-medium">Click to upload requirements response Excel file</span>
                            </div>
                            <p className="text-xs text-text-secondary">XLSX format only</p>
                          </div>
                        )}
                      </div>
                    )}
                    {requirementsResponse?.invalidAnswers && requirementsResponse.invalidAnswers.length > 0 && (
                      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                        <div className="text-sm">
                          <p className="font-medium text-red-800 mb-2">
                            {requirementsResponse.invalidAnswers.length} invalid answer{requirementsResponse.invalidAnswers.length > 1 ? 's' : ''} found and skipped:
                          </p>
                          <ul className="list-disc list-inside space-y-1 text-red-700">
                            {requirementsResponse.invalidAnswers.map((invalid, idx) => (
                              <li key={idx}>
                                Row {invalid.row}: Requirement {invalid.requirementNumber} has invalid answer "{invalid.invalidValue}" (must be: Yes, No, Partial, or Development)
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    )}
                  </div>
                </CardBody>
              </Card>
            )}

            {/* Files List and Upload Area - Merged */}
            <Card>
              <CardHeader>
                <h3 className="text-lg font-semibold text-text-primary">Uploaded Files</h3>
              </CardHeader>
              <CardBody>
                <div className="space-y-4">
                  {/* Uploaded files list */}
                  {files.length > 0 && (
                    <div className="space-y-3">
                      {files.map((file) => (
                        <div
                          key={file.id}
                          className="flex items-center justify-between p-3 border border-border-primary rounded-lg"
                        >
                          <div className="flex-1 min-w-0">
                            {editingFileName === file.id && !isProposalSubmitted ? (
                              <div className="flex items-center gap-2">
                                <Input
                                  value={editedFileName}
                                  onChange={(e) => setEditedFileName(e.target.value)}
                                  onBlur={() => handleUpdateFileName(file.id)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      handleUpdateFileName(file.id);
                                    } else if (e.key === "Escape") {
                                      setEditingFileName(null);
                                    }
                                  }}
                                  autoFocus
                                  className="flex-1"
                                />
                              </div>
                            ) : (
                              <div
                                className={isProposalSubmitted ? "" : "cursor-pointer"}
                                onClick={() => {
                                  if (!isProposalSubmitted) {
                                    setEditingFileName(file.id);
                                    setEditedFileName(file.fileName);
                                  }
                                }}
                              >
                                <div className="font-medium text-text-primary">{file.fileName}</div>
                                <div className="text-sm text-text-secondary">{formatFileSize(file.fileSize)}</div>
                              </div>
                            )}
                          </div>
                          {!isProposalSubmitted && (
                            <button
                              onClick={() => handleDeleteFile(file.id)}
                              className="ml-4 text-red-600 hover:text-red-700 text-sm cursor-pointer"
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* File Upload Area */}
                  {isProposalSubmitted ? (
                    <div className="border-2 border-dashed border-border-primary rounded-lg p-8 text-center">
                      <div className="text-sm text-text-secondary">
                        <p>Your proposal has been submitted. No new files can be added.</p>
                      </div>
                    </div>
                  ) : (
                    <div
                      className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
                        dragActive
                          ? "border-primary-500 bg-primary-50"
                          : "border-border-primary hover:border-primary-500"
                      }`}
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                      onMouseDown={(e) => {
                        e.preventDefault();
                      }}
                      onClick={() => {
                        fileInputRef.current?.click();
                      }}
                    >
                      <input
                        ref={fileInputRef}
                        type="file"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            handleFileSelect(file);
                          }
                        }}
                        className="hidden"
                      />
                      {uploading ? (
                        <div className="space-y-2">
                          <div className="text-text-primary">Uploading...</div>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <svg
                            className="mx-auto h-12 w-12 text-text-tertiary"
                            stroke="currentColor"
                            fill="none"
                            viewBox="0 0 48 48"
                            aria-hidden="true"
                          >
                            <path
                              d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                              strokeWidth={2}
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                          <div className="text-sm text-text-primary">
                            <span className="font-medium">Drag and drop a file here, or click to choose a file</span>
                          </div>
                          <p className="text-xs text-text-secondary">Maximum file size: 10MB</p>
                        </div>
                      )}
                    </div>
                  )}
                  {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
                </div>
              </CardBody>
            </Card>
          </div>
        </CardBody>
      </Card>
      
      {/* Column Mapping Dialog */}
      {showColumnMapping && columnMappingData && (
        <RequirementsColumnMappingDialog
          open={showColumnMapping}
          onClose={handleColumnMappingClose}
          onConfirm={handleColumnMappingConfirm}
          availableColumns={columnMappingData.availableColumns}
        />
      )}
    </>
  );
}

interface RFPProposalSubmitButtonProps {
  rfpId: string;
  rfp: RFPDetail;
  contactPerson: VendorContactPerson | null;
  onReload: () => void;
  files: RFPProposalFile[];
  requirementsResponse: {
    totalRequirements: number;
    answeredCount: number;
    percentage: number;
  } | null;
}

export function RFPProposalSubmitButton({ 
  rfpId, 
  rfp, 
  contactPerson, 
  onReload,
  files,
  requirementsResponse
}: RFPProposalSubmitButtonProps) {
  const [submitting, setSubmitting] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [reopening, setReopening] = useState(false);
  const [showReopenModal, setShowReopenModal] = useState(false);
  const [error, setError] = useState("");

  const handleSubmitProposal = async () => {
    setSubmitting(true);
    setError("");

    try {
      await api.vendorRfp.rfps.submitProposal(rfpId);
      setShowSubmitModal(false);
      await onReload();
    } catch (err: any) {
      setError(err.message || "Failed to submit proposal");
      console.error("Failed to submit proposal:", err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleReopenProposal = async () => {
    setReopening(true);
    setError("");

    try {
      await api.vendorRfp.rfps.reopenProposal(rfpId);
      setShowReopenModal(false);
      await onReload();
    } catch (err: any) {
      setError(err.message || "Failed to reopen proposal");
      console.error("Failed to reopen proposal:", err);
    } finally {
      setReopening(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const isMainContact = contactPerson?.isMainContact ?? false;
  const hasRequirementsDoc = rfp.documents.some((doc) => doc.type === "Requirements");
  // Can submit if:
  // - Requirements doc exists: need 100% match
  // - No Requirements doc: need at least 1 file
  const canSubmit = isMainContact && (
    hasRequirementsDoc
      ? (requirementsResponse && requirementsResponse.percentage === 100)
      : files.length > 0
  );
  const isResubmission = rfp.vendorResponse?.status === "ProposalSubmitted";
  const canResubmit = isResubmission && rfp.vendorResponse?.hasProposalChanges;
  const isProposalSubmitted = rfp.vendorResponse?.status === "ProposalSubmitted";

  const buttonText = isProposalSubmitted ? "Reopen Submission" : "Submit Proposal";
  const isDisabled = !isProposalSubmitted && (!canSubmit || (isResubmission && !canResubmit));

  return (
    <>
      <Button 
        onClick={() => isProposalSubmitted ? setShowReopenModal(true) : setShowSubmitModal(true)} 
        disabled={isDisabled}
        variant={isProposalSubmitted ? "secondary" : isDisabled ? "secondary" : undefined}
      >
        {buttonText}
      </Button>

      {showSubmitModal && (
        <Dialog open={true} onClose={() => setShowSubmitModal(false)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{buttonText}</DialogTitle>
              <DialogDescription>
                {isResubmission 
                  ? "Are you sure you want to resubmit your proposal? This will update your submission."
                  : "Are you sure you want to submit your proposal?"}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {hasRequirementsDoc && requirementsResponse && (
                <div>
                  <p className="text-sm font-medium text-text-primary mb-2">Requirements Response:</p>
                  <p className="text-sm text-text-secondary">
                    {requirementsResponse.answeredCount} of {requirementsResponse.totalRequirements} answered ({requirementsResponse.percentage}%)
                  </p>
                </div>
              )}
              <div>
                <p className="text-sm font-medium text-text-primary mb-2">Files to be submitted:</p>
                <ul className="list-disc list-inside space-y-1">
                  {files.map((file) => (
                    <li key={file.id} className="text-sm text-text-secondary">
                      {file.fileName} ({formatFileSize(file.fileSize)})
                    </li>
                  ))}
                </ul>
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
            </div>
            <DialogFooter>
              <Button variant="secondary" onClick={() => setShowSubmitModal(false)}>
                Cancel
              </Button>
              <Button onClick={handleSubmitProposal} disabled={submitting}>
                {submitting ? "Submitting..." : buttonText}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {showReopenModal && (
        <Dialog open={true} onClose={() => setShowReopenModal(false)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Reopen Submission</DialogTitle>
              <DialogDescription>
                Are you sure you want to reopen your submission? You will no longer have delivered your proposal, and you can make changes before submitting again.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {error && <p className="text-sm text-red-600">{error}</p>}
            </div>
            <DialogFooter>
              <Button variant="secondary" onClick={() => setShowReopenModal(false)} disabled={reopening}>
                Cancel
              </Button>
              <Button onClick={handleReopenProposal} disabled={reopening} variant="secondary">
                {reopening ? "Reopening..." : "Reopen Submission"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}


