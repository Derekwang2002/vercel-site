import type { Metadata } from "next";
import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";
import "./globals.css";

const SITE_NAME = "Personal Website";
const DEFAULT_DESCRIPTION =
  "Minimal personal website for writing, resources, and visual demos.";
const DEFAULT_OG_IMAGE = "/og-default.svg";

const SITE_URL = (() => {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim() || "http://localhost:3000";
  return raw.endsWith("/") ? raw.slice(0, -1) : raw;
})();

const THEME_INIT_SCRIPT = `
(() => {
  try {
    const stored = window.localStorage.getItem("theme");
    const theme =
      stored === "dark" || stored === "light"
        ? stored
        : window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light";
    document.documentElement.dataset.theme = theme;
  } catch {
    document.documentElement.dataset.theme = "light";
  }
})();
`;

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_NAME,
    template: `%s | ${SITE_NAME}`
  },
  description: DEFAULT_DESCRIPTION,
  openGraph: {
    type: "website",
    title: SITE_NAME,
    description: DEFAULT_DESCRIPTION,
    siteName: SITE_NAME,
    url: SITE_URL,
    images: [
      {
        url: DEFAULT_OG_IMAGE,
        width: 1200,
        height: 630,
        alt: `${SITE_NAME} Open Graph Image`
      }
    ]
  }
};

type RootLayoutProps = {
  children: React.ReactNode;
};

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>
        <div className="site-shell">
          <header className="site-header">
            <nav aria-label="Primary navigation" className="site-nav">
              <div className="site-nav-links">
                <Link href="/">Home</Link>
                <Link href="/blog">Blog</Link>
                <Link href="/hub/all">Hub</Link>
              </div>
              <div className="site-theme-slot">
                <ThemeToggle />
              </div>
            </nav>
          </header>

          <div className="site-content">{children}</div>

          <footer className="site-footer">© 2026 Derek Wang</footer>
        </div>
      </body>
    </html>
  );
}
