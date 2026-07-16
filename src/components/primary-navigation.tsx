"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

function localizePath(pathname: string, chinese: boolean): string {
  return chinese ? (pathname === "/" ? "/zh" : `/zh${pathname}`) : pathname;
}

export function PrimaryNavigation() {
  const pathname = usePathname() ?? "/";
  const chinese = pathname === "/zh" || pathname.startsWith("/zh/");

  return (
    <div className="site-nav-links">
      <Link href={localizePath("/", chinese)}>Home</Link>
      <Link href={localizePath("/blog", chinese)}>Blog</Link>
      <Link href={localizePath("/hub/all", chinese)}>Hub</Link>
    </div>
  );
}
