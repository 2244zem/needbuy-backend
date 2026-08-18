import { z } from "zod";

export const registerSchema = z
  .object({
    username: z
      .string()
      .trim()
      .min(3, "Username minimal 3 karakter")
      .max(30, "Username maksimal 30 karakter")
      .regex(/^[a-zA-Z0-9_]+$/, "Username hanya boleh huruf, angka, dan underscore"),
    email: z.string().trim().toLowerCase().email("Format email nggak valid").max(255),
    
    password: z
      .string()
      .min(8, "Password minimal 8 karakter")
      .max(128, "Password maksimal 128 karakter"),
    confirmPassword: z.string().min(1, "Konfirmasi password wajib diisi"),
  })
  .strict()
  .refine((data) => data.password === data.confirmPassword, {
    message: "Konfirmasi password nggak cocok",
    path: ["confirmPassword"],
  });

export const socialAuthSchema = z
  .object({
    provider: z.enum(["GOOGLE"], {
      errorMap: () => ({ message: "Provider harus GOOGLE" }),
    }),
    idToken: z.string().min(1, "ID token wajib diisi"),
  })
  .strict();

export const loginSchema = z
  .object({
    email: z.string().trim().toLowerCase().email().max(255),
    password: z.string().min(1).max(128),
  })
  .strict();

export const refreshSchema = z
  .object({
    refreshToken: z.string().min(32).max(256),
  })
  .strict();

export const authTokenParams = z
  .object({ token: z.string().regex(/^[a-f0-9]{64}$/, "Token nggak valid") })
  .strict();

export const forgotPasswordSchema = z
  .object({ email: z.string().trim().toLowerCase().email().max(255) })
  .strict();

export const resetPasswordSchema = z
  .object({
    password: z
      .string()
      .min(8, "Password minimal 8 karakter")
      .max(128, "Password maksimal 128 karakter"),
    confirmPassword: z.string().min(1, "Konfirmasi password wajib diisi"),
  })
  .strict()
  .refine((data) => data.password === data.confirmPassword, {
    message: "Konfirmasi password nggak cocok",
    path: ["confirmPassword"],
  });

export type RegisterInput = z.infer<typeof registerSchema>;
export type SocialAuthInput = z.infer<typeof socialAuthSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshInput = z.infer<typeof refreshSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
