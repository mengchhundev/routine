"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_SECTIONS } from "@/components/app/nav-items";

/**
 * The one nav rendering. The desktop rail and the mobile drawer both use it, so
 * the two can never drift apart — only their container differs, and only the
 * rail responds to the collapsed state (see `.nav-rail` in globals.css).
 */
export function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <div className="space-y-6">
      {NAV_SECTIONS.map((section, index) => (
        <div key={section.label ?? `section-${index}`}>
          {section.label ? (
            <p className="nav-block-label mb-1.5 px-3 text-[0.6875rem] font-semibold tracking-[0.09em] text-faint uppercase">
              {section.label}
            </p>
          ) : null}

          <ul className="space-y-0.5">
            {section.items.map(({ href, label, icon: Icon }) => {
              const active = pathname === href || pathname.startsWith(`${href}/`);

              // Hover lands on `canvas`, not `surface`: both the rail and the
              // drawer are surface-coloured, so a surface hover would be a
              // no-op on the very rows it is meant to respond to.
              const className = [
                "nav-item relative flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors duration-150 lg:py-2",
                active
                  ? "bg-accent-soft font-medium text-accent"
                  : "text-muted hover:bg-canvas hover:text-ink",
              ].join(" ");

              return (
                <li key={href}>
                  <Link
                    href={href}
                    aria-current={active ? "page" : undefined}
                    onClick={onNavigate}
                    className={className}
                  >
                    <Icon className="size-[18px] shrink-0" />
                    <span className="nav-label truncate">{label}</span>
                    {/* Only rendered when the rail is collapsed, where the label
                        is gone and the icon alone has to carry the name. */}
                    <span className="nav-tip" aria-hidden>
                      {label}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
