import crypto from "crypto";

export function generateRefreshToken(): string {
  return crypto.randomBytes(64).toString("hex");
}

export function hashRefreshToken(
  refreshToken: string
): string {
  return crypto
    .createHash("sha256")
    .update(refreshToken)
    .digest("hex");
}