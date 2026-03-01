import Link from "next/link";
import styles from "./blog-tabs.module.css";

export type BlogTab = "all" | "selected";

type BlogTabsProps = {
  activeTab: BlogTab;
};

export function BlogTabs({ activeTab }: BlogTabsProps) {
  return (
    <nav aria-label="Blog filters" className={styles.tabs}>
      <Link
        className={activeTab === "all" ? `${styles.tab} ${styles.tabActive}` : styles.tab}
        href="/blog?tab=all"
        scroll={false}
      >
        All Posts
      </Link>
      <Link
        className={activeTab === "selected" ? `${styles.tab} ${styles.tabActive}` : styles.tab}
        href="/blog?tab=selected"
        scroll={false}
      >
        Selected
      </Link>
    </nav>
  );
}
