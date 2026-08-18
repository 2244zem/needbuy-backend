import { z } from "zod";

export const createAddressSchema = z
  .object({
    label: z.string().trim().max(60).optional(),
    recipientName: z.string().trim().min(2).max(120),
    phone: z.string().trim().regex(/^[0-9+\-\s()]{8,20}$/, "Format nomor telepon nggak valid"),
    fullAddress: z.string().trim().min(10).max(500),
    city: z.string().trim().min(2).max(100),
    province: z.string().trim().min(2).max(100),
    postalCode: z.string().trim().regex(/^\d{5}$/, "Kode pos harus 5 digit"),
    isDefault: z.boolean().default(false),
  })
  .strict();

export const updateAddressSchema = createAddressSchema.partial().strict();

export const addressIdParams = z.object({ id: z.string().uuid() }).strict();

export type CreateAddressInput = z.infer<typeof createAddressSchema>;
export type UpdateAddressInput = z.infer<typeof updateAddressSchema>;
