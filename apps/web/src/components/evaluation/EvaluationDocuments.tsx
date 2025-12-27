"use client";

import { useEffect, useState } from "react";
import { api, VendorResponseWithFiles, Project } from "@/lib/api";
import { Card, CardHeader, CardBody, Button, LoadingSpinner, EmptyState } from "@/components/ui";

interface EvaluationDocumentsProps {
  projectId: string;
  project: Project | null;
}

export function EvaluationDocuments({ projectId, project }: EvaluationDocumentsProps) {
  const [vendorResponses, setVendorResponses] = useState<VendorResponseWithFiles[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloadingVendor, setDownloadingVendor] = useState<string | null>(null);
  const [downloadingAll, setDownloadingAll] = useState(false);

  useEffect(() => {
    api.rfp.vendorResponses
      .list(projectId)
      .then(setVendorResponses)
      .catch((err) => {
        setError(err.message || "Failed to load vendor documents");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [projectId]);

  // Sanitize filename to remove invalid characters
  const sanitizeFileName = (name: string): string => {
    return name.replace(/[<>:"/\\|?*]/g, "_").trim();
  };

  // Check if file type can be viewed inline in browser
  const isViewableFileType = (fileType: string): boolean => {
    const normalizedType = fileType.toLowerCase().trim();
    const viewableTypes = [
      "application/pdf",
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/gif",
      "image/webp",
      "image/svg+xml",
      "text/plain",
      "text/html",
      "text/css",
      "text/javascript",
      "text/csv",
      "application/json",
    ];
    // Check for exact match or match with parameters (e.g., "application/pdf; charset=utf-8")
    return viewableTypes.some((type) => {
      return normalizedType === type || normalizedType.startsWith(type + ";");
    });
  };

  // Handle individual file view/download
  const handleFileClick = (file: VendorResponseWithFiles["files"][0]) => {
    if (!file.fileData) return;

    // Create data URL from base64
    const dataUrl = `data:${file.fileType};base64,${file.fileData}`;

    // If viewable file type, open in new tab
    if (isViewableFileType(file.fileType)) {
      const newWindow = window.open();
      if (newWindow) {
        newWindow.location.href = dataUrl;
      } else {
        // Fallback if popup blocked - download instead
        const link = document.createElement("a");
        link.href = dataUrl;
        link.download = file.fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } else {
      // For non-viewable files, download directly
      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = file.fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  // Handle vendor-specific zip download
  const handleVendorDownload = async (vendorResponse: VendorResponseWithFiles) => {
    if (vendorResponse.files.length === 0) return;
    if (typeof window === "undefined") return;

    setDownloadingVendor(vendorResponse.id);
    try {
      // Dynamic import JSZip
      const JSZipModule = await import("jszip/dist/jszip.min.js");
      const JSZip = JSZipModule.default || JSZipModule;

      if (!JSZip) {
        throw new Error("JSZip not available");
      }

      const zip = new JSZip();
      const projectName = sanitizeFileName(project?.name || "Project");
      const vendorName = sanitizeFileName(vendorResponse.vendorName);

      // Add all files from this vendor
      for (const file of vendorResponse.files) {
        if (file.fileData) {
          const fileData = Uint8Array.from(atob(file.fileData), (c) => c.charCodeAt(0));
          zip.file(sanitizeFileName(file.fileName), fileData);
        }
      }

      // Generate zip file
      const zipBlob = await zip.generateAsync({ type: "blob" });

      // Create download link
      const zipFileName = `${projectName} - ${vendorName} - Documents.zip`;
      const url = window.URL.createObjectURL(zipBlob);
      const link = document.createElement("a");
      link.href = url;
      link.download = zipFileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error creating zip file:", error);
      alert("Failed to create zip file. Please try again.");
    } finally {
      setDownloadingVendor(null);
    }
  };

  // Handle download all vendors
  const handleDownloadAll = async () => {
    if (vendorResponses.length === 0) return;
    if (typeof window === "undefined") return;

    setDownloadingAll(true);
    try {
      // Dynamic import JSZip
      const JSZipModule = await import("jszip/dist/jszip.min.js");
      const JSZip = JSZipModule.default || JSZipModule;

      if (!JSZip) {
        throw new Error("JSZip not available");
      }

      const zip = new JSZip();
      const projectName = sanitizeFileName(project?.name || "Project");

      // Add files from each vendor in separate folders
      for (const vendorResponse of vendorResponses) {
        if (vendorResponse.files.length === 0) continue;

        const vendorName = sanitizeFileName(vendorResponse.vendorName);
        const vendorFolder = zip.folder(vendorName);

        if (vendorFolder) {
          for (const file of vendorResponse.files) {
            if (file.fileData) {
              const fileData = Uint8Array.from(atob(file.fileData), (c) => c.charCodeAt(0));
              vendorFolder.file(sanitizeFileName(file.fileName), fileData);
            }
          }
        }
      }

      // Generate zip file
      const zipBlob = await zip.generateAsync({ type: "blob" });

      // Create download link
      const zipFileName = `${projectName} - All vendors - Documents.zip`;
      const url = window.URL.createObjectURL(zipBlob);
      const link = document.createElement("a");
      link.href = url;
      link.download = zipFileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error creating zip file:", error);
      alert("Failed to create zip file. Please try again.");
    } finally {
      setDownloadingAll(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center text-red-600">
        <p>{error}</p>
      </div>
    );
  }

  if (vendorResponses.length === 0) {
    return (
      <EmptyState
        title="No documents available"
        description="No vendors have submitted their proposal documents yet."
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Download All button */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-text-primary">Vendor Documents</h2>
        <Button
          variant="secondary"
          onClick={handleDownloadAll}
          disabled={downloadingAll}
          loading={downloadingAll}
        >
          Download all
        </Button>
      </div>

      {/* Vendor documents */}
      {vendorResponses.map((vendorResponse) => (
        <Card key={vendorResponse.id}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-semibold text-text-primary">
                {vendorResponse.vendorName}
              </h3>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => handleVendorDownload(vendorResponse)}
                disabled={downloadingVendor === vendorResponse.id || vendorResponse.files.length === 0}
                loading={downloadingVendor === vendorResponse.id}
              >
                Download
              </Button>
            </div>
            {vendorResponse.proposalSubmittedAt && (
              <p className="text-sm text-text-secondary mt-1">
                Submitted: {new Date(vendorResponse.proposalSubmittedAt).toLocaleDateString()}
              </p>
            )}
          </CardHeader>
          <CardBody>
            {vendorResponse.files.length === 0 ? (
              <p className="text-text-secondary">No documents available</p>
            ) : (
              <div className="space-y-3">
                {vendorResponse.files.map((file) => (
                  <div
                    key={file.id}
                    className="flex items-center gap-3 p-3 border border-border-primary rounded hover:bg-bg-secondary transition-colors"
                  >
                    {/* File icon */}
                    <svg
                      className="w-5 h-5 text-text-secondary flex-shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                      />
                    </svg>

                    {/* File info and view/download link */}
                    <div className="flex-1 min-w-0">
                      <button
                        onClick={() => handleFileClick(file)}
                        className="font-medium text-text-primary hover:text-primary-600 text-left flex items-center gap-2 cursor-pointer w-full"
                        title={
                          isViewableFileType(file.fileType)
                            ? "Click to view in new tab"
                            : "Click to download"
                        }
                      >
                        <span className="truncate">{file.fileName}</span>
                        <span className="text-text-secondary text-sm font-normal flex-shrink-0">
                          ({(file.fileSize / 1024).toFixed(1)} KB)
                        </span>
                        {/* Icon indicator for viewable vs downloadable */}
                        {isViewableFileType(file.fileType) ? (
                          <svg
                            className="w-4 h-4 text-text-secondary flex-shrink-0"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                            />
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                            />
                          </svg>
                        ) : (
                          <svg
                            className="w-4 h-4 text-text-secondary flex-shrink-0"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                            />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      ))}
    </div>
  );
}

