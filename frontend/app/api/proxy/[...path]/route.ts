import { NextResponse, type NextRequest } from "next/server";
import { API_URL } from "@/lib/api";
import { getAccessToken } from "@/lib/session";

/**
 * Same-origin proxy to the versioned API, carrying the caller's access token.
 *
 * The browser cannot attach the token itself — it is httpOnly by design — so
 * client components call `/api/proxy/tasks/{id}/complete` and this hands the
 * request on. It is not an open forwarder: the upstream path is always rebuilt
 * as `/api/v1/<segments>` from the matched route segments, so no caller-supplied
 * host, scheme or traversal can escape the API.
 */
const FORWARDED_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;

async function handle(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const token = await getAccessToken();
  if (!token) {
    return NextResponse.json(
      { code: "UNAUTHENTICATED", message: "Authentication is required" },
      { status: 401 },
    );
  }

  const { path } = await context.params;

  // Reject anything that is not a plain path segment before it is ever joined.
  if (!path?.length || path.some((segment) => segment.includes("/") || segment === "..")) {
    return NextResponse.json({ code: "BAD_REQUEST", message: "Invalid path" }, { status: 400 });
  }

  const target = `${API_URL}/api/v1/${path.map(encodeURIComponent).join("/")}${request.nextUrl.search}`;
  const method = request.method.toUpperCase();

  if (!FORWARDED_METHODS.includes(method as (typeof FORWARDED_METHODS)[number])) {
    return NextResponse.json({ code: "METHOD_NOT_ALLOWED", message: "Unsupported method" }, { status: 405 });
  }

  const hasBody = method !== "GET" && method !== "DELETE";
  const body = hasBody ? await request.text() : undefined;

  try {
    const upstream = await fetch(target, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body || undefined,
      cache: "no-store",
    });

    if (upstream.status === 204) {
      return new NextResponse(null, { status: 204 });
    }

    const text = await upstream.text();
    return new NextResponse(text, {
      status: upstream.status,
      headers: { "Content-Type": upstream.headers.get("Content-Type") ?? "application/json" },
    });
  } catch {
    return NextResponse.json(
      { code: "UPSTREAM_UNAVAILABLE", message: "Could not reach the server" },
      { status: 502 },
    );
  }
}

export { handle as GET, handle as POST, handle as PUT, handle as PATCH, handle as DELETE };
