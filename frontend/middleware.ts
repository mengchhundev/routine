import { NextResponse, type NextRequest } from "next/server";
import type { AuthResponse } from "@/types/api";

const ACCESS_COOKIE = "routine_at";
const REFRESH_COOKIE = "routine_rt";
const API_URL = process.env.API_INTERNAL_URL ?? "http://localhost:8080";

/** Everything under these prefixes requires a session. */
const PROTECTED = [
  "/dashboard",
  "/today",
  "/tasks",
  "/routines",
  "/planner",
  "/goals",
  "/notes",
  "/reminders",
  "/analytics",
  "/settings",
];
const AUTH_PAGES = ["/login", "/register"];

/**
 * Access tokens are short-lived, so most navigations would otherwise hit a 401
 * mid-render. Refreshing here — before the page runs — means a signed-in user
 * never sees an expiry, and no client-side token juggling is needed.
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const accessToken = request.cookies.get(ACCESS_COOKIE)?.value;
  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value;

  const isProtected = PROTECTED.some((prefix) => pathname.startsWith(prefix));
  const isAuthPage = AUTH_PAGES.some((prefix) => pathname.startsWith(prefix));

  // Already signed in and asking for the login page: send them where they meant to go.
  if (isAuthPage && accessToken) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (!isProtected) {
    return NextResponse.next();
  }

  if (accessToken) {
    return NextResponse.next();
  }

  if (!refreshToken) {
    return redirectToLogin(request);
  }

  const refreshed = await refresh(refreshToken);
  if (!refreshed) {
    // The refresh token is expired, revoked or reused. Clear both cookies so
    // the next request does not repeat this round trip.
    const response = redirectToLogin(request);
    response.cookies.delete(ACCESS_COOKIE);
    response.cookies.delete(REFRESH_COOKIE);
    return response;
  }

  const response = NextResponse.next();
  const secure = process.env.NODE_ENV === "production";
  response.cookies.set(ACCESS_COOKIE, refreshed.accessToken, {
    httpOnly: true, sameSite: "lax", secure, path: "/", maxAge: refreshed.expiresIn,
  });
  response.cookies.set(REFRESH_COOKIE, refreshed.refreshToken, {
    httpOnly: true, sameSite: "lax", secure, path: "/", maxAge: 60 * 60 * 24 * 30,
  });
  return response;
}

async function refresh(refreshToken: string): Promise<AuthResponse | null> {
  try {
    const response = await fetch(`${API_URL}/api/v1/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
      cache: "no-store",
    });
    return response.ok ? ((await response.json()) as AuthResponse) : null;
  } catch {
    // API unreachable. Treat it as "not signed in" rather than crashing the app.
    return null;
  }
}

function redirectToLogin(request: NextRequest) {
  const url = new URL("/login", request.url);
  url.searchParams.set("next", request.nextUrl.pathname);
  return NextResponse.redirect(url);
}

export const config = {
  // Skip static assets and the auth route handlers, which manage cookies themselves.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
