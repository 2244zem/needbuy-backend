import type { Request, RequestHandler } from "express";
import rateLimit, { type Options } from "express-rate-limit";
import { env } from "../config/env";
import { AppError } from "../lib/apiError";

const shared: Partial<Options> = {
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, _res, next) => {
    next(AppError.tooManyRequests());
  },
};

function userOrIpKey(req: Request): string {
  return req.user?.id ?? req.ip ?? "unknown";
}

function authKey(req: Request): string {
  const body = req.body as { email?: unknown; refreshToken?: unknown } | undefined;
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const refreshToken = typeof body?.refreshToken === "string" ? body.refreshToken : "";
  const scope = email || refreshToken || req.user?.id || "anon";
  return `${req.ip ?? "unknown"}|${scope}`;
}

export const authLimiter: RequestHandler = rateLimit({
  ...shared,
  windowMs: 15 * 60 * 1000,
  limit: 10,
  keyGenerator: authKey,
});

export const writeLimiter: RequestHandler = rateLimit({
  ...shared,
  windowMs: 15 * 60 * 1000,
  limit: 120,
  keyGenerator: userOrIpKey,
});

export const analysisLimiter: RequestHandler = rateLimit({
  ...shared,
  windowMs: 15 * 60 * 1000,
  limit: 20,
  keyGenerator: userOrIpKey,
});

export const globalLimiter: RequestHandler = rateLimit({
  ...shared,
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  limit: env.RATE_LIMIT_MAX,
  keyGenerator: userOrIpKey,
});

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;
const failedAttempts = new Map<string, { count: number; firstAt: number }>();

export function assertNotLockedOut(email: string): void {
  const entry = failedAttempts.get(email.toLowerCase());
  if (!entry) return;
  if (Date.now() - entry.firstAt > LOCKOUT_MS) {
    failedAttempts.delete(email.toLowerCase());
    return;
  }
  if (entry.count >= MAX_FAILED_ATTEMPTS) {
    throw AppError.tooManyRequests(
      "Terlalu banyak percobaan login gagal. Coba lagi dalam beberapa menit.",
      "ACCOUNT_TEMPORARILY_LOCKED"
    );
  }
}

export function recordFailedLogin(email: string): void {
  const key = email.toLowerCase();
  const entry = failedAttempts.get(key);
  if (!entry || Date.now() - entry.firstAt > LOCKOUT_MS) {
    failedAttempts.set(key, { count: 1, firstAt: Date.now() });
    return;
  }
  entry.count += 1;
}

export function clearFailedLogins(email: string): void {
  failedAttempts.delete(email.toLowerCase());
}
