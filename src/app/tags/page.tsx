import Link from "next/link";
import { getAllTagsWithCounts } from "../../../lib/posts";
import styles from "./page.module.css";

export default async function TagsPage() {
  const tags = await getAllTagsWithCounts();

  return (
    <main className={styles.tagsPage}>
      <h1 className={styles.title}>Tags</h1>

      {tags.length === 0 ? (
        <p className={styles.emptyState}>No tags yet.</p>
      ) : (
        <ul className={styles.tagList}>
          {tags.map((item) => (
            <li className={styles.tagItem} key={item.slug}>
              <Link className={styles.tagLink} href={`/tags/${item.slug}`}>
                {item.tag}
              </Link>
              <span className={styles.count}>{item.count}</span>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
