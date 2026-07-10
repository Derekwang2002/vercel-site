"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { MouseEvent } from "react";
import { BlogTagMenu } from "./blog-tag-menu";
import { BlogTabs, type BlogTab } from "./blog-tabs";
import type { BlogTag } from "./blog-tag-menu";
import styles from "../app/blog/page.module.css";

export type BlogExplorerPost = {
  date: string;
  selected?: boolean;
  slug: string;
  summary: string;
  tags: string[];
  title: string;
};

type BlogExplorerProps = {
  posts: BlogExplorerPost[];
  tags: BlogTag[];
};

type BlogFilters = {
  activeTab: BlogTab;
  activeTags: string[];
};

const DEFAULT_FILTERS: BlogFilters = {
  activeTab: "all",
  activeTags: []
};

export function BlogExplorer({ posts, tags }: BlogExplorerProps) {
  const validTagSlugs = useMemo(() => new Set(tags.map((tag) => tag.slug)), [tags]);
  const [filters, setFilters] = useState<BlogFilters>(DEFAULT_FILTERS);

  useEffect(() => {
    function syncFromLocation() {
      setFilters(resolveFilters(new URLSearchParams(window.location.search), validTagSlugs));
    }

    syncFromLocation();
    window.addEventListener("popstate", syncFromLocation);

    return () => {
      window.removeEventListener("popstate", syncFromLocation);
    };
  }, [validTagSlugs]);

  const filteredPosts = useMemo(
    () => filterPosts(posts, filters.activeTab, filters.activeTags),
    [filters.activeTab, filters.activeTags, posts]
  );

  function navigate(href: string) {
    const url = new URL(href, window.location.origin);
    const nextFilters = resolveFilters(url.searchParams, validTagSlugs);

    window.history.pushState(null, "", href);
    setFilters(nextFilters);
  }

  return (
    <>
      <div className={styles.filterBar}>
        <BlogTabs
          activeTab={filters.activeTab}
          activeTags={filters.activeTags}
          onNavigate={navigate}
        />
        <span aria-hidden="true" className={styles.filterDivider} />
        <BlogTagMenu
          activeTab={filters.activeTab}
          onNavigate={navigate}
          selectedTags={filters.activeTags}
          tags={tags}
        />
      </div>

      {filteredPosts.length === 0 ? (
        filters.activeTab === "selected" ? (
          <>
            <p className={styles.emptyState}>No selected posts yet.</p>
            <p className={styles.emptyState}>
              <Link
                href="/blog?tab=all"
                onClick={(event) => {
                  if (isModifiedClick(event)) return;
                  event.preventDefault();
                  navigate("/blog?tab=all");
                }}
                prefetch={false}
                scroll={false}
              >
                View all posts
              </Link>
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
          {filteredPosts.map((post) => (
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
              <PostMeta activeTab={filters.activeTab} onNavigate={navigate} post={post} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function PostMeta({
  activeTab,
  onNavigate,
  post
}: {
  activeTab: BlogTab;
  onNavigate: (href: string) => void;
  post: BlogExplorerPost;
}) {
  return (
    <div className={styles.postMeta}>
      {post.selected ? (
        <>
          <span className={`${styles.metaBadge} ${styles.selectedBadge}`}>Selected</span>
          {post.tags.length > 0 ? (
            <span aria-hidden="true" className={styles.metaSeparator}>
              |
            </span>
          ) : null}
        </>
      ) : null}

      {post.tags.length > 0 ? (
        <span aria-label="Tags" className={styles.tagList} role="group">
          {post.tags.map((tag) => {
            const slug = normalizeTagSlug(tag);
            const href = buildBlogHref(activeTab, [slug]);

            return (
              <Link
                className={styles.postTag}
                href={href}
                key={slug}
                onClick={(event) => {
                  if (isModifiedClick(event)) return;
                  event.preventDefault();
                  onNavigate(href);
                }}
                prefetch={false}
                scroll={false}
              >
                {tag}
              </Link>
            );
          })}
        </span>
      ) : null}
    </div>
  );
}

function resolveFilters(params: URLSearchParams, validTagSlugs: Set<string>): BlogFilters {
  const tab = params.get("tab") === "selected" ? "selected" : "all";
  const activeTags = Array.from(
    new Set(
      params
        .getAll("tag")
        .map((tag) => normalizeTagSlug(tag))
        .filter((tag) => tag.length > 0 && validTagSlugs.has(tag))
    )
  );

  return {
    activeTab: tab,
    activeTags
  };
}

function filterPosts(
  posts: BlogExplorerPost[],
  activeTab: BlogTab,
  activeTags: string[]
): BlogExplorerPost[] {
  const basePosts = activeTab === "selected" ? posts.filter((post) => post.selected) : posts;

  if (activeTags.length === 0) {
    return basePosts;
  }

  return basePosts.filter((post) =>
    activeTags.every((tagSlug) =>
      post.tags.some((postTag) => normalizeTagSlug(postTag) === tagSlug)
    )
  );
}

function buildBlogHref(tab: BlogTab, tags: string[]): string {
  const params = new URLSearchParams({ tab });

  for (const tag of tags) {
    params.append("tag", tag);
  }

  return `/blog?${params.toString()}`;
}

function normalizeTagSlug(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function isModifiedClick(event: MouseEvent<HTMLAnchorElement>): boolean {
  return event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
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
