import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getMarkdownHeadings, renderMarkdown } from "@/components/markdown-renderer";
import { PostBodyLayout } from "@/components/post-body-layout";
import { getPublicResourceByHref } from "../../../../../../lib/resources";
import { getAllSkillDocSlugs, getSkillDocBySlug } from "../../../../../../lib/skill-docs";
import styles from "../../../../blog/[slug]/page.module.css";

type Props = { params: Promise<{ slug: string }> };
export const dynamicParams = false;
export async function generateStaticParams() { return (await getAllSkillDocSlugs()).map((slug) => ({ slug })); }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const slug = (await params).slug;
  const resource = await getPublicResourceByHref(`/hub/skills/${slug}`);
  const doc = await getSkillDocBySlug(slug, "zh");
  return resource && doc
    ? { title: resource.title, description: resource.description, alternates: { canonical: `/zh/hub/skills/${slug}`, languages: { en: `/hub/skills/${slug}`, "zh-CN": `/zh/hub/skills/${slug}` } } }
    : { title: "Skill 未找到" };
}

export default async function ChineseSkillPage({ params }: Props) {
  const slug = (await params).slug;
  const resource = await getPublicResourceByHref(`/hub/skills/${slug}`);
  const doc = await getSkillDocBySlug(slug, "zh");
  if (!resource || !doc) notFound();
  const tocItems = getMarkdownHeadings(doc.content);
  const renderedContent = await renderMarkdown(doc.content, tocItems);
  return (
    <main className={styles.postPage} lang="zh-CN">
      <p className={styles.backWrap}><Link className={styles.backLink} href="/zh/hub/skills">返回 Skills</Link></p>
      <header className={styles.header}>
        <h1 className={styles.title}>{resource.title}</h1>
        {resource.date ? <time className={styles.date} dateTime={resource.date}>{new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${resource.date}T00:00:00.000Z`))}</time> : null}
        <ul className={styles.tags}>{resource.tags.map((tag) => <li key={tag}><span className={styles.tagLink}>{tag}</span></li>)}</ul>
      </header>
      <PostBodyLayout articleTitle={resource.title} locale="zh" tocItems={tocItems}>{renderedContent}</PostBodyLayout>
    </main>
  );
}
