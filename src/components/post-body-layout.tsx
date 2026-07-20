"use client";

import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { PostReadingRail } from "./post-reading-rail";
import { PostToc, type TocItem } from "./post-toc";
import { useActiveHeading } from "./use-active-heading";
import type { PostSeriesLocale, PostSeriesNavigation } from "../../lib/post-series";
import styles from "../app/blog/[slug]/page.module.css";

const TOC_PREFERENCE_KEY = "derek-hub:toc-open";

type ViewportMode = "pending" | "wide" | "medium" | "mobile";

type PostBodyLayoutProps = {
  articleTitle: string;
  children: ReactNode;
  locale?: PostSeriesLocale;
  seriesNavigation?: PostSeriesNavigation;
  tocItems: TocItem[];
};

export function PostBodyLayout({
  articleTitle,
  children,
  locale = "en",
  seriesNavigation,
  tocItems
}: PostBodyLayoutProps) {
  const [viewportMode, setViewportMode] = useState<ViewportMode>("pending");
  const [wideOpen, setWideOpen] = useState(true);
  const [overlayOpen, setOverlayOpen] = useState(false);
  const activeId = useActiveHeading(tocItems);

  useEffect(() => {
    const wideQuery = window.matchMedia("(min-width: 1280px)");
    const mobileQuery = window.matchMedia("(max-width: 920px)");

    try {
      const storedPreference = window.localStorage.getItem(TOC_PREFERENCE_KEY);

      if (storedPreference === "closed") {
        setWideOpen(false);
      } else if (storedPreference === "open") {
        setWideOpen(true);
      }
    } catch {
      // Storage can be unavailable in private or restricted browser contexts.
    }

    function syncViewportMode() {
      const nextMode: ViewportMode = wideQuery.matches
        ? "wide"
        : mobileQuery.matches
          ? "mobile"
          : "medium";

      setViewportMode(nextMode);
      setOverlayOpen(false);
    }

    syncViewportMode();
    wideQuery.addEventListener("change", syncViewportMode);
    mobileQuery.addEventListener("change", syncViewportMode);

    return () => {
      wideQuery.removeEventListener("change", syncViewportMode);
      mobileQuery.removeEventListener("change", syncViewportMode);
    };
  }, []);

  useEffect(() => {
    setOverlayOpen(false);
  }, [articleTitle]);

  const tocOpen = viewportMode === "wide" ? wideOpen : overlayOpen;
  const tocOverlay = viewportMode === "medium" || viewportMode === "mobile";

  const setTocOpen = useCallback(
    (nextOpen: boolean) => {
      if (viewportMode === "wide") {
        setWideOpen(nextOpen);

        try {
          window.localStorage.setItem(TOC_PREFERENCE_KEY, nextOpen ? "open" : "closed");
        } catch {
          // Keep the in-memory preference when storage is unavailable.
        }

        return;
      }

      setOverlayOpen(nextOpen);
    },
    [viewportMode]
  );

  return (
    <div className={styles.bodyLayout}>
      <PostToc
        activeId={activeId}
        articleTitle={articleTitle}
        items={tocItems}
        locale={locale}
        onOpenChange={setTocOpen}
        open={tocOpen}
        overlay={tocOverlay}
        seriesNavigation={seriesNavigation}
      />
      <article className={styles.content}>{children}</article>
      <PostReadingRail activeId={activeId} items={tocItems} />
    </div>
  );
}
