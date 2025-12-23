"use client";

import { useState } from "react";
import { RFPDetail, api } from "@/lib/api";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/Table";
import { Button } from "@/components/ui/FormField";
import { formatISODate, formatISODateTime } from "@/lib/utils";
import { CheckSquare } from "lucide-react";

interface RFPInformationProps {
  rfp: RFPDetail;
  isDeclined?: boolean;
}

export function RFPInformation({ rfp, isDeclined = false }: RFPInformationProps) {
  const [downloadingAll, setDownloadingAll] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [downloadingExcel, setDownloadingExcel] = useState(false);

  // Get project ID from RFP - RFPDetail extends RFPListItem which has projectId
  const projectId = rfp.projectId;

  const handleDocumentDownload = (doc: RFPDetail["documents"][0]) => {
    if (!doc.fileData || !doc.fileName || !doc.fileType) return;
    
    // Create data URL from base64
    const dataUrl = `data:${doc.fileType};base64,${doc.fileData}`;
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = doc.fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Detect user's operating system
  const detectOS = (): "windows" | "macos" | "ios" | "other" => {
    if (typeof window === "undefined") return "other";
    
    const userAgent = window.navigator.userAgent.toLowerCase();
    const platform = window.navigator.platform.toLowerCase();
    
    if (userAgent.includes("win") || platform.includes("win")) {
      return "windows";
    }
    if (userAgent.includes("mac") || platform.includes("mac")) {
      return "macos";
    }
    if (userAgent.includes("iphone") || userAgent.includes("ipad")) {
      return "ios";
    }
    return "other";
  };

  // Generate Windows .url file content
  const generateUrlFile = (url: string): string => {
    return `[InternetShortcut]\r\nURL=${url}\r\n`;
  };

  // Generate macOS/iOS .webloc file content (XML plist format)
  const generateWeblocFile = (url: string): string => {
    // Escape XML special characters in URL
    const escapedUrl = url
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
    
    return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>URL</key>
    <string>${escapedUrl}</string>
</dict>
</plist>`;
  };

  // Sanitize filename to remove invalid characters
  const sanitizeFileName = (name: string): string => {
    return name.replace(/[<>:"/\\|?*]/g, "_").trim();
  };

  // Handle downloading all documents as a zip
  const handleDownloadAll = async () => {
    if (rfp.documents.length === 0) return;
    if (typeof window === "undefined") return; // Only run on client
    
    setDownloadingAll(true);
    try {
      // Dynamic import JSZip - use browser build for better compatibility
      const JSZipModule = await import("jszip/dist/jszip.min.js");
      const JSZip = JSZipModule.default || JSZipModule;
      
      if (!JSZip) {
        throw new Error("JSZip not available");
      }
      
      const zip = new JSZip();
      const os = detectOS();
      const isWindows = os === "windows";
      const isMacOrIOS = os === "macos" || os === "ios";

      // Process each document
      for (const doc of rfp.documents) {
        if (doc.type === "Document" && doc.fileName && doc.fileData) {
          // Add document file to zip
          const fileData = Uint8Array.from(atob(doc.fileData), (c) => c.charCodeAt(0));
          zip.file(sanitizeFileName(doc.fileName), fileData);
        } else if (doc.type === "Link" && doc.url) {
          // Create link file based on OS
          const linkFileName = sanitizeFileName(doc.description || "link");
          
          if (isWindows) {
            // Create .url file for Windows
            const urlContent = generateUrlFile(doc.url);
            zip.file(`${linkFileName}.url`, urlContent);
          } else if (isMacOrIOS) {
            // Create .webloc file for macOS/iOS
            const weblocContent = generateWeblocFile(doc.url);
            zip.file(`${linkFileName}.webloc`, weblocContent);
          } else {
            // For other OS, create a simple text file with the URL
            zip.file(`${linkFileName}.txt`, `URL: ${doc.url}\nDescription: ${doc.description || ""}`);
          }
        }
      }

      // Add Requirements PDF and Excel using vendor-specific endpoints
      // These endpoints work with vendor contact authentication
      try {
        // Download Requirements PDF
        const pdfBlob = await api.vendorRfp.rfps.downloadRequirementsPdf(rfp.id);
        const pdfArrayBuffer = await pdfBlob.arrayBuffer();
        const pdfFileName = `${sanitizeFileName(rfp.project?.name || "Requirements")}_Requirements.pdf`;
        zip.file(pdfFileName, pdfArrayBuffer);

        // Download Requirements Excel
        const excelBlob = await api.vendorRfp.rfps.downloadRequirementsExcel(rfp.id);
        const excelArrayBuffer = await excelBlob.arrayBuffer();
        const excelFileName = `${sanitizeFileName(rfp.project?.name || "Requirements")}_Requirements.xlsx`;
        zip.file(excelFileName, excelArrayBuffer);
      } catch (err: any) {
        // Silently skip requirements if download fails
        console.warn("Could not include requirements in zip:", err.message || err);
      }

      // Generate zip file
      const zipBlob = await zip.generateAsync({ type: "blob" });
      
      // Create download link
      const projectName = sanitizeFileName(rfp.project.name);
      const zipFileName = `${projectName}.zip`;
      
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

  return (
    <div className="space-y-8">
      {/* Three-column layout */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Column 1: About the RFP */}
        <Card>
          <CardHeader>
            <h2 className="text-xl font-semibold text-text-primary">About the RFP</h2>
          </CardHeader>
          <CardBody>
            {rfp.about ? (
              <div
                className="prose prose-sm max-w-none text-text-primary"
                dangerouslySetInnerHTML={{ __html: rfp.about }}
              />
            ) : (
              <p className="text-text-secondary">No description provided.</p>
            )}
          </CardBody>
        </Card>

        {/* Column 2: Schedule */}
        <Card>
          <CardHeader>
            <h2 className="text-xl font-semibold text-text-primary">Schedule</h2>
          </CardHeader>
          <CardBody>
            <div className="space-y-3">
              {rfp.scheduleItems.length > 0 ? (
                rfp.scheduleItems.map((item) => (
                  <div key={item.id}>
                    <div className="font-medium text-text-primary mb-1">{item.description}</div>
                    <div className="text-sm text-text-secondary">
                      {item.date
                        ? formatISODate(item.date)
                        : item.fromDate && item.toDate
                        ? `${formatISODate(item.fromDate)} - ${formatISODate(item.toDate)}`
                        : "Not set"}
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-text-secondary">No schedule items.</p>
              )}
            </div>
          </CardBody>
        </Card>

        {/* Column 3: Documents */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-text-primary">Documents</h2>
              {!isDeclined && (rfp.documents.length > 0 || projectId) && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleDownloadAll}
                  disabled={downloadingAll}
                  loading={downloadingAll}
                >
                  Get all
                </Button>
              )}
            </div>
          </CardHeader>
          <CardBody>
            <div className="space-y-3">
              {isDeclined ? (
                <div className="py-8 text-center">
                  <p className="text-text-primary text-lg mb-2">
                    We are sorry to see you leave, but hope we can return to you in the future.
                  </p>
                </div>
              ) : rfp.documents.length > 0 ? (
                rfp.documents.map((doc) => (
                  <div key={doc.id} className="border-b border-border-primary pb-3 last:border-0">
                    {doc.type === "Document" && doc.fileName && doc.fileData ? (
                      <div className="flex items-center gap-2">
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
                            d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                          />
                        </svg>
                        <button
                          onClick={() => handleDocumentDownload(doc)}
                          className="font-medium text-text-primary hover:text-primary-600 text-left flex items-center gap-1 cursor-pointer"
                        >
                          {doc.description}
                          {doc.fileSize && (
                            <span className="text-text-secondary text-sm font-normal">
                              ({(doc.fileSize / 1024).toFixed(1)} KB)
                            </span>
                          )}
                        </button>
                      </div>
                    ) : doc.type === "Link" && doc.url ? (
                      <div className="flex items-center gap-2">
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
                            d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                          />
                        </svg>
                        <a
                          href={doc.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium text-text-primary hover:text-primary-600 break-all cursor-pointer"
                        >
                          {doc.description}
                        </a>
                      </div>
                    ) : doc.type === "Requirements" ? (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <CheckSquare className="w-4 h-4 text-text-secondary flex-shrink-0" />
                          <span className="font-medium text-text-primary">{doc.description}</span>
                        </div>
                        <div className="flex items-center gap-3 ml-6 text-sm">
                          <button
                            onClick={async () => {
                              if (!projectId) return;
                              try {
                                setDownloadingPdf(true);
                                const blob = await api.requirements.downloadPdf(projectId);
                                const url = window.URL.createObjectURL(blob);
                                const link = document.createElement("a");
                                link.href = url;
                                link.download = `${rfp.project?.name || "Requirements"}_Requirements.pdf`;
                                document.body.appendChild(link);
                                link.click();
                                document.body.removeChild(link);
                                window.URL.revokeObjectURL(url);
                              } catch (err: any) {
                                console.error("Error downloading PDF:", err);
                                alert("Failed to download PDF. Please try again.");
                              } finally {
                                setDownloadingPdf(false);
                              }
                            }}
                            disabled={downloadingPdf}
                            className="text-primary-600 hover:text-primary-700 hover:underline disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                          >
                            PDF
                          </button>
                          <button
                            onClick={async () => {
                              if (!projectId) return;
                              try {
                                setDownloadingExcel(true);
                                const blob = await api.requirements.downloadExcel(projectId);
                                const url = window.URL.createObjectURL(blob);
                                const link = document.createElement("a");
                                link.href = url;
                                link.download = `${rfp.project?.name || "Requirements"}_Requirements.xlsx`;
                                document.body.appendChild(link);
                                link.click();
                                document.body.removeChild(link);
                                window.URL.revokeObjectURL(url);
                              } catch (err: any) {
                                console.error("Error downloading Excel:", err);
                                alert("Failed to download Excel. Please try again.");
                              } finally {
                                setDownloadingExcel(false);
                              }
                            }}
                            disabled={downloadingExcel}
                            className="text-primary-600 hover:text-primary-700 hover:underline disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                          >
                            Excel
                          </button>
                          <span className="text-text-tertiary">Inline editing</span>
                          <span className="text-xs text-text-tertiary italic">(Coming soon)</span>
                        </div>
                      </div>
                    ) : (
                      <div className="font-medium text-text-primary">{doc.description}</div>
                    )}
                  </div>
                ))
              ) : (
                <p className="text-text-secondary">No documents.</p>
              )}
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Changelog Table */}
      {rfp.changelogEntries.length > 0 && (
        <Card>
          <CardHeader>
            <h2 className="text-xl font-semibold text-text-primary">Changelog</h2>
          </CardHeader>
          <CardBody>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-1/4">Date</TableHead>
                  <TableHead className="w-3/4">Description</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rfp.changelogEntries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="text-text-secondary align-top">
                      {formatISODateTime(entry.createdAt)}
                    </TableCell>
                    <TableCell className="text-text-primary whitespace-pre-line">
                      {entry.description}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
