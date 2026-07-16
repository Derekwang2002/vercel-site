import Link from "next/link";
import type { MouseEvent } from "react";
import styles from "./blog-tabs.module.css";

export type BlogTab = "all" | "selected";

type BlogTabsProps = {
  activeTab: BlogTab;
  activeTags?: string[];
  locale?: "en" | "zh";
  onNavigate?: (href: string) => void;
};

export function BlogTabs({ activeTab, activeTags = [], locale = "en", onNavigate }: BlogTabsProps) {
  const allHref = buildBlogHref("all", activeTags, locale);
  const selectedHref = buildBlogHref("selected", activeTags, locale);

  return (
    <nav aria-label={locale === "zh" ? "Blog 筛选" : "Blog filters"} className={styles.tabs}>
      <Link
        className={activeTab === "all" ? `${styles.tab} ${styles.tabActive}` : styles.tab}
        href={allHref}
        onClick={(event) => {
          if (!onNavigate || isModifiedClick(event)) return;
          event.preventDefault();
          onNavigate(allHref);
        }}
        prefetch={false}
        scroll={false}
      >
        {locale === "zh" ? "全部文章" : "All Posts"}
      </Link>
      <Link
        className={activeTab === "selected" ? `${styles.tab} ${styles.tabActive}` : styles.tab}
        href={selectedHref}
        onClick={(event) => {
          if (!onNavigate || isModifiedClick(event)) return;
          event.preventDefault();
          onNavigate(selectedHref);
        }}
        prefetch={false}
        scroll={false}
      >
        {locale === "zh" ? "精选" : "Selected"}
      </Link>
    </nav>
  );
}

function buildBlogHref(tab: BlogTab, tags: string[], locale: "en" | "zh"): string {
  const params = new URLSearchParams({ tab });

  for (const tag of tags) {
    params.append("tag", tag);
  }

  return `${locale === "zh" ? "/zh" : ""}/blog?${params.toString()}`;
}

function isModifiedClick(event: MouseEvent<HTMLAnchorElement>): boolean {
  return event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
}
