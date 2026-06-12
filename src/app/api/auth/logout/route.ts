import { NextResponse } from "next/server";
import { ACCESS_COOKIE } from "@/lib/access";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: ACCESS_COOKIE,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}
