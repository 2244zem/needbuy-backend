import crypto from "node:crypto";
import { OAuth2Client, type TokenPayload } from "google-auth-library";
import { env } from "../../config/env";
import { logger } from "../../config/logger";
import { AppError } from "../../lib/apiError";
import { safeCompare } from "../../lib/hash";

let _client: OAuth2Client | null = null;

function getClient(): OAuth2Client {
  // GOOGLE_CALLBACK_URL ikut dicek: tanpa itu redirect_uri terkirim undefined dan
  // Google membalas "Error 400: redirect_uri_mismatch" yang menyesatkan.
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET || !env.GOOGLE_CALLBACK_URL) {
    throw AppError.serviceUnavailable(
      "Google OAuth belum dikonfigurasi. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, dan GOOGLE_CALLBACK_URL di .env.",
      "GOOGLE_AUTH_NOT_CONFIGURED"
    );
  }
  if (!_client) {
    _client = new OAuth2Client(
      env.GOOGLE_CLIENT_ID,
      env.GOOGLE_CLIENT_SECRET,
      env.GOOGLE_CALLBACK_URL
    );
  }
  return _client;
}

const STATE_TTL_MS = 10 * 60 * 1000;

function signState(payload: string): string {
  return crypto.createHmac("sha256", env.JWT_SECRET).update(payload).digest("hex");
}

export function generateState(): string {
  const payload = `${crypto.randomBytes(16).toString("hex")}.${Date.now() + STATE_TTL_MS}`;
  return `${payload}.${signState(payload)}`;
}

export function consumeState(state: string): boolean {
  const parts = state.split(".");
  if (parts.length !== 3) return false;
  const [nonce, expiresAt, signature] = parts;

  const expected = signState(`${nonce}.${expiresAt}`);
  if (!safeCompare(signature, expected)) return false;

  return Number(expiresAt) > Date.now();
}

export function buildAuthorizationUrl(): string {
  const client = getClient();
  const state = generateState();

  return client.generateAuthUrl({
    access_type: "offline",
    scope: ["openid", "email", "profile"],
    state,
    prompt: "consent",
  });
}

export async function exchangeCodeForIdentity(code: string, state: string) {
  if (!consumeState(state)) {
    throw AppError.badRequest(
      "OAuth state tidak valid atau sudah kedaluwarsa.",
      "GOOGLE_AUTH_INVALID_STATE"
    );
  }

  const client = getClient();

  let tokens;
  try {
    const { tokens: t } = await client.getToken(code);
    tokens = t;
  } catch (err) {
    logger.error({ err }, "Google token exchange failed");
    throw AppError.unauthorized(
      "Gagal menukar authorization code Google.",
      "GOOGLE_AUTH_CODE_EXCHANGE_FAILED"
    );
  }

  if (!tokens.id_token) {
    throw AppError.unauthorized(
      "Google tidak mengembalikan ID token.",
      "GOOGLE_AUTH_NO_ID_TOKEN"
    );
  }

  const payload = await verifyIdToken(tokens.id_token);
  return payload;
}

export async function verifyIdToken(idToken: string): Promise<{
  sub: string;
  email: string;
  emailVerified: boolean;
  name: string | undefined;
  picture: string | undefined;
}> {
  const client = getClient();

  let payload: TokenPayload | undefined;
  try {
    const ticket = await client.verifyIdToken({
      idToken,
      audience: env.GOOGLE_CLIENT_ID,
    });
    payload = ticket.getPayload();
  } catch (err) {
    logger.error({ err }, "Google ID token verification failed");
    throw AppError.unauthorized(
      "Google ID token tidak valid.",
      "GOOGLE_TOKEN_INVALID"
    );
  }

  if (!payload) {
    throw AppError.unauthorized(
      "Google ID token payload kosong.",
      "GOOGLE_TOKEN_INVALID"
    );
  }

  if (!payload.email) {
    throw AppError.unauthorized(
      "Google account tidak memiliki email.",
      "GOOGLE_AUTH_NO_EMAIL"
    );
  }

  if (!payload.email_verified) {
    throw AppError.unauthorized(
      "Email Google belum diverifikasi.",
      "GOOGLE_EMAIL_NOT_VERIFIED"
    );
  }

  return {
    sub: payload.sub,
    email: payload.email.toLowerCase(),
    emailVerified: payload.email_verified ?? false,
    name: payload.name,
    picture: payload.picture,
  };
}
