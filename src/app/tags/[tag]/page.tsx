import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getAllTagsWithCounts, getPostsByTag } from "../../../../lib/posts";
import styles from "./page.module.css";

const SITE_NAME = "Personal Website";

const SITE_URL = (() => {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim() || "http://localhost:3000";
  return raw.endsWith("/") ? raw.slice(0, -1) : raw;
})();

type TagPageProps = {
  params: Promise<{
    tag: string;
  }>;
};

export async function generateMetadata({ params }: TagPageProps): Promise<Metadata> {
  const { tag } = await params;
  const allTags = await getAllTagsWithCounts();
  const matchedTag = allTags.find((item) => item.slug === tag);

  if (!matchedTag) {
    return {
      title: "Tag Not Found",
      description: "The requested tag could not be found."
    };
  }

  const title = `${matchedTag.tag} | Tags | ${SITE_NAME}`;
  const description = `Timeline of non-draft posts tagged with ${matchedTag.tag}.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `${SITE_URL}/tags/${matchedTag.slug}`,
      images: [
        {
          url: "/og-default.svg",
          width: 1200,
          height: 630,
          alt: `${matchedTag.tag} Open Graph Image`
        }
      ]
    }
  };
}

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
