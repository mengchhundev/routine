import { NavList } from "@/components/app/NavList";
import { NavCollapseToggle } from "@/components/app/NavCollapseToggle";

/**
 * Desktop rail: fixed to the left edge for the full height below the header,
 * with its own surface, its own scroll and a pinned footer — so it reads as a
 * frame around the page rather than a column of links inside it. Below lg the
 * same list is reached through the drawer.
 */
export function SideNav() {
  return (
    <nav
      aria-label="Sections"
      className="nav-rail fixed top-16 bottom-0 left-0 z-30 hidden w-[var(--nav-width)] flex-col border-r border-line bg-surface transition-[width] duration-200 ease-out lg:flex"
    >
      {/* Only the list scrolls. A long nav must never push the footer off the
          bottom of the rail. */}
      <div className="nav-scroll nav-pad flex-1 overflow-y-auto overscroll-contain px-3 py-5">
        <NavList />
      </div>

      <div className="nav-pad shrink-0 border-t border-line px-3 py-3">
        <NavCollapseToggle />
      </div>
    </nav>
  );
}
