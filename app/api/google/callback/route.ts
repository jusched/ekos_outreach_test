import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import {
  exchangeGoogleCode,
  GOOGLE_NEXT_COOKIE,
  GOOGLE_STATE_COOKIE,
} from "@/src/lib/google";

function redirectWithStatus(path: string, key: "error" | "message", value: string) {
  const url = new URL(path, "http://localhost");
  url.searchParams.set(key, value);
  return NextResponse.redirect(`${url.pathname}?${url.searchParams.toString()}`);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const state = url.searchParams.get("state");
  const code = url.searchParams.get("code");
  const cookieStore = await cookies();
  const expectedState = cookieStore.get(GOOGLE_STATE_COOKIE)?.value;
  const nextPath = cookieStore.get(GOOGLE_NEXT_COOKIE)?.value ?? "/";

  cookieStore.delete(GOOGLE_STATE_COOKIE);
  cookieStore.delete(GOOGLE_NEXT_COOKIE);

  if (!state || !expectedState || state !== expectedState) {
    return redirectWithStatus(nextPath, "error", "Google OAuth state mismatch.");
  }

  if (!code) {
    return redirectWithStatus(nextPath, "error", "Google OAuth callback returned no code.");
  }

  try {
    const result = await exchangeGoogleCode(code);
    return redirectWithStatus(
      nextPath,
      "message",
      `Connected Gmail account ${result.email}.`,
    );
  } catch (error) {
    return redirectWithStatus(
      nextPath,
      "error",
      error instanceof Error ? error.message : "Google OAuth failed.",
    );
  }
}
