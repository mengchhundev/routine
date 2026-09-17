import type { SettingsResponse, UserResponse } from "@/types/api";

/** Writes to the account endpoints. See lib/goals.ts for why it goes via the proxy. */
async function send<T>(path: string, method: string, body: unknown): Promise<T> {
  const response = await fetch(`/api/proxy${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const problem = await response.json().catch(() => null);
    throw new Error(problem?.message ?? "That did not save. Try again.");
  }

  return response.status === 204 ? (undefined as T) : ((await response.json()) as T);
}

export const updateProfile = (displayName: string, timezone: string) =>
  send<UserResponse>("/users/me", "PUT", { displayName, timezone });

export const changePassword = (currentPassword: string, newPassword: string) =>
  send<void>("/users/me/password", "POST", { currentPassword, newPassword });

export const updateSettings = (settings: SettingsResponse) =>
  send<SettingsResponse>("/users/me/settings", "PUT", settings);

/**
 * The zone list from the browser itself, so it is always current and costs no
 * bundle. Falls back to the account's own zone where the API is unavailable.
 */
export function timezoneOptions(current: string): string[] {
  const supported =
    typeof Intl.supportedValuesOf === "function"
      ? (Intl.supportedValuesOf("timeZone") as string[])
      : [current];

  return supported.includes(current) ? supported : [current, ...supported];
}
