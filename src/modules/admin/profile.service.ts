import bcrypt from "bcryptjs";
import { prisma } from "../../config/prisma";
import { env } from "../../config/env";
import { AppError } from "../../lib/apiError";

export interface AdminProfileItem {
  id: string;
  userId: string;
  fullName: string;
  email: string;
  photoUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PublicAdminProfile {
  id: string;
  fullName: string;
  email: string;
  photoUrl: string | null;
}

export interface GetProfileResponse extends PublicAdminProfile {}

export interface UpdateProfileInput {
  fullName?: string;
  email?: string;
  newPassword?: string;
  photoUrl?: string;
}

export interface CreateProfileInput {
  userId: string;
  fullName: string;
  email: string;
  photoUrl?: string;
}

export async function getProfile(userId: string): Promise<AdminProfileItem> {
  const profile = await prisma.adminProfile.findUnique({ where: { userId } });
  if (!profile) throw AppError.notFound("Profil admin nggak ketemu.");
  return profile;
}

export async function getProfileById(id: string): Promise<AdminProfileItem> {
  const profile = await prisma.adminProfile.findUnique({ where: { id } });
  if (!profile) throw AppError.notFound("Profil admin nggak ketemu.");
  return profile;
}

export async function getPublicProfile(id: string): Promise<PublicAdminProfile> {
  const profile = await prisma.adminProfile.findUnique({
    where: { id },
    select: { id: true, fullName: true, email: true, photoUrl: true },
  });
  if (!profile) throw AppError.notFound("Profil admin nggak ketemu.");
  return profile;
}

export async function createProfile(input: CreateProfileInput): Promise<AdminProfileItem> {
  const existing = await prisma.adminProfile.findUnique({ where: { email: input.email } });
  if (existing) throw AppError.conflict("Email udah digunakan.", "EMAIL_TAKEN");

  const existingByUser = await prisma.adminProfile.findUnique({ where: { userId: input.userId } });
  if (existingByUser) throw AppError.conflict("User udah punya profil admin.", "PROFILE_EXISTS");

  return prisma.adminProfile.create({
    data: { userId: input.userId, fullName: input.fullName, email: input.email, photoUrl: input.photoUrl ?? null },
  });
}

export async function updateProfile(userId: string, input: UpdateProfileInput): Promise<AdminProfileItem> {
  const profile = await prisma.adminProfile.findUnique({ where: { userId } });
  if (!profile) throw AppError.notFound("Profil admin nggak ketemu.");

  if (input.email && input.email !== profile.email) {
    const existing = await prisma.adminProfile.findUnique({ where: { email: input.email } });
    if (existing) throw AppError.conflict("Email udah digunakan.", "EMAIL_TAKEN");
  }

  if (input.newPassword) {
    const passwordHash = await bcrypt.hash(input.newPassword, env.BCRYPT_ROUNDS);
    await prisma.user.update({ where: { id: userId }, data: { passwordHash } });
  }

  return prisma.adminProfile.update({
    where: { id: profile.id },
    data: {
      ...(input.fullName !== undefined ? { fullName: input.fullName } : {}),
      ...(input.email !== undefined ? { email: input.email } : {}),
      ...(input.photoUrl !== undefined ? { photoUrl: input.photoUrl } : {}),
    },
  });
}

export async function updatePhoto(userId: string, photoUrl: string): Promise<AdminProfileItem> {
  const profile = await prisma.adminProfile.findUnique({ where: { userId } });
  if (!profile) throw AppError.notFound("Profil admin nggak ketemu.");

  return prisma.adminProfile.update({
    where: { id: profile.id },
    data: { photoUrl },
  });
}

export async function deleteProfile(userId: string): Promise<void> {
  const profile = await prisma.adminProfile.findUnique({ where: { userId } });
  if (!profile) throw AppError.notFound("Profil admin nggak ketemu.");

  await prisma.adminProfile.delete({ where: { id: profile.id } });
}