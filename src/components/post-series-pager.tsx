import Link from "next/link";
import type { PostSeriesLocale } from "../../lib/post-series";
import styles from "../app/blog/[slug]/page.module.css";

export type PostSeriesPagerLink = {
  href: string;
  label: string;
};

type PostSeriesPagerProps = {
  locale: PostSeriesLocale;
  next: PostSeriesPagerLink | null;
  previous: PostSeriesPagerLink | null;
};

export function PostSeriesPager({ locale, next, previous }: PostSeriesPagerProps) {
  if (!previous && !next) {
    return null;
  }

  return (
    <nav aria-label={locale === "zh" ? "系列翻页" : "Series pagination"} className={styles.seriesPager}>
      {previous ? (
        <Link
          aria-label={`${locale === "zh" ? "上一篇" : "Previous"}: ${previous.label}`}
          className={styles.seriesPagerLink}
          href={previous.href}
          rel="prev"
        >
          <span aria-hidden="true">←</span>
          <span>{previous.label}</span>
        </Link>
      ) : null}
      {next ? (
        <Link
          aria-label={`${locale === "zh" ? "下一篇" : "Next"}: ${next.label}`}
          className={styles.seriesPagerLinkNext}
          href={next.href}
          rel="next"
        >
          <span>{next.label}</span>
          <span aria-hidden="true">→</span>
        </Link>
      ) : null}
    </nav>
  );
}
