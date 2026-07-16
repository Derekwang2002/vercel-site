import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getMarkdownHeadings, renderMarkdown } from "@/components/markdown-renderer";
import { PostBodyLayout } from "@/components/post-body-layout";
import { formatContentDate } from "../../../../../lib/locale";
import { getAllPosts, normalizeTagSlug } from "../../../../../lib/posts";
import { getLocalizedPostBySlug } from "../../../../../lib/localized-posts";
import styles from "../../../blog/[slug]/page.module.css";

type Props = { params: Promise<{ slug: string }> };

export const dynamicParams = false;

export async function generateStaticParams() {
  return (await getAllPosts()).map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const post = await getLocalizedPostBySlug((await params).slug, "zh");
  return post
    ? { title: post.title, description: post.summary, alternates: { canonical: `/zh/blog/${post.slug}` } }
    : { title: "文章未找到" };
}

export default async function ChineseBlogPostPage({ params }: Props) {
  const post = await getLocalizedPostBySlug((await params).slug, "zh");
  if (!post) notFound();
  const tocItems = getMarkdownHeadings(post.content);
  const renderedContent = await renderMarkdown(post.content, tocItems);

  return (
    <main className={styles.postPage} lang="zh-CN">
      <p className={styles.backWrap}><Link className={styles.backLink} href="/zh/blog">返回 Blog</Link></p>
      <header className={styles.header}>
        <h1 className={styles.title}>{post.title}</h1>
        <time className={styles.date} dateTime={post.date}>{formatContentDate(post.date, "zh")}</time>
        <ul className={styles.tags}>{post.tags.map((tag) => <li key={tag}><Link className={styles.tagLink} href={`/zh/blog?tag=${normalizeTagSlug(tag)}`}>{tag}</Link></li>)}</ul>
      </header>
      <PostBodyLayout articleTitle={post.title} tocItems={tocItems}>{renderedContent}</PostBodyLayout>
    </main>
  );
}
