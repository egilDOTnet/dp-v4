export const Role = {
  GlobalAdministrator: "GlobalAdministrator",
  CompanyAdministrator: "CompanyAdministrator",
  User: "User",
  Vendor: "Vendor",
} as const;

export type Role = (typeof Role)[keyof typeof Role];

export interface JWTPayload {
  userId: string;
  email: string;
  tenantId: string | null;
  role: Role;
}

