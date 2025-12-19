"use client";

interface RFIHeaderProps {
  projectName: string;
  logoData: string | null;
  logoFileType: string | null;
  bannerData: string | null;
  bannerFileType: string | null;
}

export function RFIHeader({
  projectName,
  logoData,
  logoFileType,
  bannerData,
  bannerFileType,
}: RFIHeaderProps) {
  return (
    <>
      {/* Project Logo - Left Aligned */}
      {logoData && (
        <div className="mb-8">
          <img
            src={`data:${logoFileType || "image/png"};base64,${logoData}`}
            alt={`${projectName} logo`}
            className="h-24 w-auto object-contain"
          />
        </div>
      )}

      {/* Project Banner */}
      {bannerData && (
        <div className="mb-8">
          <img
            src={`data:${bannerFileType || "image/png"};base64,${bannerData}`}
            alt={`${projectName} banner`}
            className="w-full h-auto max-h-64 object-cover rounded-lg"
          />
        </div>
      )}

      {/* Project Name */}
      <h1 className="text-4xl font-bold text-text-primary mb-6">
        {projectName}
      </h1>
    </>
  );
}


