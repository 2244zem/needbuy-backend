import type { UserRole } from "@prisma/client";
import type { RequestHandler } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { AppError } from "../lib/apiError";

type AccessTokenPayload = { sub: string; role: UserRole };

export const requireAuth: RequestHandler = (req, _res, next) => {
  const header = req.header("authorization");
  if (!header?.startsWith("Bearer ")) {
    next(AppError.unauthorized("Header Authorization Bearer nggak ada."));
    return;
  }

  const token = header.slice("Bearer ".length).trim();
  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as AccessTokenPayload;
    req.user = { id: payload.sub, role: payload.role };
    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      next(AppError.unauthorized("Access token udah kedaluwarsa.", "TOKEN_EXPIRED"));
      return;
    }
    next(AppError.unauthorized("Access token nggak valid.", "TOKEN_INVALID"));
  }
};

export const optionalAuth: RequestHandler = (req, _res, next) => {
  const header = req.header("authorization");
  if (!header?.startsWith("Bearer ")) return next();

  try {
    const token = header.slice("Bearer ".length).trim();
    const payload = jwt.verify(token, env.JWT_SECRET) as AccessTokenPayload;
    req.user = { id: payload.sub, role: payload.role };
  } catch {}
  next();
};

export function requireRole(...roles: UserRole[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.user) {
      next(AppError.unauthorized());
      return;
    }
    if (!roles.includes(req.user.role)) {
      next(AppError.forbidden("Role akun kamu nggak boleh mengakses endpoint ini."));
      return;
    }
    next();
  };
}

export function currentUser(req: { user?: { id: string; role: UserRole } }) {
  if (!req.user) throw AppError.unauthorized();
  return req.user;
}
