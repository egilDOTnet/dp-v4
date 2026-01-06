"use client";

import { useState, useEffect } from "react";
import { api, RFIVendorResponse, RFIVendorResponseStatus } from "@/lib/api";

interface RFIStatusTableProps {
  projectId: string;
}

export default function RFIStatusTable({ projectId }: RFIStatusTableProps) {
  const [responses, setResponses] = useState<RFIVendorResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [resendingId, setResendingId] = useState<string | null>(null);

  useEffect(() => {
    loadResponses();
  }, [projectId]);

  const loadResponses = async () => {
    try {
      setLoading(true);
      setError("");
      const data = await api.rfi.vendorResponses.list(projectId);
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
    if (!dateString) return "-";
    const date = new Date(dateString);
    return date.toLocaleString();
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
            {responses.map((response) => (
              <tr key={response.id} className="hover:bg-gray-50">
                <td className="px-4 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">
                    {response.vendorName}
                  </div>
                </td>
                <td className="px-4 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">
                    {response.contactPerson.firstName}{" "}
                    {response.contactPerson.lastName}
                  </div>
                  <div className="text-sm text-gray-500">
                    {response.contactPerson.email}
                  </div>
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
                  <button
                    onClick={() => handleResend(response.vendorId)}
                    disabled={resendingId === response.vendorId}
                    className="text-primary-600 hover:text-primary-700 disabled:opacity-50"
                  >
                    {resendingId === response.vendorId ? "Resending..." : "Resend"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
