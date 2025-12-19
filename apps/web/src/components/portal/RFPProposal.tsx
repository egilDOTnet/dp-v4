"use client";

import { useState, useRef, useEffect } from "react";
import { RFPDetail, RFPProposalFile, VendorContactPerson, api } from "@/lib/api";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/FormField";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui";
import { Input } from "@/components/ui/FormField";

interface RFPProposalProps {
  rfpId: string;
  rfp: RFPDetail;
  contactPerson: VendorContactPerson | null;
  onReload: () => void;
  isPreviewMode?: boolean;
}

export function RFPProposal({ rfpId, rfp, contactPerson, onReload, isPreviewMode = false }: RFPProposalProps) {
  const [files, setFiles] = useState<RFPProposalFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [error, setError] = useState("");
  const [editingFileName, setEditingFileName] = useState<string | null>(null);
  const [editedFileName, setEditedFileName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);

  useEffect(() => {
    if (!isPreviewMode) {
      loadFiles();
    } else {
      // In preview mode, don't load files (read-only)
      setFiles([]);
      setLoading(false);
    }
  }, [rfpId, isPreviewMode]);

  const loadFiles = async () => {
    try {
      const data = await api.vendorRfp.rfps.getProposal(rfpId);
      setFiles(data);
    } catch (err: any) {
      setError(err.message || "Failed to load proposal files");
      console.error("Failed to load files:", err);
    } finally {
      setLoading(false);
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

  const handleSubmitProposal = async () => {
    setSubmitting(true);
    setError("");

    try {
      await api.vendorRfp.rfps.submitProposal(rfpId);
      setShowSubmitModal(false);
      await onReload(); // Reload RFP to get updated status
    } catch (err: any) {
      setError(err.message || "Failed to submit proposal");
      console.error("Failed to submit proposal:", err);
    } finally {
      setSubmitting(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const isMainContact = contactPerson?.isMainContact ?? false;
  const canSubmit = isMainContact && files.length > 0 && !isPreviewMode;

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
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-semibold text-text-primary">Delivery of Proposal</h2>
            {canSubmit && (
              <Button onClick={() => setShowSubmitModal(true)}>Submit Proposal</Button>
            )}
          </div>
          {!isMainContact && (
            <div className="text-sm text-text-secondary mt-2">
              Only the main contact ({contactPerson?.firstName} {contactPerson?.lastName}, {contactPerson?.email}) can submit the proposal.
            </div>
          )}
        </CardHeader>
        <CardBody>
          <div className="space-y-6">
            {/* File Upload Area */}
            <Card>
              <CardHeader>
                <h3 className="text-lg font-semibold text-text-primary">Upload Files</h3>
              </CardHeader>
              <CardBody>
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
                {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
              </CardBody>
            </Card>

            {/* Files List */}
            {files.length > 0 && (
              <Card>
                <CardHeader>
                  <h3 className="text-lg font-semibold text-text-primary">Uploaded Files</h3>
                </CardHeader>
                <CardBody>
                  <div className="space-y-3">
                    {files.map((file) => (
                      <div
                        key={file.id}
                        className="flex items-center justify-between p-3 border border-border-primary rounded-lg"
                      >
                        <div className="flex-1 min-w-0">
                          {editingFileName === file.id ? (
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
                              className="cursor-pointer"
                              onClick={() => {
                                setEditingFileName(file.id);
                                setEditedFileName(file.fileName);
                              }}
                            >
                              <div className="font-medium text-text-primary">{file.fileName}</div>
                              <div className="text-sm text-text-secondary">{formatFileSize(file.fileSize)}</div>
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => handleDeleteFile(file.id)}
                          className="ml-4 text-red-600 hover:text-red-700 text-sm"
                        >
                          Delete
                        </button>
                      </div>
                    ))}
                  </div>
                </CardBody>
              </Card>
            )}
          </div>
        </CardBody>
      </Card>

      {/* Submit Proposal Modal */}
      {showSubmitModal && (
        <Dialog open={true} onClose={() => setShowSubmitModal(false)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Submit Proposal</DialogTitle>
              <DialogDescription>
                Are you sure you want to submit your proposal? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
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
                {submitting ? "Submitting..." : "Submit Proposal"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
