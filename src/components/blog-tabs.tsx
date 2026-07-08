import Link from "next/link";
import styles from "./blog-tabs.module.css";

export type BlogTab = "all" | "selected";

type BlogTabsProps = {
  activeTab: BlogTab;
  activeTags?: string[];
};

export function BlogTabs({ activeTab, activeTags = [] }: BlogTabsProps) {
  return (
    <nav aria-label="Blog filters" className={styles.tabs}>
      <Link
        className={activeTab === "all" ? `${styles.tab} ${styles.tabActive}` : styles.tab}
        href={buildBlogHref("all", activeTags)}
        scroll={false}
      >
        All Posts
      </Link>
      <Link
        className={activeTab === "selected" ? `${styles.tab} ${styles.tabActive}` : styles.tab}
        href={buildBlogHref("selected", activeTags)}
        scroll={false}
      >
        Selected
      </Link>
    </nav>
  );
}

function buildBlogHref(tab: BlogTab, tags: string[]): string {
  const params = new URLSearchParams({ tab });

  for (const tag of tags) {
    params.append("tag", tag);
  }

  return `/blog?${params.toString()}`;
}
