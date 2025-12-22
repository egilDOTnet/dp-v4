"use client";

import { ProjectLogo } from "@/components/ProjectLogo";

interface RFIHeaderProps {
  projectName: string;
  logoData: string | null;
  logoFileType: string | null;
  logoShape?: string | null;
  logoPlacement?: string | null;
  logoBorder?: string | null;
  bannerData: string | null;
  bannerFileType: string | null;
}

export function RFIHeader({
  projectName,
  logoData,
  logoFileType,
  logoShape,
  logoPlacement,
  logoBorder,
  bannerData,
  bannerFileType,
}: RFIHeaderProps) {
  return (
    <>
      {/* Logo above banner (if placement is "above" mode) */}
      {logoData && 
       logoPlacement?.startsWith("above") && (
        <div className="mb-8">
          <ProjectLogo
            logoData={logoData}
            logoFileType={logoFileType}
            logoShape={logoShape}
            logoPlacement={logoPlacement}
            logoBorder={logoBorder}
            className=""
          />
        </div>
      )}

      {/* Banner with Logo Overlay */}
      {(bannerData || (logoData && logoPlacement?.startsWith("overlay"))) ? (
        <div className="mb-8 relative rounded-lg overflow-hidden min-h-[200px]">
          {bannerData ? (
            <img
              src={`data:${bannerFileType || "image/png"};base64,${bannerData}`}
              alt={`${projectName} banner`}
              className="w-full h-auto max-h-64 object-contain rounded-lg"
            />
          ) : (
            /* Transparent placeholder when no banner but overlay logo exists */
            <div className="w-full min-h-[200px] bg-transparent rounded-lg" />
          )}
          {/* Logo overlay on banner (if placement is "overlay" mode) */}
          {logoData && logoPlacement?.startsWith("overlay") && (
            <ProjectLogo
              logoData={logoData}
              logoFileType={logoFileType}
              logoShape={logoShape}
              logoPlacement={logoPlacement}
              logoBorder={logoBorder}
              className=""
            />
          )}
        </div>
      ) : null}

      {/* Project Name */}
      <h1 className="text-4xl font-bold text-text-primary mb-6">
        {projectName}
      </h1>
    </>
  );
}



