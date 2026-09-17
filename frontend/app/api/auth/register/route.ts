import { NextResponse } from "next/server";
import { apiRequest, ApiError } from "@/lib/api";
import { sessionCookies } from "@/lib/session";
import { registerSchema } from "@/lib/validation";
import type { AuthResponse } from "@/types/api";

export async function POST(request: Request) {
  const parsed = registerSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      {
        code: "VALIDATION_FAILED",
        message: "Check the highlighted fields",
        details: Object.fromEntries(
          parsed.error.issues.map((issue) => [String(issue.path[0]), issue.message]),
        ),
      },
      { status: 400 },
    );
  }

  try {
    const auth = await apiRequest<AuthResponse>("/api/v1/auth/register", {
      method: "POST",
      body: JSON.stringify(parsed.data),
    });

    // Registration signs the user straight in: the first run should end on the
    // dashboard, not on a second form.
    const response = NextResponse.json({ user: auth.user }, { status: 201 });
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
