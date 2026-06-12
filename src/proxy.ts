import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { ACCESS_COOKIE, isValidAccessToken } from "@/lib/access";

const publicApiRoutes = ["/api/auth/login", "/api/auth/logout", "/api/health"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (publicApiRoutes.includes(pathname)) {
    return NextResponse.next();
  }

  if (isValidAccessToken(request.cookies.get(ACCESS_COOKIE)?.value)) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json(
      { error: "Unauthorized", message: "Sign in with the team access code first." },
      { status: 401 },
    );
  }

  const loginUrl = new URL("/login", request.url);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/dashboard/:path*", "/setup", "/api/:path*"],
};
