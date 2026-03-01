import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Personal Website",
  description: "Minimal personal website skeleton"
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
