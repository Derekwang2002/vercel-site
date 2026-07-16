import type { Metadata } from "next";
import { BlogExplorer, type BlogExplorerPost } from "@/components/blog-explorer";
import { getAllLocalizedPosts } from "../../../../lib/localized-posts";
import { normalizeTagSlug, type Post, type TagCount } from "../../../../lib/posts";
import styles from "../../blog/page.module.css";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Blog",
  description: "按时间整理的写作、学习笔记与实现记录。",
  alternates: { canonical: "/zh/blog", languages: { en: "/blog", "zh-CN": "/zh/blog" } }
};

export default async function ChineseBlogPage() {
  const allPosts = await loadBlogData();
  const posts = allPosts.map(toExplorerPost);
  const selectedCount = posts.filter((post) => post.selected).length;
  const tags = getTagsWithCounts(posts);
  const latestPost = allPosts[0];

  return (
    <main className={styles.blogPage} lang="zh-CN">
      <header className={styles.hero}>
        <h1 className={styles.title}>Blog</h1>
        <p className={styles.description}>按时间整理的写作、学习笔记与实现记录。</p>
        <p className={styles.heroMeta}>
          {posts.length} 篇文章 · {selectedCount} 篇精选
          {latestPost ? ` · 最新 ${formatPostDate(latestPost.date)}` : ""}
        </p>
      </header>
      <BlogExplorer locale="zh" posts={posts} tags={tags} />
    </main>
  );
}

async function loadBlogData(): Promise<Post[]> {
  try { return await getAllLocalizedPosts("zh"); } catch { return []; }
}

function toExplorerPost(post: Post): BlogExplorerPost {
  return { date: post.date, selected: post.selected, slug: post.slug, summary: post.summary, tags: post.tags, title: post.title };
}

function formatPostDate(date: string): string {
  return new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" })
    .format(new Date(`${date}T00:00:00.000Z`));
}

function getTagsWithCounts(posts: BlogExplorerPost[]): TagCount[] {
  const tagMap = new Map<string, { count: number; variants: Set<string> }>();
  for (const post of posts) {
    const unique = new Set<string>();
    for (const tag of post.tags) {
      const slug = normalizeTagSlug(tag);
      if (!slug || unique.has(slug)) continue;
      unique.add(slug);
      const current = tagMap.get(slug);
      if (current) { current.count += 1; current.variants.add(tag.trim()); }
      else tagMap.set(slug, { count: 1, variants: new Set([tag.trim()]) });
    }
  }
  return Array.from(tagMap.entries()).map(([slug, value]) => ({
    slug, count: value.count,
    tag: Array.from(value.variants).sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" }))[0]
  })).sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag, "en", { sensitivity: "base" }));
}
