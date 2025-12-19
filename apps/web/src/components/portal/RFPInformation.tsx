"use client";

import { RFPDetail } from "@/lib/api";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/Table";
import { formatISODate, formatISODateTime } from "@/lib/utils";

interface RFPInformationProps {
  rfp: RFPDetail;
}

export function RFPInformation({ rfp }: RFPInformationProps) {
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

        {/* Column 3: Documents/Links */}
        <Card>
          <CardHeader>
            <h2 className="text-xl font-semibold text-text-primary">Documents</h2>
          </CardHeader>
          <CardBody>
            <div className="space-y-3">
              {rfp.documents.length > 0 ? (
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
                          className="font-medium text-text-primary hover:text-primary-600 break-all"
                        >
                          {doc.description}
                        </a>
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
                    <TableCell className="text-text-secondary">
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
