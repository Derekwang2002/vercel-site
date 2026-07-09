"use client";

import { useEffect, useMemo, useState } from "react";
import type { TocItem } from "./post-toc";
import styles from "../app/blog/[slug]/page.module.css";

type PostReadingRailProps = {
  items: TocItem[];
};

export function PostReadingRail({ items }: PostReadingRailProps) {
  const [activeId, setActiveId] = useState(items[0]?.id ?? "");
  const [copied, setCopied] = useState(false);

  const activeItem = useMemo(
    () => items.find((item) => item.id === activeId) ?? items[0],
    [activeId, items]
  );

  useEffect(() => {
    if (items.length === 0) {
      return;
    }

    const headings = items
      .map((item) => document.getElementById(item.id))
      .filter((heading): heading is HTMLElement => Boolean(heading));

    if (headings.length === 0) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);

        if (visible[0]?.target.id) {
          setActiveId(visible[0].target.id);
        }
      },
      {
        rootMargin: "-20% 0px -65% 0px",
        threshold: 0
      }
    );

    headings.forEach((heading) => observer.observe(heading));

    return () => observer.disconnect();
  }, [items]);

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
