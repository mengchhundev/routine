import { apiGet, getCurrentUser } from "@/lib/api";
import { SettingsPanels } from "@/components/settings/SettingsPanels";
import type { SettingsResponse } from "@/types/api";

export const metadata = { title: "Settings" };

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const [user, settings] = await Promise.all([
    getCurrentUser(),
    apiGet<SettingsResponse>("/api/v1/users/me/settings"),
  ]);

  return (
    <div className="max-w-3xl space-y-6">
      <header>
        <h1 className="text-[1.75rem] leading-tight font-semibold sm:text-3xl">Settings</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Your account, and the few choices that change how the rest of the
          product behaves.
        </p>
      </header>

      <SettingsPanels user={user} settings={settings} />
    </div>
  );
}
