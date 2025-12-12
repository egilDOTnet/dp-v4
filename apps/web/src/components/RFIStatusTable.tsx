"use client";

import { useState, useEffect } from "react";
import { api, RFIVendorResponse, RFIVendorResponseStatus } from "@/lib/api";
import { formatISODateTime } from "@/lib/utils";
import VendorResponseView from "./VendorResponseView";

interface RFIStatusTableProps {
  projectId: string;
}

export default function RFIStatusTable({ projectId }: RFIStatusTableProps) {
  const [responses, setResponses] = useState<RFIVendorResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [selectedResponseId, setSelectedResponseId] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  useEffect(() => {
    loadResponses();
  }, [projectId]);

  const loadResponses = async () => {
    try {
      setLoading(true);
      setError("");
      const data = await api.rfi.vendorResponses.list(projectId);
      console.log("Loaded vendor responses:", data);
      setResponses(data);
    } catch (err: any) {
      console.error("Error loading vendor responses:", err);
      const errorMessage = err.message || err.error?.message || "Failed to load vendor responses";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async (vendorId: string) => {
    setResendingId(vendorId);
    try {
      await api.rfi.resend(projectId, vendorId);
      await loadResponses();
    } catch (err: any) {
      setError(err.message || "Failed to resend RFI");
    } finally {
      setResendingId(null);
    }
  };

  const getStatusBadge = (status: RFIVendorResponseStatus) => {
    if (!status) {
      return (
        <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
          Not Sent
        </span>
      );
    }
    const styles = {
      Sent: "bg-blue-100 text-blue-800",
      Received: "bg-yellow-100 text-yellow-800",
      Answered: "bg-primary-100 text-primary-800",
      Rejected: "bg-red-100 text-red-800",
    };
    return (
      <span
        className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status]}`}
      >
        {status}
      </span>
    );
  };

  const formatDateTime = (dateString: string | null) => {
    return formatISODateTime(dateString);
  };

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
        <p className="mt-2 text-gray-600">Loading status...</p>
      </div>
    );
  }

  if (responses.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p>No vendors have been sent the RFI yet.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      {error && (
        <div className="p-3 bg-red-50 border-b border-red-200">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Vendor
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Main Contact
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Sent At
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Answered At
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {responses.map((response, index) => (
              <tr 
                key={response.id || `vendor-${response.vendorId}-${index}`}
                className={`hover:bg-gray-50 ${response.status === "Answered" ? "cursor-pointer" : ""}`}
                onClick={() => {
                  if (response.status === "Answered" && response.id) {
                    setSelectedResponseId(response.id);
                    setIsDialogOpen(true);
                  }
                }}
              >
                <td className="px-4 py-4 whitespace-nowrap">
                  <div className={`text-sm font-medium ${response.status === "Answered" ? "text-primary-600 hover:text-primary-700" : "text-gray-900"}`}>
                    {response.vendorName || "Unknown Vendor"}
                  </div>
                </td>
                <td className="px-4 py-4 whitespace-nowrap">
                  {response.contactPerson ? (
                    <>
                      <div className="text-sm text-gray-900">
                        {response.contactPerson.firstName}{" "}
                        {response.contactPerson.lastName}
                      </div>
                      <div className="text-sm text-gray-500">
                        {response.contactPerson.email}
                      </div>
                    </>
                  ) : (
                    <div className="text-sm text-gray-400 italic">No contact person</div>
                  )}
                </td>
                <td className="px-4 py-4 whitespace-nowrap">
                  {getStatusBadge(response.status)}
                </td>
                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                  {formatDateTime(response.sentAt)}
                </td>
                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                  {formatDateTime(response.answeredAt)}
                </td>
                <td className="px-4 py-4 whitespace-nowrap text-right text-sm font-medium">
                  {response.status ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleResend(response.vendorId);
                      }}
                      disabled={resendingId === response.vendorId}
                      className="text-primary-600 hover:text-primary-700 disabled:opacity-50"
                    >
                      {resendingId === response.vendorId ? "Resending..." : "Resend"}
                    </button>
                  ) : (
                    <span className="text-gray-400 text-xs">Not sent</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {selectedResponseId && (
        <VendorResponseView
          projectId={projectId}
          vendorResponseId={selectedResponseId}
          open={isDialogOpen}
          onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) {
              setSelectedResponseId(null);
            }
          }}
        />
      )}
    </div>
  );
}
