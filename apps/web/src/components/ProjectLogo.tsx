"use client";

interface ProjectLogoProps {
  logoData: string | null;
  logoFileType: string | null;
  logoShape?: string | null;
  logoPlacement?: string | null;
  logoBorder?: string | null;
  className?: string;
}

export function ProjectLogo({
  logoData,
  logoFileType,
  logoShape = "rounded-rect",
  logoPlacement = "overlay-bottom-left",
  logoBorder = "none",
  className = "",
}: ProjectLogoProps) {
  if (!logoData) {
    return null;
  }

  // Handle null/undefined values by using defaults
  const actualShape = logoShape || "rounded-rect";
  const actualPlacement = logoPlacement || "overlay-bottom-left";
  const actualBorder = logoBorder || "none";

  // Determine shape styling
  const shapeClass = actualShape === "circle" ? "rounded-full" : "rounded-lg";

  // Determine border styling
  let borderClass = "";
  if (actualBorder === "white") {
    borderClass = "border-2 border-white";
  } else if (actualBorder === "black") {
    borderClass = "border-2 border-black";
  }

  // Base logo styling
  const logoClasses = `h-24 w-auto object-contain ${shapeClass} ${borderClass}`;

  // Determine placement classes
  const placementClasses = getPlacementClasses(actualPlacement);

  return (
    <div className={`${placementClasses} ${className}`}>
      <img
        src={`data:${logoFileType || "image/png"};base64,${logoData}`}
        alt="Project logo"
        className={logoClasses}
      />
    </div>
  );
}

function getPlacementClasses(placement: string | null | undefined): string {
  switch (placement) {
    case "above-top-left":
      return "mb-4";
    case "above-center":
      return "mb-4 flex justify-center";
    case "above-right":
      return "mb-4 flex justify-end";
    case "overlay-top-left":
      return "absolute top-4 left-4 z-10";
    case "overlay-top-right":
      return "absolute top-4 right-4 z-10";
    case "overlay-bottom-left":
      return "absolute bottom-4 left-4 z-10";
    case "overlay-bottom-right":
      return "absolute bottom-4 right-4 z-10";
    default:
      return "mb-4";
  }
}

