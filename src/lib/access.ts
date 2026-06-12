import { createHash, timingSafeEqual } from "node:crypto";

export const ACCESS_COOKIE = "move_ca_access";
export const ACCESS_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

export function accessCodeConfigured() {
  return Boolean(process.env.ACCESS_CODE?.trim());
}

// The cookie stores a hash derived from the code, so rotating ACCESS_CODE
// invalidates every existing session.
export function tokenForCode(code: string) {
  return createHash("sha256").update(`move-ca-engine:${code}`).digest("hex");
}

function safeEqual(a: string, b: string) {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

export function isValidAccessCode(code: string) {
  const expected = process.env.ACCESS_CODE?.trim();
  if (!expected || !code) return false;
  return safeEqual(code.trim(), expected);
}

export function isValidAccessToken(token?: string | null) {
  const expected = process.env.ACCESS_CODE?.trim();
  if (!expected || !token) return false;
  return safeEqual(token, tokenForCode(expected));
}
