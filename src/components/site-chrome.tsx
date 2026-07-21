"use client";

import React, { Suspense } from "react";
import { usePathname } from "next/navigation";
import { LanguageToggle } from "./language-toggle";
import { PrimaryNavigation } from "./primary-navigation";
import { ThemeToggle } from "./theme-toggle";

export function isSiteChromeVisible(pathname: string): boolean {
  return !pathname.startsWith("/share/");
}

export function SiteHeader() {
  const pathname = usePathname();
  if (!isSiteChromeVisible(pathname)) return null;

  return (
    <header className="site-header">
      <nav aria-label="Primary navigation" className="site-nav">
        <PrimaryNavigation />
        <div className="site-controls">
          <Suspense fallback={<span className="language-toggle" aria-hidden="true">Lang</span>}>
            <LanguageToggle />
          </Suspense>
          <ThemeToggle />
        </div>
      </nav>
    </header>
  );
}

export function SiteFooter() {
  const pathname = usePathname();
  if (!isSiteChromeVisible(pathname)) return null;

  return <footer className="site-footer">© 2026 Derek Wang</footer>;
}
