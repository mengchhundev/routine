import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";

/**
 * Self-hosted rather than pulled through `next/font/google`. That helper fetches
 * the font from Google at *build* time, which makes every production build
 * depend on reaching fonts.gstatic.com — it fails in an offline or
 * network-restricted CI, and it failed here. The variable file is committed, so
 * the build is deterministic and the browser makes no third-party request.
 */
const inter = localFont({
  src: "./fonts/Inter-Variable.woff2",
  weight: "100 900",
  style: "normal",
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Routine — turn long-term goals into daily actions",
    template: "%s · Routine",
  },
  description:
    "Routine connects what you are trying to become to what you actually do today, then shows you whether it is working.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbfaf9" },
    { media: "(prefers-color-scheme: dark)", color: "#0c0c0e" },
  ],
};

/**
 * Applies the saved theme and navigation width before first paint. Without this,
 * a viewer who chose dark would see a white flash on every navigation, and one
 * who collapsed the sidebar would watch it snap shut after hydration.
 * Deliberately tiny, synchronous, and tolerant of storage being unavailable.
 */
const BOOT_SCRIPT = `try{var d=document.documentElement;var t=localStorage.getItem("routine-theme");if(t==="dark"||t==="light")d.dataset.theme=t;if(localStorage.getItem("routine-nav")==="collapsed")d.dataset.nav="collapsed"}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: BOOT_SCRIPT }} />
      </head>
      <body className="min-h-dvh font-sans antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:rounded-lg focus:bg-surface focus:px-4 focus:py-2 focus:text-sm focus:shadow-lift"
        >
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
