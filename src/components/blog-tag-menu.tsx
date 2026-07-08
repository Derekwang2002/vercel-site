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
  const rootRef = useRef<HTMLDivElement>(null);
  const selectedTagSet = new Set(selectedTags);

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
        <div className={styles.panel}>
          {selectedTags.length > 0 ? (
            <Link className={styles.clear} href={buildBlogHref(activeTab, [])} scroll={false}>
              Clear filter
            </Link>
          ) : null}

          <div className={styles.list}>
            {tags.map((tag) => {
              const selected = selectedTagSet.has(tag.slug);
              return (
                <Link
                  aria-current={selected ? "true" : undefined}
                  className={selected ? `${styles.link} ${styles.active}` : styles.link}
                  href={buildBlogHref(activeTab, toggleTag(selectedTags, tag.slug))}
                  key={tag.slug}
                  scroll={false}
                >
                  {tag.tag}
                </Link>
              );
            })}
          </div>
        </div>
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
