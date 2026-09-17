import Link from "next/link";

/**
 * The mark is the product loop in miniature: a ring (the repeating routine)
 * closed by a check (the day completed).
 */
export function Logo({ href = "/", className = "" }: { href?: string; className?: string }) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-2 text-[0.9375rem] font-semibold tracking-tight ${className}`}
    >
      <span className="grid size-7 place-items-center rounded-lg bg-accent text-accent-ink">
        <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
          <path
            d="M20 12a8 8 0 1 1-3.2-6.4"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
          <path
            d="m8.8 12.2 2.6 2.6L20 5.6"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      Routine
    </Link>
  );
}
