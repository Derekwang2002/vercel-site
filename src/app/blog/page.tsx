import type { Metadata } from "next";
import Link from "next/link";
import { BlogTabs, type BlogTab } from "@/components/blog-tabs";
import {
  getAllPosts,
  getAllTagsWithCounts,
  getSelectedPosts,
  normalizeTagSlug,
  type Post,
  type TagCount
} from "../../../lib/posts";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Blog",
  description: "Chronological timeline of blog posts with all and selected filters.",
  openGraph: {
    title: "Blog | Personal Website",
    description: "Chronological timeline of blog posts with all and selected filters.",
    url: "/blog",
    images: [
      {
        url: "/og-default.svg",
        width: 1200,
        height: 630,
        alt: "Blog Open Graph Image"
      }
    ]
  }
};

type BlogPageProps = {
  searchParams?: Promise<{
    tab?: string | string[];
    tag?: string | string[];
  }>;
};

export default async function BlogPage({ searchParams }: BlogPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const activeTab = resolveTab(resolvedSearchParams?.tab);
  const requestedTag = resolveTag(resolvedSearchParams?.tag);
  const { allPosts, selectedPosts, tags } = await loadBlogData();
  const activeTag = tags.find((tag) => tag.slug === requestedTag);
  const basePosts = activeTab === "selected" ? selectedPosts : allPosts;
  const posts = activeTag ? filterPostsByTag(basePosts, activeTag.slug) : basePosts;
  const latestPost = allPosts[0];

  return (
    <main className={styles.blogPage}>
      <header className={styles.hero}>
        <h1 className={styles.title}>Blog</h1>
        <p className={styles.description}>
          Writing, study notes, and implementation records collected chronologically.
        </p>
        <p className={styles.heroMeta}>
          {allPosts.length} posts · {selectedPosts.length} selected
          {latestPost ? ` · latest ${formatPostDate(latestPost.date)}` : ""}
        </p>
      </header>

      <div className={styles.filterBar}>
        <BlogTabs activeTab={activeTab} activeTag={activeTag?.slug} />
        <TagFilter activeTab={activeTab} activeTag={activeTag} tags={tags} />
      </div>

      {posts.length === 0 ? (
        activeTab === "selected" ? (
          <>
            <p className={styles.emptyState}>No selected posts yet.</p>
            <p className={styles.emptyState}>
              <Link href="/blog?tab=all">View all posts</Link>
            </p>
          </>
        ) : (
          <>
            <p className={styles.emptyState}>No posts published yet.</p>
            <p className={styles.emptyState}>
              <Link href="/">Back to Home</Link>
            </p>
          </>
        )
      ) : (
        <ul className={styles.postList}>
          {posts.map((post) => (
            <li className={styles.postRow} key={post.slug}>
              <div className={styles.postHeader}>
                <Link className={styles.postLink} href={`/blog/${post.slug}`}>
                  {post.title}
                </Link>
                <time className={styles.postDate} dateTime={post.date}>
                  {formatPostDate(post.date)}
                </time>
              </div>
              <p className={styles.postSummary}>{post.summary}</p>
              <PostMeta activeTab={activeTab} post={post} />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

async function loadBlogData(): Promise<{
  allPosts: Post[];
  selectedPosts: Post[];
  tags: TagCount[];
}> {
  try {
    const [allPosts, selectedPosts, tags] = await Promise.all([
      getAllPosts(),
      getSelectedPosts(),
      getAllTagsWithCounts()
    ]);
    return { allPosts, selectedPosts, tags };
  } catch {
    return { allPosts: [], selectedPosts: [], tags: [] };
  }
}

function resolveTab(tab: string | string[] | undefined): BlogTab {
  const value = Array.isArray(tab) ? tab[0] : tab;
  return value === "selected" ? "selected" : "all";
}

function resolveTag(tag: string | string[] | undefined): string | undefined {
  const value = Array.isArray(tag) ? tag[0] : tag;
  const slug = value ? normalizeTagSlug(value) : "";
  return slug || undefined;
}

function filterPostsByTag(posts: Post[], tagSlug: string): Post[] {
  return posts.filter((post) =>
    post.tags.some((postTag) => normalizeTagSlug(postTag) === tagSlug)
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

function TagFilter({
  activeTab,
  activeTag,
  tags
}: {
  activeTab: BlogTab;
  activeTag: TagCount | undefined;
  tags: TagCount[];
}) {
  if (tags.length === 0) {
    return null;
  }

  return (
    <details className={styles.tagMenu}>
      <summary>
        <span>Tags</span>
        {activeTag ? <span className={styles.activeTagName}>{activeTag.tag}</span> : null}
      </summary>
      <div className={styles.tagPanel}>
        {activeTag ? (
          <Link className={styles.clearTag} href={buildBlogHref(activeTab)} scroll={false}>
            Clear filter
          </Link>
        ) : null}
        <div className={styles.tagList}>
          {tags.map((tag) => (
            <Link
              aria-current={activeTag?.slug === tag.slug ? "page" : undefined}
              className={
                activeTag?.slug === tag.slug
                  ? `${styles.tagLink} ${styles.tagLinkActive}`
                  : styles.tagLink
              }
              href={buildBlogHref(activeTab, tag.slug)}
              key={tag.slug}
              scroll={false}
            >
              {tag.tag}
            </Link>
          ))}
        </div>
      </div>
    </details>
  );
}

function PostMeta({ activeTab, post }: { activeTab: BlogTab; post: Post }) {
  return (
    <p className={styles.postMeta}>
      {post.selected ? <span>Selected</span> : null}
      {post.tags.map((tag) => {
        const slug = normalizeTagSlug(tag);
        return (
          <Link href={buildBlogHref(activeTab, slug)} key={slug} scroll={false}>
            {tag}
          </Link>
        );
      })}
    </p>
  );
}

function buildBlogHref(tab: BlogTab, tag?: string): string {
  const params = new URLSearchParams({ tab });

  if (tag) {
    params.set("tag", tag);
  }

  return `/blog?${params.toString()}`;
}
