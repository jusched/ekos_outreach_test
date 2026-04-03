import { randomUUID } from "node:crypto";

import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import {
  buildGoogleConsentUrl,
  GOOGLE_NEXT_COOKIE,
  GOOGLE_STATE_COOKIE,
} from "@/src/lib/google";

export async function GET(request: Request) {
  const state = randomUUID();
  const nextPath = new URL(request.url).searchParams.get("next")?.trim() || "/";
  const cookieStore = await cookies();

  cookieStore.set(GOOGLE_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });
  cookieStore.set(GOOGLE_NEXT_COOKIE, nextPath, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });

  return NextResponse.redirect(buildGoogleConsentUrl(state));
}
