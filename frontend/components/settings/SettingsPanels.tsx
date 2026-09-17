"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Field, FormMessage, INPUT_BLOCK } from "@/components/form/controls";
import { changePassword, timezoneOptions, updateProfile, updateSettings } from "@/lib/settings";
import type { SettingsResponse, UserResponse } from "@/types/api";

/**
 * Three separate forms rather than one: they have different consequences.
 * Changing your timezone moves every date in the product; changing your
 * password signs out every other session. Saving them together would make one
 * button carry all of that at once.
 */
export function SettingsPanels({
  user,
  settings,
}: {
  user: UserResponse;
  settings: SettingsResponse;
}) {
  return (
    <div className="space-y-4">
      <ProfilePanel user={user} />
      <PreferencesPanel settings={settings} />
      <PasswordPanel />
    </div>
  );
}

function Panel({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="card p-5 sm:p-6">
      <h2 className="text-sm font-medium">{title}</h2>
      <p className="mt-1 max-w-2xl text-[0.8125rem] leading-relaxed text-muted">{description}</p>
      <div className="mt-5">{children}</div>
    </section>
  );
}

/** Saved / failed, said in the one place the reader is looking. */
function Status({ saved, error }: { saved: boolean; error: string | null }) {
  if (error) return <FormMessage error={error} />;
  if (!saved) return null;
  return (
    <p role="status" className="text-[0.8125rem] text-positive">
      Saved.
    </p>
  );
}

function ProfilePanel({ user }: { user: UserResponse }) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState(user.displayName);
  const [timezone, setTimezone] = useState(user.timezone);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const zones = timezoneOptions(user.timezone);
  const moved = timezone !== user.timezone;

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSaved(false);
    setSaving(true);
    try {
      await updateProfile(displayName.trim(), timezone);
      setSaved(true);
      router.refresh();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "That did not save. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Panel
      title="Profile"
      description="Your timezone decides what counts as today — which day a task is due, which day a completion lands on, and where a streak breaks."
    >
      <form onSubmit={save} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" htmlFor="profile-name">
            <input
              id="profile-name"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              required
              maxLength={120}
              className={INPUT_BLOCK}
            />
          </Field>

          <Field label="Timezone" htmlFor="profile-timezone">
            <select
              id="profile-timezone"
              value={timezone}
              onChange={(event) => setTimezone(event.target.value)}
              className={INPUT_BLOCK}
            >
              {zones.map((zone) => (
                <option key={zone} value={zone}>
                  {zone}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <p className="text-[0.8125rem] text-muted">
          Email is <span className="text-ink">{user.email}</span>.
        </p>

        {moved ? (
          <p className="rounded-lg bg-canvas px-3 py-2.5 text-[0.8125rem] text-muted">
            Moving to {timezone} changes which calendar day &ldquo;today&rdquo; means.
            Existing tasks keep the dates they were given.
          </p>
        ) : null}

        <Status saved={saved} error={error} />

        <button type="submit" disabled={saving} className="btn btn-primary px-4 py-2">
          {saving ? "Saving…" : "Save profile"}
        </button>
      </form>
    </Panel>
  );
}

function PreferencesPanel({ settings }: { settings: SettingsResponse }) {
  const router = useRouter();
  const [current, setCurrent] = useState(settings);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSaved(false);
    setSaving(true);
    try {
      await updateSettings(current);
      setSaved(true);
      router.refresh();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "That did not save. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Panel
      title="Preferences"
      description="How the week is laid out, and whether reminders are delivered at all."
    >
      <form onSubmit={save} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Week starts on"
            htmlFor="week-start"
            hint="Used by the planner and the week chart."
          >
            <select
              id="week-start"
              value={current.weekStartsOn}
              onChange={(event) =>
                setCurrent({ ...current, weekStartsOn: Number(event.target.value) })
              }
              className={INPUT_BLOCK}
            >
              {WEEK_START_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </Field>

          <Field
            label="Daily review at"
            htmlFor="review-time"
            hint="The time of day the review is meant for."
          >
            <input
              id="review-time"
              type="time"
              value={current.dailyReviewTime.slice(0, 5)}
              onChange={(event) =>
                setCurrent({ ...current, dailyReviewTime: `${event.target.value}:00` })
              }
              className={INPUT_BLOCK}
            />
          </Field>
        </div>

        <fieldset className="space-y-2">
          <legend className="text-[0.8125rem] font-medium">Reminders</legend>

          <Toggle
            label="Deliver reminders"
            hint="Off means nothing is delivered, whatever is scheduled."
            checked={current.remindersEnabled}
            onChange={(remindersEnabled) => setCurrent({ ...current, remindersEnabled })}
          />
          <Toggle
            label="Email reminders"
            hint="Off downgrades email reminders to in-app rather than dropping them."
            checked={current.emailReminders}
            disabled={!current.remindersEnabled}
            onChange={(emailReminders) => setCurrent({ ...current, emailReminders })}
          />
        </fieldset>

        <Status saved={saved} error={error} />

        <button type="submit" disabled={saving} className="btn btn-primary px-4 py-2">
          {saving ? "Saving…" : "Save preferences"}
        </button>
      </form>
    </Panel>
  );
}

function PasswordPanel() {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSaved(false);

    // Mirrors RegisterRequest: length over composition rules.
    if (newPassword.length < 10) {
      setError("Use at least 10 characters.");
      return;
    }

    setSaving(true);
    try {
      await changePassword(currentPassword, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      setSaved(true);
      router.refresh();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "That did not save. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Panel
      title="Password"
      description="Changing your password signs out every other session, including other devices. This one stays signed in."
    >
      <form onSubmit={save} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Current password" htmlFor="password-current">
            <input
              id="password-current"
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              required
              className={INPUT_BLOCK}
            />
          </Field>

          <Field label="New password" htmlFor="password-new" hint="At least 10 characters.">
            <input
              id="password-new"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              required
              minLength={10}
              maxLength={128}
              className={INPUT_BLOCK}
            />
          </Field>
        </div>

        <Status saved={saved} error={error} />

        <button type="submit" disabled={saving} className="btn btn-secondary px-4 py-2">
          {saving ? "Changing…" : "Change password"}
        </button>
      </form>
    </Panel>
  );
}

function Toggle({
  label,
  hint,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className={`flex cursor-pointer items-start gap-3 ${disabled ? "opacity-50" : ""}`}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5 size-4 accent-[var(--color-accent)]"
      />
      <span>
        <span className="block text-[0.8125rem]">{label}</span>
        <span className="block text-[0.6875rem] text-faint">{hint}</span>
      </span>
    </label>
  );
}

const WEEK_START_OPTIONS = [
  { value: 1, label: "Monday" },
  { value: 6, label: "Saturday" },
  { value: 7, label: "Sunday" },
];
