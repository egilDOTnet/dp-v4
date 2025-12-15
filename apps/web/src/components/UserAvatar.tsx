"use client";

import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/Avatar";
import { User } from "@/lib/api";
import { getInitials } from "@/lib/user-utils";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";

export interface UserAvatarProps {
  user: {
    id?: string;
    firstName?: string | null;
    lastName?: string | null;
    name?: string | null;
    email?: string;
    profileImageData?: string | null;
    profileImageFileType?: string | null;
    profileColor?: string | null;
  };
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
}

const sizeClasses = {
  sm: "h-6 w-6 text-xs",
  xs: "h-7 w-7 text-xs", // 28px - matches task check button size
  md: "h-8 w-8 text-sm",
  lg: "h-10 w-10 text-base",
};

// Default color if no profile color is set
const DEFAULT_PROFILE_COLOR = "#6366F1"; // indigo-500

/**
 * UserAvatar component that displays user profile image or initials with background color
 * If the user being displayed is the current user, it uses the up-to-date data from auth context
 */
export function UserAvatar({ user, size = "md", className }: UserAvatarProps) {
  const { user: currentUser } = useAuth();
  
  // If this is the current user, use the up-to-date profile data from auth context
  // Check by id if available, otherwise fall back to email comparison
  const isCurrentUser = user.id && currentUser?.id
    ? user.id === currentUser.id
    : user.email && currentUser?.email
    ? user.email === currentUser.email
    : false;
  
  const displayUser = isCurrentUser && currentUser
    ? currentUser
    : user;
  
  const initials = getInitials(displayUser);
  const hasImage = !!displayUser.profileImageData;
  
  // Use profile color if available, otherwise use default
  const bgColor = displayUser.profileColor || DEFAULT_PROFILE_COLOR;
  
  // Build data URL for image if available
  const imageSrc = hasImage && displayUser.profileImageData
    ? displayUser.profileImageData
    : undefined;

  return (
    <Avatar className={cn(sizeClasses[size], className)}>
      {imageSrc && (
        <AvatarImage
          src={imageSrc}
          alt={initials}
          onError={(e) => {
            // Hide image on error and show fallback
            const target = e.target as HTMLImageElement;
            target.style.display = "none";
          }}
        />
      )}
      <AvatarFallback
        className="text-white font-semibold"
        style={{ backgroundColor: bgColor }}
      >
        {initials}
      </AvatarFallback>
    </Avatar>
  );
}

