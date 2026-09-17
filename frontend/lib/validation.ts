import { z } from "zod";

/**
 * Client-side validation is for fast feedback only. The backend re-validates
 * everything; never treat a passing form as an authorization or safety check.
 */

export const loginSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(1, "Enter your password"),
});

export const registerSchema = z.object({
  email: z.string().email("Enter a valid email address").max(320),
  // Mirrors RegisterRequest: length over composition rules.
  password: z.string().min(10, "Use at least 10 characters").max(128),
  displayName: z.string().min(1, "Tell us what to call you").max(120),
  timezone: z.string().max(64).optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
