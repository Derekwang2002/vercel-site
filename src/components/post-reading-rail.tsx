"use client";

import { useMemo, useState } from "react";
import type { TocItem } from "./post-toc";
import styles from "../app/blog/[slug]/page.module.css";

type PostReadingRailProps = {
  activeId: string;
  items: TocItem[];
};

export function PostReadingRail({ activeId, items }: PostReadingRailProps) {
  const [copied, setCopied] = useState(false);

  const activeItem = useMemo(
    () => items.find((item) => item.id === activeId) ?? items[0],
    [activeId, items]
  );

  async function copyCurrentUrl() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      setCopied(false);
    }
  }

  function scrollToTop() {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    window.scrollTo({
      top: 0,
      behavior: reduceMotion ? "auto" : "smooth"
    });
  }

  if (!activeItem) {
    return null;
  }

  return (
    <aside aria-label="Reading tools" className={styles.readingRail}>
      <div aria-hidden="true" className={styles.readingProgress}>
        <span className={styles.readingProgressFill} />
      </div>

      <div className={styles.readingMeta}>
        <span className={styles.readingLabel}>Now</span>
        <a className={styles.readingCurrent} href={`#${activeItem.id}`}>
          {activeItem.text}
        </a>
      </div>

      <div className={styles.readingActions}>
        <button className={styles.readingAction} onClick={copyCurrentUrl} type="button">
          {copied ? "Copied" : "Copy link"}
        </button>
        <button className={styles.readingAction} onClick={scrollToTop} type="button">
          Top
        </button>
      </div>
    </aside>
  );
}
