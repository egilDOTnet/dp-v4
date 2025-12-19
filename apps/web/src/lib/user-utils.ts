/**
 * Shared user utility functions for frontend
 */

export interface UserWithNames {
  firstName?: string | null;
  lastName?: string | null;
  name?: string | null;
  email?: string;
}

/**
 * Gets user initials (both initials when firstName and lastName are available).
 * Priority: firstName[0] + lastName[0] > firstName[0] > lastName[0] > name[0] > email[0] > "?"
 * 
 * @param user - User object with firstName, lastName, name, and/or email
 * @returns Initials string (typically 2 characters, but can be 1 or "?")
 */
export function getInitials(user: UserWithNames): string {
  if (user.firstName && user.lastName) {
    return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
  }
  if (user.firstName) {
    return user.firstName[0].toUpperCase();
  }
  if (user.lastName) {
    return user.lastName[0].toUpperCase();
  }
  if (user.name) {
    // If name exists, try to get initials from it (first two words)
    const parts = user.name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return parts[0][0].toUpperCase();
  }
  if (user.email) {
    return user.email[0].toUpperCase();
  }
  return "?";
}



