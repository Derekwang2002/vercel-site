"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { PostReadingRail } from "./post-reading-rail";
import { PostToc, type TocItem } from "./post-toc";
import styles from "../app/blog/[slug]/page.module.css";

type PostBodyLayoutProps = {
  children: ReactNode;
  tocItems: TocItem[];
};

export function PostBodyLayout({ children, tocItems }: PostBodyLayoutProps) {
  const [tocOpen, setTocOpen] = useState(true);

  useEffect(() => {
    const mobileQuery = window.matchMedia("(max-width: 720px)");

    function syncTocToViewport(event: MediaQueryList | MediaQueryListEvent) {
      setTocOpen(!event.matches);
    }

    syncTocToViewport(mobileQuery);
    mobileQuery.addEventListener("change", syncTocToViewport);

    return () => {
      mobileQuery.removeEventListener("change", syncTocToViewport);
    };
  }, []);

  return (
    <div className={styles.bodyLayout}>
      <PostToc items={tocItems} onOpenChange={setTocOpen} open={tocOpen} />
      <article className={styles.content}>{children}</article>
      <PostReadingRail items={tocItems} />
    </div>
  );
}
