"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { RFIHeader } from "@/components/vendor/RFIHeader";

export default function VendorRFIThankYouPage() {
  const params = useParams();
  const token = params.token as string;
  const [projectData, setProjectData] = useState<{
    name: string;
    logoData: string | null;
    logoFileType: string | null;
    bannerData: string | null;
    bannerFileType: string | null;
  } | null>(null);

  useEffect(() => {
    if (!token) return;

    api.vendor.rfi
      .getByToken(token)
      .then((data) => {
        setProjectData({
          name: data.project.name,
          logoData: data.project.logoData,
          logoFileType: data.project.logoFileType,
          bannerData: data.project.bannerData,
          bannerFileType: data.project.bannerFileType,
        });
      })
      .catch((err) => {
        console.error("Failed to load project data:", err);
      });
  }, [token]);

  return (
    <div className="max-w-4xl mx-auto">
      {projectData && (
        <RFIHeader
          projectName={projectData.name}
          logoData={projectData.logoData}
          logoFileType={projectData.logoFileType}
          bannerData={projectData.bannerData}
          bannerFileType={projectData.bannerFileType}
        />
      )}

      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="text-center max-w-2xl">
          <div className="mb-6">
            <svg
              className="mx-auto h-16 w-16 text-primary-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <h1 className="text-4xl font-bold text-text-primary mb-4">
            Thank You!
          </h1>
          <p className="text-lg text-text-secondary mb-6">
            Your response to the Request for Information for{" "}
            <strong>{projectData?.name || "this project"}</strong> has been successfully submitted.
          </p>
          <p className="text-lg text-text-secondary">
            You will be notified as soon as possible with follow-up information about the process.
          </p>
        </div>
      </div>
    </div>
  );
}
