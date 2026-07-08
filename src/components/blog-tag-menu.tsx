"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { ComponentProps, MouseEvent } from "react";
import type { BlogTab } from "./blog-tabs";
import styles from "./blog-tag-menu.module.css";

type BlogTag = {
  count: number;
  slug: string;
  tag: string;
};

export type { BlogTag };

type BlogTagMenuProps = {
  activeTab: BlogTab;
  onNavigate?: (href: string) => void;
  selectedTags: string[];
  tags: BlogTag[];
};

export function BlogTagMenu({ activeTab, onNavigate, selectedTags, tags }: BlogTagMenuProps) {
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
        <span
          aria-hidden={selectedTags.length === 0 ? "true" : undefined}
          className={selectedTags.length > 0 ? styles.count : `${styles.count} ${styles.countEmpty}`}
        >
          {selectedTags.length > 0 ? selectedTags.length : 0}
        </span>
      </button>

      {open ? (
        <section aria-label="Tag picker" className={styles.panel}>
          <div className={styles.panelHeader}>
            <span className={styles.panelTitle}>Filter tags</span>
            {selectedTags.length > 0 ? (
              <FilterLink
                className={styles.clear}
                href={buildBlogHref(activeTab, [])}
                onFilterNavigate={onNavigate}
                prefetch={false}
              >
                Clear
              </FilterLink>
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
              const href = buildBlogHref(activeTab, toggleTag(selectedTags, tag.slug));

              return (
                <FilterLink
                  aria-current={selected ? "true" : undefined}
                  className={selected ? `${styles.link} ${styles.active}` : styles.link}
                  href={href}
                  key={tag.slug}
                  onFilterNavigate={onNavigate}
                  prefetch={false}
                  scroll={false}
                >
                  <span>{tag.tag}</span>
                  <span className={styles.tagCount}>{tag.count}</span>
                </FilterLink>
              );
            })}
          </div>

          {visibleTags.length === 0 ? <p className={styles.empty}>No tags found.</p> : null}
        </section>
      ) : null}
    </div>
  );
}

function FilterLink({
  children,
  href,
  onFilterNavigate,
  ...props
}: ComponentProps<typeof Link> & {
  href: string;
  onFilterNavigate?: (href: string) => void;
}) {
  return (
    <Link
      {...props}
      href={href}
      onClick={(event) => {
        props.onClick?.(event);
        if (event.defaultPrevented || !onFilterNavigate || isModifiedClick(event)) return;
        event.preventDefault();
        onFilterNavigate(href);
      }}
    >
      {children}
    </Link>
  );
}

function isModifiedClick(event: MouseEvent<HTMLAnchorElement>): boolean {
  return event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
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
