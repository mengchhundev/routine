import Link from "next/link";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";

export function AuthCard({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-dvh flex-col">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-[radial-gradient(50%_100%_at_50%_0%,var(--color-accent-soft),transparent_75%)]"
      />

      <header className="relative flex items-center justify-between px-4 py-5 sm:px-6 lg:px-8">
        <Logo />
        <ThemeToggle />
      </header>

      <main id="main" className="relative flex flex-1 items-center justify-center px-4 py-8 sm:px-6">
        <div className="w-full max-w-[25rem] animate-rise">
          <div className="text-center">
            <h1 className="text-[1.625rem] leading-tight font-semibold sm:text-2xl">{title}</h1>
            <p className="mt-2 text-[0.9375rem] text-muted">{subtitle}</p>
          </div>

          <div className="card mt-7 p-6 sm:p-7">{children}</div>

          <p className="mt-6 text-center text-sm text-muted">{footer}</p>
        </div>
      </main>

      <footer className="relative px-4 py-6 text-center text-xs text-faint sm:px-6">
        <Link href="/" className="transition-colors hover:text-muted">
          ← Back to home
        </Link>
      </footer>
    </div>
  );
}
