"use client";

import { useEffect, useState } from "react";
import type { TocItem } from "./post-toc";

function readHashId(): string {
  const hash = window.location.hash.slice(1);

  if (!hash) {
    return "";
  }

  try {
    return decodeURIComponent(hash);
  } catch {
    return hash;
  }
}

export function useActiveHeading(items: TocItem[]): string {
  const [activeId, setActiveId] = useState(items[0]?.id ?? "");

  useEffect(() => {
    if (items.length === 0) {
      setActiveId("");
      return;
    }

    const headings = items
      .map((item) => document.getElementById(item.id))
      .filter((heading): heading is HTMLElement => Boolean(heading));

    if (headings.length === 0) {
      setActiveId(items[0]?.id ?? "");
      return;
    }

    let animationFrame = 0;

    function updateFromScroll() {
      window.cancelAnimationFrame(animationFrame);
      animationFrame = window.requestAnimationFrame(() => {
        const activationLine = Math.max(96, window.innerHeight * 0.25);
        let nextId = headings[0].id;

        for (const heading of headings) {
          if (heading.getBoundingClientRect().top > activationLine) {
            break;
          }

          nextId = heading.id;
        }

        const pageBottom = window.scrollY + window.innerHeight;
        const documentBottom = document.documentElement.scrollHeight;

        if (pageBottom >= documentBottom - 2) {
          nextId = headings[headings.length - 1].id;
        }

        setActiveId((currentId) => (currentId === nextId ? currentId : nextId));
      });
    }

    function updateFromLocation() {
      const hashId = readHashId();

      if (hashId && headings.some((heading) => heading.id === hashId)) {
        setActiveId(hashId);
      }

      updateFromScroll();
    }

    const initialHashId = readHashId();

    if (initialHashId && headings.some((heading) => heading.id === initialHashId)) {
      setActiveId(initialHashId);
    } else {
      updateFromScroll();
    }

    window.addEventListener("scroll", updateFromScroll, { passive: true });
    window.addEventListener("resize", updateFromScroll);
    window.addEventListener("hashchange", updateFromLocation);
    window.addEventListener("popstate", updateFromLocation);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener("scroll", updateFromScroll);
      window.removeEventListener("resize", updateFromScroll);
      window.removeEventListener("hashchange", updateFromLocation);
      window.removeEventListener("popstate", updateFromLocation);
    };
  }, [items]);

  return activeId;
}
