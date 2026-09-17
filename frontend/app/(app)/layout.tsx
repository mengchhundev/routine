import { getCurrentUser } from "@/lib/api";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { SideNav } from "@/components/app/SideNav";
import { MobileNav } from "@/components/app/MobileNav";
import { UserMenu } from "@/components/app/UserMenu";

/** Shell for every signed-in page: identity, navigation, and nothing else. */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();

  return (
    <div className="min-h-dvh">
      {/* The application runs full-bleed: it is a workspace, not an article, so
          it uses the whole screen. Gutters grow with the viewport instead, and
          long-form text inside each page carries its own reading measure. */}
      <header className="sticky top-0 z-40 border-b border-line/70 bg-canvas/85 backdrop-blur-md">
        <div className="flex h-16 items-center justify-between gap-3 px-4 sm:px-6 lg:px-8 2xl:px-12">
          <div className="flex min-w-0 items-center gap-1.5">
            <MobileNav />
            <Logo href="/dashboard" />
          </div>

          <div className="flex shrink-0 items-center gap-1">
            <ThemeToggle />
            <UserMenu user={user} />
          </div>
        </div>
      </header>

      <SideNav />

      {/* The rail's width is a custom property, so collapsing is one attribute
          flip on the root rather than state threaded through the tree: the rail
          and the space it reserves here read the same value. */}
      <div className="transition-[padding] duration-200 ease-out lg:pl-[var(--nav-width)]">
        <main
          id="main"
          className="min-w-0 px-4 py-8 sm:px-6 lg:px-8 lg:py-10 2xl:px-12"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
