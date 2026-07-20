import type { JSX } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getMarkdownHeadings, renderMarkdown } from "@/components/markdown-renderer";
import { PostBodyLayout } from "@/components/post-body-layout";
import {
  PostSeriesPager,
  type PostSeriesPagerLink
} from "@/components/post-series-pager";
import { formatContentDate } from "../../lib/locale";
import { getLocalizedPostBySlug } from "../../lib/localized-posts";
import { normalizeTagSlug } from "../../lib/posts";
import {
  getPostSeriesDefinition,
  getPostSeriesDocument,
  getPostSeriesDocuments,
  toPostSeriesNavigation,
  type PostSeriesLocale
} from "../../lib/post-series";
import styles from "../app/blog/[slug]/page.module.css";

const SITE_URL = (() => {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim() || "http://localhost:3000";
  return raw.endsWith("/") ? raw.slice(0, -1) : raw;
})();

type PostSeriesDocumentPageProps = {
  docSlug: string;
  locale: PostSeriesLocale;
  seriesSlug: string;
};

export async function PostSeriesDocumentPage({
  docSlug,
  locale,
  seriesSlug
}: PostSeriesDocumentPageProps): Promise<JSX.Element> {
  const definition = getPostSeriesDefinition(seriesSlug);
  const documents = definition
    ? await getPostSeriesDocuments(seriesSlug, locale)
    : [];
  const documentIndex = documents.findIndex((candidate) => candidate.slug === docSlug);
  const document = documents[documentIndex];

  if (!definition || !document) {
    notFound();
  }

  const parentPost = await getLocalizedPostBySlug(definition.parentPostSlug, locale);
  if (!parentPost) {
    notFound();
  }

  const localePrefix = locale === "zh" ? "/zh" : "";
  const blogHref = `${localePrefix}/blog`;
  const localizedParentHref = `${blogHref}/${definition.parentPostSlug}`;
  const previous = documents[documentIndex - 1] ?? null;
  const next = documents[documentIndex + 1] ?? null;
  const previousLink: PostSeriesPagerLink = previous
    ? toPagerLink(previous.slug, previous.title)
    : { href: localizedParentHref, label: parentPost.title };
  const nextLink = next ? toPagerLink(next.slug, next.title) : null;
  const seriesNavigation = toPostSeriesNavigation({
    currentSlug: docSlug,
    documents,
    label: locale === "zh" ? "系列导航" : "Series navigation",
    locale,
    parentHref: localizedParentHref,
    parentTitle: parentPost.title,
    seriesSlug
  });
  const tocItems = getMarkdownHeadings(document.content);
  const renderedContent = await renderMarkdown(document.content, tocItems);

  function toPagerLink(slug: string, label: string): PostSeriesPagerLink {
    return { href: `${blogHref}/${seriesSlug}/${slug}`, label };
  }

  return (
    <main className={styles.postPage} lang={locale === "zh" ? "zh-CN" : "en"}>
      <nav aria-label={locale === "zh" ? "面包屑" : "Breadcrumb"} className={styles.seriesBreadcrumbs}>
        <Link href={blogHref}>Blog</Link>
        <span aria-hidden="true">/</span>
        <Link href={localizedParentHref}>{parentPost.title}</Link>
      </nav>

      <header className={styles.header}>
        <p className={styles.seriesKicker}>
          {locale === "zh"
            ? `CALL-E Agentic Goal · 第 ${document.order} 篇`
            : `CALL-E Agentic Goal · Part ${document.order}`}
        </p>
        <h1 className={styles.title}>{document.title}</h1>
        <time className={styles.date} dateTime={parentPost.date}>
          {formatContentDate(parentPost.date, locale)}
        </time>
        <ul className={styles.tags}>
          {parentPost.tags.map((tag) => (
            <li key={tag}>
              <Link
                className={styles.tagLink}
                href={`${blogHref}?tag=${normalizeTagSlug(tag)}`}
              >
                {tag}
              </Link>
            </li>
          ))}
        </ul>
      </header>

      <PostBodyLayout
        articleTitle={document.title}
        locale={locale}
        seriesNavigation={seriesNavigation}
        tocItems={tocItems}
      >
        {renderedContent}
      </PostBodyLayout>
      <PostSeriesPager locale={locale} next={nextLink} previous={previousLink} />
    </main>
  );
}

export async function getPostSeriesDocumentMetadata({
  docSlug,
  locale,
  seriesSlug
}: PostSeriesDocumentPageProps): Promise<Metadata> {
  const definition = getPostSeriesDefinition(seriesSlug);
  const document = await getPostSeriesDocument(seriesSlug, docSlug, locale);

  if (!definition || !document) {
    notFound();
  }

  const parentPost = await getLocalizedPostBySlug(definition.parentPostSlug, locale);
  if (!parentPost) {
    notFound();
  }

  const localePrefix = locale === "zh" ? "/zh" : "";
  const pathname = `${localePrefix}/blog/${seriesSlug}/${docSlug}`;

  return {
    title: document.title,
    description: document.summary,
    alternates: {
      canonical: pathname,
      languages: {
        en: `/blog/${seriesSlug}/${docSlug}`,
        "zh-CN": `/zh/blog/${seriesSlug}/${docSlug}`
      }
    },
    openGraph: {
      type: "article",
      title: document.title,
      description: document.summary,
      url: `${SITE_URL}${pathname}`,
      images: [
        {
          url: "/og-default.svg",
          width: 1200,
          height: 630,
          alt: `${document.title} Open Graph Image`
        }
      ],
      publishedTime: `${parentPost.date}T00:00:00.000Z`
    }
  };
}
