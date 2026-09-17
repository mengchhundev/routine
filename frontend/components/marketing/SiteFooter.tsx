import Link from "next/link";
import { Logo } from "@/components/Logo";

export function SiteFooter() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-[90rem] flex-col gap-6 px-4 py-10 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8 2xl:px-12">
        <div className="space-y-1.5">
          <Logo />
          <p className="text-[0.8125rem] text-muted">
            A personal improvement system, not another to-do list.
          </p>
        </div>

        <nav className="flex flex-wrap gap-x-6 gap-y-2 text-[0.8125rem] text-muted">
          <Link href="/login" className="transition-colors hover:text-ink">
            Sign in
          </Link>
          <Link href="/register" className="transition-colors hover:text-ink">
            Create account
          </Link>
        </nav>
      </div>
    </footer>
  );
}
