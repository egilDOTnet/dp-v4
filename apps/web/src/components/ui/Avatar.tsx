import React from "react";

export interface AvatarProps {
  name?: string;
  src?: string;
  size?: "xs" | "sm" | "md" | "lg";
  status?: "online" | "offline" | "away";
  className?: string;
}

export const Avatar: React.FC<AvatarProps> = ({
  name,
  src,
  size = "md",
  status,
  className = "",
}) => {
  const getInitials = (name: string) => {
    const parts = name.trim().split(" ");
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  const sizeStyles = {
    xs: "w-6 h-6 text-xs",
    sm: "w-8 h-8 text-sm",
    md: "w-10 h-10 text-base",
    lg: "w-12 h-12 text-lg",
  };

  const statusColors = {
    online: "bg-green-500",
    offline: "bg-text-tertiary",
    away: "bg-amber-500",
  };

  const statusSizes = {
    xs: "w-1.5 h-1.5 border",
    sm: "w-2 h-2 border-2",
    md: "w-2.5 h-2.5 border-2",
    lg: "w-3 h-3 border-2",
  };

  return (
    <div className={`relative inline-block ${className}`}>
      <div
        className={`
          ${sizeStyles[size]} 
          rounded-full 
          flex 
          items-center 
          justify-center 
          font-semibold 
          overflow-hidden
          ${src ? "bg-background-tertiary" : "bg-primary-500 text-white"}
        `}
      >
        {src ? (
          <img
            src={src}
            alt={name || "Avatar"}
            className="w-full h-full object-cover"
          />
        ) : (
          <span>{name ? getInitials(name) : "?"}</span>
        )}
      </div>
      {status && (
        <span
          className={`
            absolute 
            bottom-0 
            right-0 
            ${statusSizes[size]} 
            ${statusColors[status]} 
            rounded-full 
            border-background-primary
          `}
        />
      )}
    </div>
  );
};
