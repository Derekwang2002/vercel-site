"use client";

import { useEffect, useRef } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import Link from "next/link";
import type { PostSeriesLocale, PostSeriesNavigation } from "../../lib/post-series";
import styles from "../app/blog/[slug]/page.module.css";

export type TocItem = {
  id: string;
  level: number;
  text: string;
};

type PostTocProps = {
  activeId: string;
  articleTitle: string;
  items: TocItem[];
  locale?: PostSeriesLocale;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  overlay: boolean;
  seriesNavigation?: PostSeriesNavigation;
};

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function PostToc({
  activeId,
  articleTitle,
  items,
  locale = "en",
  onOpenChange,
  open,
  overlay,
  seriesNavigation
}: PostTocProps) {
  const contentsRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const hasContents = items.length > 0 || Boolean(seriesNavigation?.items.length);

  useEffect(() => {
    if (!open || !activeId) {
      return;
    }

    const animationFrame = window.requestAnimationFrame(() => {
      const contents = contentsRef.current;

      if (!contents) {
        return;
      }

      const activeLink = Array.from(
        contents.querySelectorAll<HTMLAnchorElement>("a[data-toc-id]")
      ).find((link) => link.dataset.tocId === activeId);

      if (!activeLink) {
        return;
      }

      const contentsRect = contents.getBoundingClientRect();
      const linkRect = activeLink.getBoundingClientRect();
      const inset = 8;

      if (linkRect.top < contentsRect.top + inset) {
        contents.scrollTop -= contentsRect.top + inset - linkRect.top;
      } else if (linkRect.bottom > contentsRect.bottom - inset) {
        contents.scrollTop += linkRect.bottom - (contentsRect.bottom - inset);
      }
    });

    return () => window.cancelAnimationFrame(animationFrame);
  }, [activeId, open]);

  useEffect(() => {
    if (!hasContents || !open || !overlay) {
      return;
    }

    const body = document.body;
    const root = document.documentElement;
    const previousOverflow = body.style.overflow;
    const previousPaddingRight = body.style.paddingRight;
    const previousRootOverflow = root.style.overflow;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    const computedPaddingRight = Number.parseFloat(window.getComputedStyle(body).paddingRight) || 0;

    body.style.overflow = "hidden";
    root.style.overflow = "hidden";

    if (scrollbarWidth > 0) {
      body.style.paddingRight = `${computedPaddingRight + scrollbarWidth}px`;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onOpenChange(false);
        window.requestAnimationFrame(() => toggleRef.current?.focus({ preventScroll: true }));
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const panel = panelRef.current;

      if (!panel) {
        return;
      }

      const focusableElements = Array.from(
        panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
      ).filter((element) => !element.hasAttribute("disabled") && element.offsetParent !== null);

      if (focusableElements.length === 0) {
        event.preventDefault();
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    window.requestAnimationFrame(() => toggleRef.current?.focus({ preventScroll: true }));

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      body.style.overflow = previousOverflow;
      body.style.paddingRight = previousPaddingRight;
      root.style.overflow = previousRootOverflow;
    };
  }, [hasContents, onOpenChange, open, overlay]);

  if (!hasContents) {
    return null;
  }

  const panelClassName = [
    styles.toc,
    open ? styles.tocOpen : styles.tocCollapsed,
    open && overlay ? styles.tocOverlay : ""
  ]
    .filter(Boolean)
    .join(" ");

  const toggleLabel = locale === "zh"
    ? open ? "收起目录" : "展开目录"
    : open ? "Collapse contents" : "Expand contents";
  const closeLabel = locale === "zh" ? "关闭文章目录" : "Close article contents";
  const contentsLabel = locale === "zh" ? "文章目录" : "Article table of contents";

  function closeAndRestoreFocus() {
    onOpenChange(false);
    window.requestAnimationFrame(() => toggleRef.current?.focus({ preventScroll: true }));
  }

  function handleNavigate(event: ReactMouseEvent<HTMLAnchorElement>, itemId: string) {
    if (
      !overlay ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }

    onOpenChange(false);

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        const target = document.getElementById(itemId);

        if (!target) {
          return;
        }

        const previousTabIndex = target.getAttribute("tabindex");

        if (previousTabIndex === null) {
          target.setAttribute("tabindex", "-1");
        }

        target.focus({ preventScroll: true });

        if (previousTabIndex === null) {
          target.addEventListener(
            "blur",
            () => {
              target.removeAttribute("tabindex");
            },
            { once: true }
          );
        }
      });
    });
  }

  return (
    <div className={styles.tocShell}>
      {overlay ? (
        <button
          aria-hidden={!open}
          aria-label={closeLabel}
          className={`${styles.tocBackdrop} ${open ? styles.tocBackdropVisible : ""}`}
          onClick={closeAndRestoreFocus}
          tabIndex={-1}
          type="button"
        />
      ) : null}

      <aside
        aria-label={contentsLabel}
        aria-modal={open && overlay ? true : undefined}
        className={panelClassName}
        ref={panelRef}
        role={open && overlay ? "dialog" : undefined}
      >
        <div className={styles.tocHeader}>
          <button
            aria-controls="post-toc-list"
            aria-expanded={open}
            aria-label={toggleLabel}
            className={styles.tocToggle}
            onClick={() => onOpenChange(!open)}
            ref={toggleRef}
            type="button"
          >
            <span aria-hidden="true" className={styles.tocToggleIcon}>
              <TocToggleIcon open={open} />
            </span>
            <span aria-hidden="true" className={styles.tocToggleLabel}>
              {toggleLabel}
            </span>
          </button>

          <p className={styles.tocTitle} title={articleTitle}>
            {articleTitle}
          </p>
        </div>

        <div
          aria-hidden={!open}
          className={styles.tocContents}
          hidden={!open}
          id="post-toc-list"
          ref={contentsRef}
        >
          {seriesNavigation ? (
            <nav aria-label={seriesNavigation.label} className={styles.seriesNav}>
              <p className={styles.tocGroupLabel}>{seriesNavigation.label}</p>
              <ol className={styles.seriesList}>
                {seriesNavigation.items.map((item) => (
                  <li className={item.current ? styles.seriesCurrent : undefined} key={item.href}>
                    <Link aria-current={item.current ? "page" : undefined} href={item.href}>
                      <span aria-hidden="true">{item.order}</span>
                      <span>{item.label}</span>
                    </Link>
                  </li>
                ))}
              </ol>
            </nav>
          ) : null}
          <p className={styles.tocGroupLabel}>
            {locale === "zh" ? "本页目录" : "On this page"}
          </p>
          <ol className={styles.tocList}>
            {items.map((item) => {
              const active = item.id === activeId;
              const levelClassName = styles[`tocLevel${Math.min(item.level, 4)}`];

              return (
                <li
                  className={`${levelClassName} ${active ? styles.tocItemActive : ""}`}
                  key={item.id}
                >
                  <a
                    aria-current={active ? "location" : undefined}
                    data-toc-id={item.id}
                    href={`#${item.id}`}
                    onClick={(event) => handleNavigate(event, item.id)}
                    title={item.text}
                  >
                    {item.text}
                  </a>
                </li>
              );
            })}
          </ol>
        </div>
      </aside>
    </div>
  );
}

function TocToggleIcon({ open }: { open: boolean }) {
  if (open) {
    return (
      <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
        <path
          d="m12.5 5-5 7 5 7M18.5 5l-5 7 5 7"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.8"
        />
      </svg>
    );
  }

  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
      <path
        d="M4 6h16M4 12h12M4 18h8"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}
