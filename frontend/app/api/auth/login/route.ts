import { NextResponse } from "next/server";
import { apiRequest, ApiError } from "@/lib/api";
import { sessionCookies } from "@/lib/session";
import { loginSchema } from "@/lib/validation";
import type { AuthResponse } from "@/types/api";

/**
 * The browser posts here rather than to Spring Boot directly. This handler is
 * the only place tokens are handled in the clear; they leave it as httpOnly
 * cookies and are never exposed to page JavaScript.
 */
export async function POST(request: Request) {
  const parsed = loginSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { code: "VALIDATION_FAILED", message: "Enter your email and password" },
      { status: 400 },
    );
  }

  try {
    const auth = await apiRequest<AuthResponse>("/api/v1/auth/login", {
      method: "POST",
      body: JSON.stringify(parsed.data),
    });

    const response = NextResponse.json({ user: auth.user });
    for (const cookie of sessionCookies(auth)) {
      response.cookies.set(cookie.name, cookie.value, cookie.options);
    }
    return response;
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json(error.body, { status: error.status });
    }
    return NextResponse.json(
      { code: "UPSTREAM_UNAVAILABLE", message: "Could not reach the server" },
      { status: 502 },
    );
  }
}
