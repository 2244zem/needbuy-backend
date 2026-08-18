import type { Request, Response } from "express";
import { env } from "../../config/env";
import { logger } from "../../config/logger";
import { ok } from "../../lib/response";
import { currentUser } from "../../middleware/auth";
import * as authService from "./auth.service";
import * as googleOAuth from "./google-oauth.service";

export async function register(req: Request, res: Response) {
  const result = await authService.register(req.body);
  res.status(201).json(ok(result));
}

export async function socialAuth(req: Request, res: Response) {
  const result = await authService.socialAuth(req.body);
  res.status(200).json(ok(result));
}

export async function login(req: Request, res: Response) {
  const result = await authService.login(req.body);
  res.json(ok(result));
}

export async function refresh(req: Request, res: Response) {
  const result = await authService.refresh(req.body.refreshToken);
  res.json(ok(result));
}

export async function logout(req: Request, res: Response) {
  const result = await authService.logout(req.body.refreshToken);
  res.json(ok(result));
}

export async function me(req: Request, res: Response) {
  const result = await authService.me(currentUser(req).id);
  res.json(ok(result));
}

export async function googleRedirect(_req: Request, res: Response) {
  const url = googleOAuth.buildAuthorizationUrl();
  res.redirect(url);
}

export async function googleCallback(req: Request, res: Response) {
  const { code, state, error } = req.query;

  const frontendUrl = env.FRONTEND_URL ?? "http://localhost:5173";

  if (error) {
    logger.warn({ error }, "Google OAuth consent ditolak oleh user");
    const params = new URLSearchParams({
      error: "GOOGLE_AUTH_DENIED",
      message: "Login Google dibatalkan.",
    });
    res.redirect(`${frontendUrl}/auth/callback?${params.toString()}`);
    return;
  }

  if (typeof code !== "string" || typeof state !== "string") {
    const params = new URLSearchParams({
      error: "GOOGLE_CALLBACK_INVALID",
      message: "Parameter callback Google tidak valid.",
    });
    res.redirect(`${frontendUrl}/auth/callback?${params.toString()}`);
    return;
  }

  try {
    const result = await authService.googleCallbackAuth(code, state);

    const params = new URLSearchParams({
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      expiresIn: result.expiresIn,
    });
    res.redirect(`${frontendUrl}/auth/callback?${params.toString()}`);
  } catch (err) {
    logger.error({ err }, "Google OAuth callback failed");
    const message =
      err instanceof Error ? err.message : "Terjadi kesalahan saat login Google.";
    const code_str =
      err && typeof err === "object" && "code" in err
        ? String((err as { code: string }).code)
        : "GOOGLE_CALLBACK_FAILED";
    const params = new URLSearchParams({ error: code_str, message });
    res.redirect(`${frontendUrl}/auth/callback?${params.toString()}`);
  }
}

export async function verifyEmail(req: Request, res: Response) {
  const result = await authService.verifyEmail(req.params.token);
  res.json(ok(result));
}

export async function resendVerification(req: Request, res: Response) {
  const actor = currentUser(req);
  const result = await authService.resendVerification(actor.id);
  res.json(ok(result));
}

export async function forgotPassword(req: Request, res: Response) {
  const result = await authService.forgotPassword(req.body.email);
  res.json(ok(result));
}

export async function validateResetToken(req: Request, res: Response) {
  const result = await authService.validateResetToken(req.params.token);
  res.json(ok(result));
}

export async function resetPassword(req: Request, res: Response) {
  const result = await authService.resetPassword(req.params.token, req.body.password);
  res.json(ok(result));
}
