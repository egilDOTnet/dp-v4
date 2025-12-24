"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Button } from "@/components/ui";
import { RFIHeader } from "@/components/vendor/RFIHeader";

type RFIData = {
  project: {
    id: string;
    name: string;
    logoData: string | null;
    logoFileType: string | null;
    logoShape: string | null;
    logoPlacement: string | null;
    logoBorder: string | null;
    bannerData: string | null;
    bannerFileType: string | null;
  };
  rfi: {
    id: string;
    rfiInformation: string | null;
  };
  vendor: {
    name: string;
  };
  vendorResponse: {
    status: string;
    answeredAt: string | null;
  };
};

export default function VendorRFIPage() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [closed, setClosed] = useState(false);
  const [data, setData] = useState<RFIData | null>(null);

  useEffect(() => {
    if (!token) return;

    api.vendor.rfi
      .getByToken(token)
      .then((response) => {
        setData(response);
        setLoading(false);
      })
      .catch((err: any) => {
        if (err.message?.includes("closed")) {
          setClosed(true);
        } else {
          setError(err.message || "Failed to load RFI");
        }
        setLoading(false);
      });
  }, [token]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-text-secondary">Loading RFI...</p>
        </div>
      </div>
    );
  }

  if (error && !closed) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <p className="text-red-600 text-lg mb-4">{error}</p>
          <p className="text-text-secondary">
            Please check your link or contact the project administrator.
          </p>
        </div>
      </div>
    );
  }

  if (closed) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center max-w-2xl">
          <h1 className="text-3xl font-bold text-text-primary mb-4">
            RFI Closed
          </h1>
          <p className="text-text-secondary text-lg">
            This Request for Information is now closed for replies. Thank you for your interest.
          </p>
        </div>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const hasAnswered = data.vendorResponse.status === "Answered" && data.vendorResponse.answeredAt;

  return (
    <div className="max-w-4xl mx-auto">
      <RFIHeader
        projectName={data.project.name}
        logoData={data.project.logoData}
        logoFileType={data.project.logoFileType}
        logoShape={data.project.logoShape}
        logoPlacement={data.project.logoPlacement}
        logoBorder={data.project.logoBorder}
        bannerData={data.project.bannerData}
        bannerFileType={data.project.bannerFileType}
      />

      {/* RFI Information */}
      {data.rfi.rfiInformation && (
        <div className="bg-background-secondary rounded-lg p-6 mb-8">
          <div
            className="prose prose-sm max-w-none text-text-primary"
            dangerouslySetInnerHTML={{ __html: data.rfi.rfiInformation }}
          />
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex justify-center gap-4">
        {hasAnswered ? (
          <>
            <Button
              variant="primary"
              onClick={() => router.push(`/rfi/${token}/questions`)}
            >
              Edit Your Answers
            </Button>
          </>
        ) : (
          <Button
            variant="primary"
            onClick={() => router.push(`/rfi/${token}/questions`)}
          >
            Start Questionnaire
          </Button>
        )}
      </div>
    </div>
  );
}


