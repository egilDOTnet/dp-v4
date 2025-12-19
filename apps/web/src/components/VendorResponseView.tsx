"use client";

import { useState, useEffect } from "react";
import { api, RFIVendorResponseWithAnswers, RFIQuestionType } from "@/lib/api";
import { formatISODateTime } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/Dialog";

interface VendorResponseViewProps {
  projectId: string;
  vendorResponseId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function VendorResponseView({
  projectId,
  vendorResponseId,
  open,
  onOpenChange,
}: VendorResponseViewProps) {
  const [response, setResponse] = useState<RFIVendorResponseWithAnswers | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open && vendorResponseId) {
      loadResponse();
    }
  }, [open, vendorResponseId, projectId]);

  const loadResponse = async () => {
    try {
      setLoading(true);
      setError("");
      const data = await api.rfi.vendorResponses.get(projectId, vendorResponseId);
      setResponse(data);
    } catch (err: any) {
      console.error("Error loading vendor response:", err);
      setError(err.message || "Failed to load vendor response");
    } finally {
      setLoading(false);
    }
  };

  const formatAnswer = (answer: any, questionType: RFIQuestionType, _options?: any[]) => {
    if (answer === null || answer === undefined) {
      return <span className="text-gray-400 italic">No answer provided</span>;
    }

    switch (questionType) {
      case "YesNo":
        return <span>{answer === true || answer === "true" ? "Yes" : "No"}</span>;
      case "SingleText":
      case "MultilineText":
        return <span className="whitespace-pre-wrap">{String(answer)}</span>;
      case "Dropdown":
      case "MultipleChoice":
        if (Array.isArray(answer)) {
          return (
            <ul className="list-disc list-inside space-y-1">
              {answer.map((item, idx) => (
                <li key={idx}>{String(item)}</li>
              ))}
            </ul>
          );
        }
        return <span>{String(answer)}</span>;
      case "Scale":
        return <span>{String(answer)}</span>;
      case "ContactDetails":
        if (typeof answer === "object") {
          return (
            <div className="space-y-1">
              {answer.name && <div><strong>Name:</strong> {answer.name}</div>}
              {answer.email && <div><strong>Email:</strong> {answer.email}</div>}
              {answer.phone && <div><strong>Phone:</strong> {answer.phone}</div>}
            </div>
          );
        }
        return <span>{String(answer)}</span>;
      default:
        return <span>{String(answer)}</span>;
    }
  };

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {response ? `${response.vendorName} - RFI Response` : "Vendor Response"}
          </DialogTitle>
          <DialogDescription>
            {response && (
              <>
                {response.contactPerson ? (
                  <>Contact: {response.contactPerson.firstName} {response.contactPerson.lastName} ({response.contactPerson.email})</>
                ) : (
                  <>Contact: Unknown</>
                )}
                {response.answeredAt && (
                  <> • Answered: {formatISODateTime(response.answeredAt)}</>
                )}
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
            <p className="mt-2 text-gray-600">Loading response...</p>
          </div>
        )}

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {response && !loading && (
          <div className="space-y-6 mt-4">
            {response.responses.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p>No answers provided yet.</p>
              </div>
            ) : (
              response.responses.map((r) => (
                <div key={r.id} className="border-b border-gray-200 pb-4 last:border-b-0">
                  <div className="mb-2">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {r.question.title}
                    </h3>
                    {r.question.description && (
                      <p className="text-sm text-gray-600 mt-1">{r.question.description}</p>
                    )}
                    {r.question.required && (
                      <span className="ml-2 text-xs text-red-600">Required</span>
                    )}
                  </div>
                  <div className="mt-3 p-3 bg-gray-50 rounded-md">
                    <div className="text-sm text-gray-700">
                      {formatAnswer(r.answer, r.question.type, r.question.options)}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

