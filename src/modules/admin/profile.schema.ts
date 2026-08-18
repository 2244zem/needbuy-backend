import { z } from "zod";

export const profileIdParams = z.object({ id: z.string().uuid() }).strict();

export const updateProfileSchema = z
  .object({
    fullName: z.string().trim().min(2, "Nama minimal 2 karakter").max(100).optional(),
    email: z.string().trim().email("Format email nggak valid").optional(),
    newPassword: z.string().min(8, "Password minimal 8 karakter").max(100).optional(),
    photoUrl: z.string().url("URL foto nggak valid").optional(),
  })
  .strict();

export const createProfileSchema = z
  .object({
    userId: z.string().uuid(),
    fullName: z.string().trim().min(2, "Nama minimal 2 karakter").max(100),
    email: z.string().trim().email("Format email nggak valid"),
    photoUrl: z.string().url("URL foto nggak valid").optional(),
  })
  .strict();
