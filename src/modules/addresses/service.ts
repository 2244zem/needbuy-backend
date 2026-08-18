import { prisma } from "../../config/prisma";
import { AppError } from "../../lib/apiError";
import type { CreateAddressInput, UpdateAddressInput } from "./schema";

const addressSelect = {
  id: true,
  label: true,
  recipientName: true,
  phone: true,
  fullAddress: true,
  city: true,
  province: true,
  postalCode: true,
  isDefault: true,
  createdAt: true,
} as const;

export async function list(userId: string) {
  return prisma.address.findMany({
    where: { userId },
    select: addressSelect,
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
  });
}

export async function create(userId: string, input: CreateAddressInput) {
  return prisma.$transaction(async (tx) => {
    if (input.isDefault) {
      await tx.address.updateMany({ where: { userId }, data: { isDefault: false } });
    }
    return tx.address.create({
      data: {
        userId,
        label: input.label ?? null,
        recipientName: input.recipientName,
        phone: input.phone,
        fullAddress: input.fullAddress,
        city: input.city,
        province: input.province,
        postalCode: input.postalCode,
        isDefault: input.isDefault,
      },
      select: addressSelect,
    });
  });
}

export async function update(userId: string, addressId: string, input: UpdateAddressInput) {
  await assertOwns(userId, addressId);

  return prisma.$transaction(async (tx) => {
    if (input.isDefault) {
      await tx.address.updateMany({ where: { userId }, data: { isDefault: false } });
    }
    return tx.address.update({
      where: { id: addressId },
      data: {
        ...(input.label !== undefined ? { label: input.label } : {}),
        ...(input.recipientName !== undefined ? { recipientName: input.recipientName } : {}),
        ...(input.phone !== undefined ? { phone: input.phone } : {}),
        ...(input.fullAddress !== undefined ? { fullAddress: input.fullAddress } : {}),
        ...(input.city !== undefined ? { city: input.city } : {}),
        ...(input.province !== undefined ? { province: input.province } : {}),
        ...(input.postalCode !== undefined ? { postalCode: input.postalCode } : {}),
        ...(input.isDefault !== undefined ? { isDefault: input.isDefault } : {}),
      },
      select: addressSelect,
    });
  });
}

export async function remove(userId: string, addressId: string) {
  await assertOwns(userId, addressId);

  const used = await prisma.order.count({ where: { addressId } });
  if (used > 0) {
    throw AppError.conflict(
      "Alamat ini udah dipakai di order dan nggak bisa dihapus.",
      "ADDRESS_IN_USE"
    );
  }

  await prisma.address.delete({ where: { id: addressId } });
  return { deleted: true };
}

async function assertOwns(userId: string, addressId: string) {
  const address = await prisma.address.findFirst({
    where: { id: addressId, userId },
    select: { id: true },
  });
  if (!address) throw AppError.notFound("Alamat nggak ketemu.");
  return address;
}

export async function requireOwnedAddress(userId: string, addressId: string) {
  return assertOwns(userId, addressId);
}
