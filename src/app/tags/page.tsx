import type { Metadata } from "next";
import Link from "next/link";
import { getAllTagsWithCounts } from "../../../lib/posts";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Tags",
  description: "Index of all tags with post counts for quick topic navigation.",
  openGraph: {
    title: "Tags | Personal Website",
    description: "Index of all tags with post counts for quick topic navigation.",
    url: "/tags",
    images: [
      {
        url: "/og-default.svg",
        width: 1200,
        height: 630,
        alt: "Tags Open Graph Image"
      }
    ]
  }
};

export default async function TagsPage() {
  const tags = await getAllTagsWithCounts();

  return (
    <main className={styles.tagsPage}>
      <h1 className={styles.title}>Tags</h1>

      {tags.length === 0 ? (
        <>
          <p className={styles.emptyState}>No tags yet.</p>
          <p className={styles.emptyState}>
            <Link href="/blog">Browse Blog</Link>
          </p>
          <p className={styles.emptyState}>
            <Link href="/">Back to Home</Link>
          </p>
        </>
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
