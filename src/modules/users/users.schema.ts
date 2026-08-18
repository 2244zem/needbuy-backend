import { z } from "zod";

export const updateProfileSchema = z
  .object({
    name: z.string().trim().min(2, "Nama minimal 2 karakter").max(100),
    phone: z
      .string()
      .trim()
      .regex(/^[0-9+\-\s()]{8,20}$/, "Format nomor telepon nggak valid")
      .nullable(),
    
    avatarUrl: z
      .string()
      .trim()
      .max(500)
      .regex(/^https?:\/\/\S+$/i, "URL foto harus http(s)")
      .nullable(),
  })
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "Minimal satu field harus diisi",
  });

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Password saat ini wajib diisi").max(128),
    newPassword: z
      .string()
      .min(8, "Password baru minimal 8 karakter")
      .max(128, "Password baru maksimal 128 karakter"),
  })
  .strict()
  .refine((value) => value.currentPassword !== value.newPassword, {
    message: "Password baru harus berbeda dari password saat ini",
    path: ["newPassword"],
  });

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
