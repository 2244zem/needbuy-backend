export function isRefreshTokenReuse(token: {
  revokedAt: Date | null;
  replacedById: string | null;
}): boolean {
  return token.revokedAt !== null && token.replacedById !== null;
}
