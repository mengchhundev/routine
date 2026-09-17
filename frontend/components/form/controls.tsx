/**
 * The shared form primitives. Extracted once the third form needed them: an
 * input that looks almost like the others is worse than one that looks exactly
 * like them, and "almost" is what copies drift into.
 */

/** The one input appearance. Compose with width utilities at the call site. */
export const INPUT =
  "min-w-0 rounded-lg border border-line bg-surface px-3 py-2 text-sm placeholder:text-faint transition-colors hover:border-line-strong focus:border-accent focus:ring-4 focus:ring-accent/12 focus:outline-none";

/** Full-width by default, which is what a stacked form wants. */
export const INPUT_BLOCK = `${INPUT} w-full`;

export function Field({
  label,
  htmlFor,
  optional,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  optional?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="text-[0.8125rem] font-medium">
        {label}
        {optional ? <span className="ml-1.5 font-normal text-faint">optional</span> : null}
      </label>
      <div className="mt-1.5">{children}</div>
      {hint ? <p className="mt-1 text-[0.6875rem] text-muted">{hint}</p> : null}
    </div>
  );
}

/** The message a failed save leaves behind. Always announced. */
export function FormMessage({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <p role="alert" className="text-[0.8125rem] text-danger">
      {error}
    </p>
  );
}
