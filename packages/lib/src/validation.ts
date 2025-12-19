import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().optional(),
});

export const magicLinkSchema = z.object({
  email: z.string().email(),
});

export const setPasswordSchema = z.object({
  token: z.string(),
  password: z.string().min(8),
});

export const createProjectSchema = z.object({
  name: z.string().min(1),
  type: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  memberIds: z.array(z.string()).optional(),
});

// 16-color palette for profile colors (hex codes)
export const PROFILE_COLOR_PALETTE = [
  "#EF4444", // red-500
  "#F97316", // orange-500
  "#F59E0B", // amber-500
  "#EAB308", // yellow-500
  "#84CC16", // lime-500
  "#22C55E", // green-500
  "#10B981", // emerald-500
  "#14B8A6", // teal-500
  "#06B6D4", // cyan-500
  "#0EA5E9", // sky-500
  "#3B82F6", // blue-500
  "#6366F1", // indigo-500
  "#8B5CF6", // violet-500
  "#A855F7", // purple-500
  "#D946EF", // fuchsia-500
  "#EC4899", // pink-500
] as const;

export const updateProfileSchema = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  companyName: z.string().min(1).optional(),
  profileImageData: z.string().optional().nullable(),
  profileImageFileType: z.union([
    z.enum(["image/png", "image/jpeg", "image/gif"]),
    z.null(),
  ]).optional(),
  profileColor: z.union([
    z.enum([
      "#EF4444", "#F97316", "#F59E0B", "#EAB308",
      "#84CC16", "#22C55E", "#10B981", "#14B8A6",
      "#06B6D4", "#0EA5E9", "#3B82F6", "#6366F1",
      "#8B5CF6", "#A855F7", "#D946EF", "#EC4899",
    ]),
    z.null(),
  ]).optional(),
});

export const createUserSchema = z.object({
  email: z.string().email(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
});

export const addProjectMembersSchema = z.object({
  memberIds: z.array(z.string()).min(1),
});

