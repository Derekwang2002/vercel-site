import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getMarkdownHeadings, renderMarkdown } from "@/components/markdown-renderer";
import { PostBodyLayout } from "@/components/post-body-layout";
import { getAllPosts, getPostBySlug, normalizeTagSlug } from "../../../../lib/posts";
import styles from "./page.module.css";

const DEFAULT_OG_IMAGE = "/og-default.svg";

const SITE_URL = (() => {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim() || "http://localhost:3000";
  return raw.endsWith("/") ? raw.slice(0, -1) : raw;
})();

type BlogPostPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export const dynamicParams = false;

export async function generateStaticParams(): Promise<Array<{ slug: string }>> {
  const posts = await getAllPosts();
  return posts.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({ params }: BlogPostPageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPostBySlug(slug);

  if (!post) {
    return {
      title: "Post Not Found",
      description: "The requested post could not be found."
    };
  }

  const absoluteUrl = `${SITE_URL}/blog/${post.slug}`;

  return {
    title: post.title,
    description: post.summary,
    openGraph: {
      type: "article",
      title: post.title,
      description: post.summary,
      url: absoluteUrl,
      images: [
        {
          url: DEFAULT_OG_IMAGE,
          width: 1200,
          height: 630,
          alt: `${post.title} Open Graph Image`
        }
      ],
      publishedTime: `${post.date}T00:00:00.000Z`
    }
  };
}

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const { slug } = await params;
  const post = await getPostBySlug(slug);

  if (!post) {
    notFound();
  }

  const tocItems = getMarkdownHeadings(post.content);
  const renderedContent = await renderMarkdown(post.content, tocItems);

  return (
    <main className={styles.postPage}>
      <p className={styles.backWrap}>
        <Link className={styles.backLink} href="/blog">
          Back to Blog
        </Link>
      </p>

      <header className={styles.header}>
        <h1 className={styles.title}>{post.title}</h1>
        <time className={styles.date} dateTime={post.date}>
          {formatPostDate(post.date)}
        </time>
        <ul className={styles.tags}>
          {post.tags.map((tag) => (
            <li key={tag}>
              <Link className={styles.tagLink} href={`/blog?tag=${normalizeTagSlug(tag)}`}>
                {tag}
              </Link>
            </li>
          ))}
        </ul>
      </header>

      <PostBodyLayout articleTitle={post.title} tocItems={tocItems}>
        {renderedContent}
      </PostBodyLayout>
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
