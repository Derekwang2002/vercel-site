"use client";

import { useState } from "react";
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

  return (
    <div className={styles.bodyLayout}>
      <PostToc items={tocItems} onOpenChange={setTocOpen} open={tocOpen} />
      <article className={styles.content}>{children}</article>
      <PostReadingRail items={tocItems} />
    </div>
  );
}
