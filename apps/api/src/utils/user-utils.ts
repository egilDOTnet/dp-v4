/**
 * User utility functions for common user-related operations
 */

interface UserWithNames {
  firstName: string | null;
  lastName: string | null;
  name: string | null;
}

/**
 * Computes a display name from user's firstName, lastName, and name fields.
 * Priority: "firstName lastName" > firstName > lastName > name > null
 * 
 * @param user - User object with firstName, lastName, and name fields
 * @returns Display name string or null
 */
export function computeDisplayName(user: UserWithNames): string | null {
  if (user.firstName && user.lastName) {
    return `${user.firstName} ${user.lastName}`;
  }
  return user.firstName || user.lastName || user.name || null;
}

/**
 * Formats a user object for API responses with computed display name.
 * 
 * @param user - User object with id, email, firstName, lastName, name, and optionally role, tenantId
 * @returns Formatted user object with computed display name
 */
export function formatUserResponse(user: {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  name: string | null;
  role?: string;
  tenantId?: string | null;
  companyName?: string | null;
}): {
  id: string;
  email: string;
  name: string | null;
  firstName: string | null;
  lastName: string | null;
  role?: string;
  tenantId?: string | null;
  companyName?: string | null;
} {
  return {
    id: user.id,
    email: user.email,
    name: computeDisplayName(user),
    firstName: user.firstName,
    lastName: user.lastName,
    ...(user.role !== undefined && { role: user.role }),
    ...(user.tenantId !== undefined && { tenantId: user.tenantId }),
    ...(user.companyName !== undefined && { companyName: user.companyName }),
  };
}
