import { z } from "zod";

export const listInventQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().trim().optional(),
  status: z.enum(["ACTIVE", "INACTIVE", "ALL"]).optional(),
  categoryId: z.string().uuid().optional(),
  
  sortBy: z.enum(["name", "price", "stock", "createdAt"]).optional(),
  order: z.enum(["asc", "desc"]).default("desc"),
});

export type ListInventQuery = z.infer<typeof listInventQuery>;

const imageInput = z
  .object({
    url: z.string().trim().url("URL gambar nggak valid").max(2000),
    isPrimary: z.boolean().optional().default(false),
    sortOrder: z.number().int().min(0).max(50).optional(),
  })
  .strict();

const imagesInput = z.array(imageInput).max(10, "Maksimal 10 gambar per produk");

const attributeInput = z
  .object({
    attrKey: z.string().trim().min(1).max(60),
    attrValue: z.string().trim().min(1).max(200),
  })
  .strict();

const attributesInput = z.array(attributeInput).max(40, "Maksimal 40 spesifikasi per produk");

const discountPercent = z.number().int().min(0).max(90);

const bulkMinQty = z.number().int().min(2, "Minimal beli untuk grosir mulai dari 2").max(1000).nullable();
const bulkDiscountPercent = z.number().int().min(1).max(90).nullable();

export const createInventSchema = z
  .object({
    name: z.string().trim().min(2, "Nama produk minimal 2 karakter").max(200),
    sku: z.string().trim().min(2).max(100).optional(),
    description: z.string().trim().max(5000).optional(),
    categoryId: z.string().uuid("ID Kategori harus UUID yang valid"),
    price: z
      .union([z.number(), z.string()])
      .refine((val) => !isNaN(Number(val)) && Number(val) > 0, "Harga harus angka positif"),
    stock: z.number().int().min(0, "Stok nggak boleh negatif"),
    isActive: z.boolean().optional().default(true),
    discountPercent: discountPercent.optional(),
    bulkMinQty: bulkMinQty.optional(),
    bulkDiscountPercent: bulkDiscountPercent.optional(),
    images: imagesInput.optional(),
    attributes: attributesInput.optional(),
  })
  .strict()
  .refine(
    (data) => (data.bulkMinQty == null) === (data.bulkDiscountPercent == null),
    "Diskon grosir butuh minimal beli DAN persen potongannya, isi keduanya atau kosongkan keduanya."
  );

export type CreateInventInput = z.infer<typeof createInventSchema>;

export const updateInventSchema = z
  .object({
    name: z.string().trim().min(2).max(200).optional(),
    sku: z.string().trim().min(2).max(100).optional(),
    description: z.string().trim().max(5000).optional(),
    categoryId: z.string().uuid().optional(),
    price: z
      .union([z.number(), z.string()])
      .refine((val) => !isNaN(Number(val)) && Number(val) > 0, "Harga harus angka positif")
      .optional(),
    stock: z.number().int().min(0).optional(),
    isActive: z.boolean().optional(),
    discountPercent: discountPercent.optional(),
    bulkMinQty: bulkMinQty.optional(),
    bulkDiscountPercent: bulkDiscountPercent.optional(),
    
    images: imagesInput.optional(),
    attributes: attributesInput.optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, "Minimal satu field harus diisi untuk update")
  .refine(
    (data) =>
      !("bulkMinQty" in data || "bulkDiscountPercent" in data) ||
      (data.bulkMinQty == null) === (data.bulkDiscountPercent == null),
    "Diskon grosir butuh minimal beli DAN persen potongannya, isi keduanya atau kosongkan keduanya."
  );

export type UpdateInventInput = z.infer<typeof updateInventSchema>;

export const inventIdParams = z.object({
  id: z.string().uuid("ID produk harus UUID"),
});

export type InventIdParams = z.infer<typeof inventIdParams>;
