import { NextResponse } from "next/server";
import { apiRequest } from "@/lib/api";
import { clearedCookies, getRefreshToken } from "@/lib/session";

export async function POST() {
  const refreshToken = await getRefreshToken();

  if (refreshToken) {
    // Best effort: the session is over locally whether or not the API answers.
    await apiRequest("/api/v1/auth/logout", {
      method: "POST",
      body: JSON.stringify({ refreshToken }),
    }).catch(() => undefined);
  }

  const response = NextResponse.json({ ok: true });
  for (const cookie of clearedCookies()) {
    response.cookies.set(cookie.name, cookie.value, cookie.options);
  }
  return response;
}
