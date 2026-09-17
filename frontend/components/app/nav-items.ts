import {
  BellIcon,
  CalendarIcon,
  ChartIcon,
  GearIcon,
  HomeIcon,
  ListIcon,
  NoteIcon,
  RepeatIcon,
  SunIcon,
  TargetIcon,
} from "@/components/icons";

/**
 * The full information architecture, grouped the way the product reads: what
 * you do today, then what it adds up to, then the account.
 *
 * <p>Every section here is built. The `ready` flag this list used to carry —
 * which dimmed unlinked rows so the nav never implied a feature that did not
 * exist — is gone with the last of those sections.
 */
export type NavItem = {
  href: string;
  label: string;
  icon: (props: { className?: string }) => React.JSX.Element;
};

export type NavSection = { label: string | null; items: NavItem[] };

export const NAV_SECTIONS: NavSection[] = [
  {
    label: null,
    items: [{ href: "/dashboard", label: "Dashboard", icon: HomeIcon }],
  },
  {
    label: "Do",
    items: [
      { href: "/today", label: "Today", icon: SunIcon },
      { href: "/tasks", label: "Tasks", icon: ListIcon },
      { href: "/routines", label: "Routines", icon: RepeatIcon },
      { href: "/planner", label: "Planner", icon: CalendarIcon },
    ],
  },
  {
    label: "Improve",
    items: [
      { href: "/goals", label: "Goals", icon: TargetIcon },
      { href: "/notes", label: "Notes", icon: NoteIcon },
      { href: "/reminders", label: "Reminders", icon: BellIcon },
      { href: "/analytics", label: "Analytics", icon: ChartIcon },
    ],
  },
  {
    label: "Account",
    items: [{ href: "/settings", label: "Settings", icon: GearIcon }],
  },
];

export const NAV_ITEMS = NAV_SECTIONS.flatMap((section) => section.items);
