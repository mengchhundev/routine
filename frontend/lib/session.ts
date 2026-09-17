import "server-only";

import { cookies } from "next/headers";
import type { AuthResponse } from "@/types/api";

/**
 * Tokens live in httpOnly cookies set by our own route handlers, never in
 * localStorage: script running on the page cannot read them, so an XSS bug
 * cannot walk away with a session.
 */
export const ACCESS_COOKIE = "routine_at";
export const REFRESH_COOKIE = "routine_rt";

const REFRESH_MAX_AGE = 60 * 60 * 24 * 30; // matches routine.auth.refresh-token-ttl

const baseCookie = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
};

export type SessionCookie = { name: string; value: string; options: Record<string, unknown> };

/**
 * Cookie descriptors for a fresh session. Returned rather than written, because
 * the same set has to be applied from route handlers and from middleware, which
 * write to different response objects.
 */
export function sessionCookies(auth: AuthResponse): SessionCookie[] {
  return [
    {
      name: ACCESS_COOKIE,
      value: auth.accessToken,
      // The access cookie expires with its token, so its absence is exactly the
      // signal "this access token is stale" — no JWT decoding needed.
      options: { ...baseCookie, maxAge: auth.expiresIn },
    },
    {
      name: REFRESH_COOKIE,
      value: auth.refreshToken,
      options: { ...baseCookie, maxAge: REFRESH_MAX_AGE },
    },
  ];
}

export function clearedCookies(): SessionCookie[] {
  return [ACCESS_COOKIE, REFRESH_COOKIE].map((name) => ({
    name,
    value: "",
    options: { ...baseCookie, maxAge: 0 },
  }));
}

export async function getAccessToken(): Promise<string | undefined> {
  return (await cookies()).get(ACCESS_COOKIE)?.value;
}

export async function getRefreshToken(): Promise<string | undefined> {
  return (await cookies()).get(REFRESH_COOKIE)?.value;
}
