"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { UserResponse } from "@/types/api";

export function UserMenu({ user }: { user: UserResponse }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const container = useRef<HTMLDivElement>(null);

  // Close on an outside click or Escape — the two ways people expect to dismiss
  // a menu without choosing anything from it.
  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      if (!container.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  async function signOut() {
    setPending(true);
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    router.replace("/login");
    router.refresh();
  }

  const initial = user.displayName.trim().charAt(0).toUpperCase() || "?";

  return (
    <div ref={container} className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-2 rounded-lg p-1 pr-2 transition-colors hover:bg-surface"
      >
        <span className="grid size-8 place-items-center rounded-full bg-accent text-sm font-medium text-accent-ink">
          {initial}
        </span>
        <span className="hidden max-w-32 truncate text-sm sm:block">{user.displayName}</span>
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-60 overflow-hidden rounded-card border border-line bg-surface shadow-lift"
        >
          <div className="border-b border-line px-3.5 py-3">
            <p className="truncate text-sm font-medium">{user.displayName}</p>
            <p className="truncate text-xs text-muted">{user.email}</p>
          </div>

          {/* Also in the nav rail; here because this is where people look for
              their own account rather than for a section of the product. */}
          <Link
            href="/settings"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="block px-3.5 py-2.5 text-sm transition-colors hover:bg-canvas"
          >
            Settings
          </Link>

          <button
            type="button"
            role="menuitem"
            onClick={signOut}
            disabled={pending}
            className="w-full border-t border-line px-3.5 py-2.5 text-left text-sm transition-colors hover:bg-canvas disabled:opacity-60"
          >
            {pending ? "Signing out…" : "Sign out"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
