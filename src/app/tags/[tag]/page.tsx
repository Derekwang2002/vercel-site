import Link from "next/link";
import { notFound } from "next/navigation";
import { getAllTagsWithCounts, getPostsByTag } from "../../../../lib/posts";
import styles from "./page.module.css";

type TagPageProps = {
  params: Promise<{
    tag: string;
  }>;
};

export default async function TagPage({ params }: TagPageProps) {
  const { tag } = await params;
  const allTags = await getAllTagsWithCounts();
  const matchedTag = allTags.find((item) => item.slug === tag);

  if (!matchedTag) {
    notFound();
  }

  const posts = await getPostsByTag(tag);
  if (posts.length === 0) {
    notFound();
  }

  return (
    <main className={styles.tagPage}>
      <p className={styles.backWrap}>
        <Link className={styles.backLink} href="/tags">
          Back to Tags
        </Link>
      </p>

      <h1 className={styles.title}>{matchedTag.tag}</h1>

      <ul className={styles.postList}>
        {posts.map((post) => (
          <li className={styles.postRow} key={post.slug}>
            <Link className={styles.postLink} href={`/blog/${post.slug}`}>
              {post.title}
            </Link>
            <time className={styles.postDate} dateTime={post.date}>
              {formatPostDate(post.date)}
            </time>
          </li>
        ))}
      </ul>
    </main>
  );
}

function formatPostDate(date: string): string {
  const parsed = new Date(`${date}T00:00:00.000Z`);

  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC"
  }).format(parsed);
}
