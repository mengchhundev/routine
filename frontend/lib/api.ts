import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { getAccessToken } from "@/lib/session";
import type { ApiErrorBody, UserResponse } from "@/types/api";

/**
 * Inside Docker the API is reachable as http://api:8080; outside it is
 * localhost. Either way this value is server-only — it is never inlined into
 * client bundles, and the browser only ever calls Next route handlers.
 */
export const API_URL = process.env.API_INTERNAL_URL ?? "http://localhost:8080";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly body: ApiErrorBody,
  ) {
    super(body.message);
  }
}

/** Unauthenticated call to the backend, used by the auth route handlers. */
export async function apiRequest<T>(
  path: string,
  init: RequestInit & { token?: string } = {},
): Promise<T> {
  const { token, ...rest } = init;

  const response = await fetch(`${API_URL}${path}`, {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...rest.headers,
    },
    cache: "no-store",
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const body = await response.json().catch(() => null);

  if (!response.ok) {
    throw new ApiError(
      response.status,
      (body as ApiErrorBody) ?? {
        code: "UNKNOWN_ERROR",
        message: "The server returned an unexpected response",
        timestamp: new Date().toISOString(),
      },
    );
  }

  return body as T;
}

/**
 * Authenticated call from a server component. A 401 here means the access token
 * expired between middleware refreshing it and this render — rare, and the
 * honest response is to send the user through the login route again.
 */
export async function apiGet<T>(path: string): Promise<T> {
  const token = await getAccessToken();
  if (!token) {
    redirect("/login");
  }

  try {
    return await apiRequest<T>(path, { token });
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      redirect("/login");
    }
    throw error;
  }
}

/**
 * The signed-in shell and the page inside it both need the current user.
 * `cache` collapses that into one request per render pass.
 */
export const getCurrentUser = cache(() => apiGet<UserResponse>("/api/v1/users/me"));
