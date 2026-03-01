import Link from "next/link";
import { BlogTabs, type BlogTab } from "@/components/blog-tabs";
import { getAllPosts, getSelectedPosts, type Post } from "../../../lib/posts";
import styles from "./page.module.css";

type BlogPageProps = {
  searchParams?: Promise<{
    tab?: string | string[];
  }>;
};

export default async function BlogPage({ searchParams }: BlogPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const activeTab = resolveTab(resolvedSearchParams?.tab);
  const posts = await loadPosts(activeTab);

  return (
    <main className={styles.blogPage}>
      <h1 className={styles.title}>Blog</h1>
      <BlogTabs activeTab={activeTab} />

      {posts.length === 0 ? (
        <p className={styles.emptyState}>
          {activeTab === "selected" ? "No selected posts yet." : "No posts yet."}
        </p>
      ) : (
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
      )}
    </main>
  );
}

async function loadPosts(activeTab: BlogTab): Promise<Post[]> {
  try {
    return activeTab === "selected" ? await getSelectedPosts() : await getAllPosts();
  } catch {
    return [];
  }
}

function resolveTab(tab: string | string[] | undefined): BlogTab {
  const value = Array.isArray(tab) ? tab[0] : tab;
  return value === "selected" ? "selected" : "all";
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
