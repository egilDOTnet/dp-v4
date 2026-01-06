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

export const updateProfileSchema = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  companyName: z.string().min(1).optional(),
});

export const createUserSchema = z.object({
  email: z.string().email(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
});

export const addProjectMembersSchema = z.object({
  memberIds: z.array(z.string()).min(1),
});

