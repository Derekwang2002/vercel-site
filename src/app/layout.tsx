import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

const SITE_NAME = "Personal Website";
const DEFAULT_DESCRIPTION =
  "Minimal personal website for timeline-first writing and tag-based navigation.";
const DEFAULT_OG_IMAGE = "/og-default.svg";

const SITE_URL = (() => {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim() || "http://localhost:3000";
  return raw.endsWith("/") ? raw.slice(0, -1) : raw;
})();

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
    <html lang="en">
      <body>
        <div className="site-shell">
          <header className="site-header">
            <nav aria-label="Primary navigation" className="site-nav">
              <Link href="/">Home</Link>
              <Link href="/blog">Blog</Link>
              <Link href="/tags">Tags</Link>
            </nav>
          </header>

          <div className="site-content">{children}</div>

          <footer className="site-footer">© 2026 Personal Website</footer>
        </div>
      </body>
    </html>
  );
}
