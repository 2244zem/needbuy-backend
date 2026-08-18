import { z } from "zod";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value.length === 0 ? null : value))
    .nullable()
    .optional();

const optionalUrl = z
  .union([z.string().trim().url("Logo harus berupa URL yang valid").max(2000), z.literal("")])
  .transform((value) => (value === "" ? null : value))
  .nullable()
  .optional();

const optionalEmail = z
  .union([
    z.string().trim().toLowerCase().email("Format email nggak valid").max(255),
    z.literal(""),
  ])
  .transform((value) => (value === "" ? null : value))
  .nullable()
  .optional();

export const createSellerSchema = z
  .object({
    storeName: z.string().trim().min(3, "Nama perusahaan minimal 3 karakter").max(120),
    address: z.string().trim().min(10, "Alamat minimal 10 karakter").max(500),
    phone: z
      .string()
      .trim()
      .min(8, "Nomor telepon minimal 8 digit")
      .max(20)
      .regex(/^[0-9+\-\s()]+$/, "Nomor telepon hanya boleh angka, spasi, +, -, dan ()"),
    description: optionalText(2000),
    logoUrl: optionalUrl,
    businessEmail: optionalEmail,
  })
  .strict();

export const updateSellerSchema = z
  .object({
    storeName: z.string().trim().min(3).max(120).optional(),
    description: optionalText(2000),
    address: optionalText(500),
    phone: optionalText(20),
    logoUrl: optionalUrl,
    businessEmail: optionalEmail,
    vacationMode: z.boolean().optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, "Minimal satu field harus diisi.");

export const sellerIdParams = z.object({ id: z.string().uuid() }).strict();

export const listSellersQuery = z
  .object({
    q: z.string().trim().max(120).optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(50).default(10),
  })
  .strip();

export type ListSellersQuery = z.infer<typeof listSellersQuery>;
export type CreateSellerInput = z.infer<typeof createSellerSchema>;
export type UpdateSellerInput = z.infer<typeof updateSellerSchema>;
