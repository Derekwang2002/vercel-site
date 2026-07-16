import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getMarkdownHeadings, renderMarkdown } from "@/components/markdown-renderer";
import { PostBodyLayout } from "@/components/post-body-layout";
import { getPublicResourceByHref } from "../../../../../lib/resources";
import { getAllSkillDocSlugs, getSkillDocBySlug } from "../../../../../lib/skill-docs";
import styles from "../../../blog/[slug]/page.module.css";
import { localizeResource } from "../../../../../lib/localized-resources";

const DEFAULT_OG_IMAGE = "/og-default.svg";

type SkillPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export const dynamicParams = false;

export async function generateStaticParams(): Promise<Array<{ slug: string }>> {
  const slugs = await getAllSkillDocSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: SkillPageProps): Promise<Metadata> {
  const { slug } = await params;
  const href = getSkillHref(slug);
  const rawResource = await getPublicResourceByHref(href);
  const resource = rawResource ? localizeResource(rawResource, "en") : undefined;
  const doc = await getSkillDocBySlug(slug, "en");

  if (!resource || !doc) {
    return {
      title: "Skill Not Found",
      description: "The requested skill article could not be found."
    };
  }

  return {
    title: resource.title,
    description: resource.description,
    alternates: {
      canonical: href,
      languages: { en: href, "zh-CN": `/zh${href}` }
    },
    openGraph: {
      type: "article",
      title: resource.title,
      description: resource.description,
      url: href,
      images: [
        {
          url: DEFAULT_OG_IMAGE,
          width: 1200,
          height: 630,
          alt: `${resource.title} Open Graph Image`
        }
      ],
      publishedTime: resource.date ? `${resource.date}T00:00:00.000Z` : undefined
    }
  };
}

export default async function SkillPage({ params }: SkillPageProps) {
  const { slug } = await params;
  const href = getSkillHref(slug);
  const rawResource = await getPublicResourceByHref(href);
  const resource = rawResource ? localizeResource(rawResource, "en") : undefined;
  const doc = await getSkillDocBySlug(slug, "en");

  if (!resource || !doc) {
    notFound();
  }

  const tocItems = getMarkdownHeadings(doc.content);
  const renderedContent = await renderMarkdown(doc.content, tocItems);

  return (
    <main className={styles.postPage}>
      <p className={styles.backWrap}>
        <Link className={styles.backLink} href="/hub/skills">
          Back to Skills
        </Link>
      </p>

      <header className={styles.header}>
        <h1 className={styles.title}>{resource.title}</h1>
        {resource.date ? (
          <time className={styles.date} dateTime={resource.date}>
            {formatDate(resource.date)}
          </time>
        ) : null}
        <ul className={styles.tags}>
          {resource.tags.map((tag) => (
            <li key={tag}>
              <span className={styles.tagLink}>{tag}</span>
            </li>
          ))}
        </ul>
      </header>

      <PostBodyLayout articleTitle={resource.title} tocItems={tocItems}>
        {renderedContent}
      </PostBodyLayout>
    </main>
  );
}

function getSkillHref(slug: string): string {
  return `/hub/skills/${slug}`;
}

function formatDate(date: string): string {
  const parsed = new Date(`${date}T00:00:00.000Z`);

  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC"
  }).format(parsed);
}
