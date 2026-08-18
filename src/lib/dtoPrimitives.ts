import { Prisma } from "@prisma/client";
import { z } from "zod";

export const money = z
  .union([z.instanceof(Prisma.Decimal), z.number(), z.string()])
  .transform((value) => value.toString());

export const nullableMoney = money.nullable().or(z.null());

export const isoDate = z
  .union([z.date(), z.string()])
  .transform((value) => (value instanceof Date ? value.toISOString() : value));

export const nullableIsoDate = isoDate.nullable().or(z.null());

export const rating = z
  .union([z.instanceof(Prisma.Decimal), z.number(), z.string()])
  .transform((value) => value.toString());
