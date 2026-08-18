import type { AuthTokenPurpose, UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { env } from "../../config/env";
import { logger } from "../../config/logger";
import { sendMail } from "../../config/mailer";
import { prisma } from "../../config/prisma";
import { AppError } from "../../lib/apiError";
import { passwordResetEmail, verificationEmail } from "../../lib/emailTemplates";
import { randomToken, sha256 } from "../../lib/hash";
import { isRefreshTokenReuse } from "../../lib/refreshTokenState";
import {
  assertNotLockedOut,
  clearFailedLogins,
  recordFailedLogin,
} from "../../middleware/rateLimit";
import type { LoginInput, RegisterInput, SocialAuthInput } from "./auth.schema";
import * as googleOAuth from "./google-oauth.service";

const publicUserSelect = {
  id: true,
  username: true,
  name: true,
  email: true,
  phone: true,
  avatarUrl: true,
  role: true,
  authProvider: true,
  emailVerifiedAt: true,
  createdAt: true,
} as const;

export type PublicUser = {
  id: string;
  username: string;
  name: string;
  email: string;
  phone: string | null;
  avatarUrl: string | null;
  role: UserRole;
  authProvider: string;
  emailVerifiedAt: Date | null;
  createdAt: Date;
};

export function signAccessToken(user: { id: string; role: UserRole }): string {
  return jwt.sign({ sub: user.id, role: user.role }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN,
  } as jwt.SignOptions);
}

export async function issueRefreshToken(userId: string, replacesId?: string): Promise<string> {
  const token = randomToken(32);
  const expiresAt = new Date(Date.now() + env.REFRESH_EXPIRES_IN_DAYS * 24 * 60 * 60 * 1000);
  const created = await prisma.refreshToken.create({
    data: { userId, tokenHash: sha256(token), expiresAt },
  });
  if (replacesId) {
    await prisma.refreshToken.update({
      where: { id: replacesId },
      data: { replacedById: created.id },
    });
  }
  return token;
}

function tokenResponse(user: PublicUser, accessToken: string, refreshToken: string) {
  return { user, accessToken, refreshToken, expiresIn: env.JWT_EXPIRES_IN };
}

export async function register(input: RegisterInput) {
  const [existingEmail, existingUsername] = await Promise.all([
    prisma.user.findUnique({ where: { email: input.email } }),
    prisma.user.findUnique({ where: { username: input.username } }),
  ]);
  if (existingEmail) {
    throw AppError.conflict("Email udah terdaftar.", "EMAIL_ALREADY_REGISTERED");
  }
  if (existingUsername) {
    throw AppError.conflict("Username udah dipakai.", "USERNAME_ALREADY_TAKEN");
  }

  const passwordHash = await bcrypt.hash(input.password, env.BCRYPT_ROUNDS);

  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        username: input.username,
        name: input.username,
        email: input.email,
        passwordHash,

        role: "BUYER",
      },
      select: publicUserSelect,
    });
    await tx.cart.create({ data: { userId: created.id } });
    return created;
  });

  await issueEmailVerification(user.id, user.name, user.email);

  const refreshToken = await issueRefreshToken(user.id);
  return tokenResponse(user, signAccessToken(user), refreshToken);
}

export async function login(input: LoginInput) {
  assertNotLockedOut(input.email);

  const user = await prisma.user.findUnique({
    where: { email: input.email },
    select: { ...publicUserSelect, passwordHash: true },
  });

  const hashToCompare = user?.passwordHash ?? "$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvaliduO";
  const valid = await bcrypt.compare(input.password, hashToCompare);

  if (!user || !valid) {
    recordFailedLogin(input.email);
    throw AppError.unauthorized("Email atau password salah.", "INVALID_CREDENTIALS");
  }

  clearFailedLogins(input.email);

  const { passwordHash: _ignored, ...publicUser } = user;
  const refreshToken = await issueRefreshToken(publicUser.id);
  return tokenResponse(publicUser, signAccessToken(publicUser), refreshToken);
}

export async function refresh(presentedToken: string) {
  const tokenHash = sha256(presentedToken);
  const stored = await prisma.refreshToken.findUnique({
    where: { tokenHash },
    include: { user: { select: publicUserSelect } },
  });

  if (!stored) {
    throw AppError.unauthorized("Refresh token nggak valid.", "REFRESH_TOKEN_INVALID");
  }

  if (stored.revokedAt) {
    if (isRefreshTokenReuse(stored)) {
      logger.warn({ userId: stored.userId }, "refresh token reuse detected");
      await prisma.refreshToken.updateMany({
        where: { userId: stored.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw AppError.unauthorized(
        "Refresh token udah dipakai sebelumnya. Semua sesi dicabut, coba login ulang.",
        "TOKEN_REUSE_DETECTED"
      );
    }

    throw AppError.unauthorized(
      "Sesi kamu udah nggak berlaku. Login lagi ya.",
      "REFRESH_TOKEN_REVOKED"
    );
  }

  if (stored.expiresAt.getTime() <= Date.now()) {
    throw AppError.unauthorized("Refresh token udah kedaluwarsa.", "REFRESH_TOKEN_EXPIRED");
  }

  await prisma.refreshToken.update({
    where: { id: stored.id },
    data: { revokedAt: new Date() },
  });

  const newRefreshToken = await issueRefreshToken(stored.userId, stored.id);
  return tokenResponse(stored.user, signAccessToken(stored.user), newRefreshToken);
}

export async function logout(presentedToken: string) {
  await prisma.refreshToken.updateMany({
    where: { tokenHash: sha256(presentedToken), revokedAt: null },
    data: { revokedAt: new Date() },
  });
  return { loggedOut: true };
}

export async function me(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { ...publicUserSelect, seller: { select: { id: true, storeName: true, status: true } } },
  });
  if (!user) throw AppError.notFound("User nggak ketemu.");
  return user;
}

export async function socialAuth(input: SocialAuthInput) {
  if (input.provider === "GOOGLE") {
    const verified = await googleOAuth.verifyIdToken(input.idToken);
    return upsertSocialUser({
      provider: "GOOGLE",
      providerUserId: verified.sub,
      email: verified.email,
      name: verified.name,
    });
  }
}

export async function googleCallbackAuth(code: string, state: string) {
  const verified = await googleOAuth.exchangeCodeForIdentity(code, state);
  return upsertSocialUser({
    provider: "GOOGLE",
    providerUserId: verified.sub,
    email: verified.email,
    name: verified.name,
  });
}

async function upsertSocialUser(input: {
  provider: "GOOGLE";
  providerUserId: string;
  email: string;
  name: string | undefined;
}) {
  let user = await prisma.user.findFirst({
    where: {
      authProvider: input.provider,
      authProviderId: input.providerUserId,
    },
    select: publicUserSelect,
  });

  if (!user) {
    const existingByEmail = await prisma.user.findUnique({
      where: { email: input.email },
    });
    if (existingByEmail) {
      throw AppError.conflict(
        "Email udah terdaftar dengan metode login lain. Silakan login dengan metode yang digunakan saat mendaftar.",
        "EMAIL_ALREADY_REGISTERED_DIFFERENT_PROVIDER"
      );
    }

    const baseUsername = input.email.split("@")[0].replace(/[^a-zA-Z0-9_]/g, "_");
    let username = baseUsername;
    let suffix = 1;
    while (await prisma.user.findUnique({ where: { username } })) {
      username = `${baseUsername}_${suffix++}`;
    }

    user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          username,
          name: input.name ?? username,
          email: input.email,
          authProvider: input.provider,
          authProviderId: input.providerUserId,
          role: "BUYER",
          emailVerifiedAt: new Date(),
        },
        select: publicUserSelect,
      });
      await tx.cart.create({ data: { userId: created.id } });
      return created;
    });
  }

  const refreshToken = await issueRefreshToken(user.id);
  return tokenResponse(user, signAccessToken(user), refreshToken);
}


const VERIFICATION_TTL_HOURS = 24;
const RESET_TTL_MINUTES = 60;
const MAX_SENDS_PER_HOUR: Record<AuthTokenPurpose, number> = {
  EMAIL_VERIFICATION: 3,
  PASSWORD_RESET: 5,
};

async function issueAuthToken(
  userId: string,
  purpose: AuthTokenPurpose,
  ttlMs: number
): Promise<string | null> {
  const sinceAnHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const recent = await prisma.authToken.count({
    where: { userId, purpose, createdAt: { gte: sinceAnHourAgo } },
  });
  if (recent >= MAX_SENDS_PER_HOUR[purpose]) return null;

  const token = randomToken(32);
  await prisma.$transaction([
    prisma.authToken.updateMany({
      where: { userId, purpose, usedAt: null },
      data: { usedAt: new Date() },
    }),
    prisma.authToken.create({
      data: {
        userId,
        purpose,
        tokenHash: sha256(token),
        expiresAt: new Date(Date.now() + ttlMs),
      },
    }),
  ]);
  return token;
}

async function consumeAuthToken(rawToken: string, purpose: AuthTokenPurpose) {
  const stored = await prisma.authToken.findUnique({
    where: { tokenHash: sha256(rawToken) },
    include: { user: { select: publicUserSelect } },
  });

  const invalid = AppError.badRequest(
    "Tautannya udah nggak berlaku. Minta kirim ulang ya.",
    "AUTH_TOKEN_INVALID"
  );

  if (!stored || stored.purpose !== purpose) throw invalid;
  if (stored.usedAt) throw invalid;
  if (stored.expiresAt.getTime() <= Date.now()) throw invalid;

  const claimed = await prisma.authToken.updateMany({
    where: { id: stored.id, usedAt: null },
    data: { usedAt: new Date() },
  });
  if (claimed.count === 0) throw invalid;

  return stored;
}

async function issueEmailVerification(userId: string, name: string, email: string) {
  const token = await issueAuthToken(
    userId,
    "EMAIL_VERIFICATION",
    VERIFICATION_TTL_HOURS * 60 * 60 * 1000
  );
  if (!token) return false;

  const url = `${env.FRONTEND_URL}/verify-email/${token}`;
  return sendMail(email, verificationEmail(name, url, VERIFICATION_TTL_HOURS));
}

export async function resendVerification(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, emailVerifiedAt: true },
  });
  if (!user) throw AppError.notFound("User nggak ketemu.");
  if (user.emailVerifiedAt) {
    throw AppError.badRequest("Email kamu udah terverifikasi.", "EMAIL_ALREADY_VERIFIED");
  }

  const sent = await issueEmailVerification(user.id, user.name, user.email);
  if (!sent) {
    throw AppError.tooManyRequests(
      "Kamu udah minta kirim ulang beberapa kali. Coba lagi sejam lagi ya.",
      "RESEND_LIMIT_REACHED"
    );
  }
  return { sent: true };
}

export async function verifyEmail(rawToken: string) {
  const stored = await consumeAuthToken(rawToken, "EMAIL_VERIFICATION");

  const user = await prisma.user.update({
    where: { id: stored.userId },
    data: { emailVerifiedAt: stored.user.emailVerifiedAt ?? new Date() },
    select: publicUserSelect,
  });

  const refreshToken = await issueRefreshToken(user.id);
  return tokenResponse(user, signAccessToken(user), refreshToken);
}

export async function forgotPassword(email: string) {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, name: true, email: true, passwordHash: true },
  });

  if (user?.passwordHash) {
    const token = await issueAuthToken(user.id, "PASSWORD_RESET", RESET_TTL_MINUTES * 60 * 1000);
    if (token) {
      const url = `${env.FRONTEND_URL}/reset-password/${token}`;
      await sendMail(user.email, passwordResetEmail(user.name, url, RESET_TTL_MINUTES));
    }
  }

  return { sent: true };
}

export async function validateResetToken(rawToken: string) {
  const stored = await prisma.authToken.findUnique({
    where: { tokenHash: sha256(rawToken) },
    select: { purpose: true, usedAt: true, expiresAt: true },
  });
  const valid =
    !!stored &&
    stored.purpose === "PASSWORD_RESET" &&
    !stored.usedAt &&
    stored.expiresAt.getTime() > Date.now();
  return { valid };
}

export async function resetPassword(rawToken: string, newPassword: string) {
  const stored = await consumeAuthToken(rawToken, "PASSWORD_RESET");

  const account = await prisma.user.findUnique({
    where: { id: stored.userId },
    select: { passwordHash: true },
  });
  if (account?.passwordHash && (await bcrypt.compare(newPassword, account.passwordHash))) {
    throw AppError.badRequest(
      "Password barunya masih sama kayak yang lama. Pakai yang beda ya.",
      "PASSWORD_UNCHANGED"
    );
  }

  const passwordHash = await bcrypt.hash(newPassword, env.BCRYPT_ROUNDS);

  await prisma.$transaction([
    prisma.user.update({ where: { id: stored.userId }, data: { passwordHash } }),
    prisma.refreshToken.updateMany({
      where: { userId: stored.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ]);

  logger.info({ userId: stored.userId }, "password reset, semua sesi dicabut");
  return { reset: true };
}
