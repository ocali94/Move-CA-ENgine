import "server-only";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ACCESS_COOKIE, accessCodeConfigured, isValidAccessToken } from "@/lib/access";

export { accessCodeConfigured };

export async function hasAccess() {
  const store = await cookies();
  return isValidAccessToken(store.get(ACCESS_COOKIE)?.value);
}

// Defense in depth behind proxy.ts: API routes still verify the cookie
// themselves so a route can never be exposed by a matcher mistake.
export async function requireApiUser() {
  if (await hasAccess()) {
    return { authorized: true as const, response: null };
  }

  return {
    authorized: false as const,
    response: NextResponse.json(
      { error: "Unauthorized", message: "Sign in with the team access code first." },
      { status: 401 },
    ),
  };
}
