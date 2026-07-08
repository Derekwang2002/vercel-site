"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { BlogTab } from "./blog-tabs";
import styles from "./blog-tag-menu.module.css";

type BlogTag = {
  count: number;
  slug: string;
  tag: string;
};

type BlogTagMenuProps = {
  activeTab: BlogTab;
  selectedTags: string[];
  tags: BlogTag[];
};

export function BlogTagMenu({ activeTab, selectedTags, tags }: BlogTagMenuProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const selectedTagSet = new Set(selectedTags);
  const visibleTags = tags.filter((tag) =>
    tag.tag.toLowerCase().includes(query.trim().toLowerCase())
  );

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  if (tags.length === 0) {
    return null;
  }

  return (
    <div className={styles.menu} ref={rootRef}>
      <button
        aria-expanded={open}
        className={styles.trigger}
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        <span>Tags</span>
        {selectedTags.length > 0 ? <span className={styles.count}>{selectedTags.length}</span> : null}
      </button>

      {open ? (
        <section aria-label="Tag picker" className={styles.panel}>
          <div className={styles.panelHeader}>
            <span className={styles.panelTitle}>Filter tags</span>
            {selectedTags.length > 0 ? (
              <Link className={styles.clear} href={buildBlogHref(activeTab, [])} scroll={false}>
                Clear
              </Link>
            ) : (
              <span aria-hidden="true" className={styles.clearPlaceholder}>
                Clear
              </span>
            )}
          </div>

          <input
            className={styles.search}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search tags"
            type="search"
            value={query}
          />

          <div aria-live="polite" className={styles.selectedList}>
            {selectedTags.map((selectedTag) => {
              const tag = tags.find((item) => item.slug === selectedTag);
              return tag ? (
                <span className={styles.chip} key={selectedTag}>
                  {tag.tag}
                </span>
              ) : null;
            })}
          </div>

          <div className={styles.list}>
            {visibleTags.map((tag) => {
              const selected = selectedTagSet.has(tag.slug);
              return (
                <Link
                  aria-current={selected ? "true" : undefined}
                  className={selected ? `${styles.link} ${styles.active}` : styles.link}
                  href={buildBlogHref(activeTab, toggleTag(selectedTags, tag.slug))}
                  key={tag.slug}
                  scroll={false}
                >
                  <span>{tag.tag}</span>
                  <span className={styles.tagCount}>{tag.count}</span>
                </Link>
              );
            })}
          </div>

          {visibleTags.length === 0 ? <p className={styles.empty}>No tags found.</p> : null}
        </section>
      ) : null}
    </div>
  );
}

function toggleTag(selectedTags: string[], tag: string): string[] {
  if (selectedTags.includes(tag)) {
    return selectedTags.filter((selectedTag) => selectedTag !== tag);
  }

  return [...selectedTags, tag];
}

function buildBlogHref(tab: BlogTab, tags: string[]): string {
  const params = new URLSearchParams({ tab });

  for (const tag of tags) {
    params.append("tag", tag);
  }

  return `/blog?${params.toString()}`;
}
