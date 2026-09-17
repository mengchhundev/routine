"use client";

import { useId, useState } from "react";

type FieldProps = {
  label: string;
  name: string;
  type?: string;
  autoComplete?: string;
  required?: boolean;
  defaultValue?: string;
  placeholder?: string;
  hint?: string;
  error?: string;
};

export function Field({ label, name, type = "text", hint, error, ...rest }: FieldProps) {
  const hintId = useId();
  const errorId = useId();
  const [revealed, setRevealed] = useState(false);

  const isPassword = type === "password";
  const inputType = isPassword && revealed ? "text" : type;
  const describedBy = error ? errorId : hint ? hintId : undefined;

  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={name} className="text-sm font-medium">
          {label}
        </label>

        {/* Typing a long password blind is the main cause of failed sign-ins,
            so the reveal control sits with the label rather than inside the
            input, where it would collide with password-manager icons. */}
        {isPassword ? (
          <button
            type="button"
            onClick={() => setRevealed((current) => !current)}
            className="text-xs font-medium text-muted transition-colors hover:text-ink"
          >
            {revealed ? "Hide" : "Show"}
          </button>
        ) : null}
      </div>

      <input
        id={name}
        name={name}
        type={inputType}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className="w-full rounded-lg border border-line bg-surface px-3.5 py-2.5 text-sm
                   text-ink placeholder:text-faint
                   transition-colors duration-150
                   hover:border-line-strong
                   focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent/12
                   aria-[invalid=true]:border-danger aria-[invalid=true]:focus:ring-danger/12"
        {...rest}
      />

      {error ? (
        <p id={errorId} className="text-[0.8125rem] text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="text-[0.8125rem] text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
