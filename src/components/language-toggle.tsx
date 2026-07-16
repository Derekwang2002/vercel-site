"use client";

import Link from "next/link";
import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

const STORAGE_KEY = "content-locale";

function toOtherLocalePath(pathname: string): string {
  if (pathname === "/zh") return "/";
  if (pathname.startsWith("/zh/")) return pathname.slice(3);
  return pathname === "/" ? "/zh" : `/zh${pathname}`;
}

export function LanguageToggle() {
  const pathname = usePathname() ?? "/";
  const searchParams = useSearchParams();
  const chinese = pathname === "/zh" || pathname.startsWith("/zh/");
  const query = searchParams.toString();
  const href = `${toOtherLocalePath(pathname)}${query ? `?${query}` : ""}`;

  useEffect(() => {
    document.documentElement.lang = chinese ? "zh-CN" : "en";
  }, [chinese]);

  return (
    <Link
      aria-label={chinese ? "Switch content language to English" : "切换内容语言为中文"}
      className="language-toggle"
      href={href}
      onClick={() => {
        try {
          localStorage.setItem(STORAGE_KEY, chinese ? "en" : "zh");
        } catch {
          // The URL remains the source of truth when storage is unavailable.
        }
      }}
    >
      {chinese ? "EN" : "中文"}
    </Link>
  );
}
