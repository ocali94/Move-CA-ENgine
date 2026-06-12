import { NextResponse } from "next/server";
import { z } from "zod";
import {
  ACCESS_COOKIE,
  ACCESS_COOKIE_MAX_AGE,
  accessCodeConfigured,
  isValidAccessCode,
  tokenForCode,
} from "@/lib/access";

const loginSchema = z.object({
  code: z.string().min(1),
});

export async function POST(request: Request) {
  if (!accessCodeConfigured()) {
    return NextResponse.json(
      { error: "ACCESS_CODE is not configured on the server. Set it in .env.local and restart." },
      { status: 503 },
    );
  }

  const body = loginSchema.safeParse(await request.json().catch(() => ({})));
  if (!body.success) {
    return NextResponse.json({ error: "Enter the team access code." }, { status: 400 });
  }

  if (!isValidAccessCode(body.data.code)) {
    return NextResponse.json({ error: "That access code is not correct." }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: ACCESS_COOKIE,
    value: tokenForCode(process.env.ACCESS_CODE!.trim()),
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ACCESS_COOKIE_MAX_AGE,
  });
  return response;
}
