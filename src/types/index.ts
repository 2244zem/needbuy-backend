import type { UserRole } from "@prisma/client";

export type AuthUser = {
  id: string;
  role: UserRole;
};

export type TokenPair = {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
};

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
      requestId: string;
      
      idempotency?: { key: string; requestHash: string; endpoint: string };
    }
  }
}

export {};
