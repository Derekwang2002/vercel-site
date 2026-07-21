import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getMarkdownHeadings, renderMarkdown } from "@/components/markdown-renderer";
import { getShareBoardService } from "../../../../lib/share-board/runtime";
import { HTML_SANDBOX_PERMISSIONS } from "../../../../lib/share-board/validation";
import styles from "./share.module.css";

export const metadata: Metadata = {
  title: "Shared Document",
  robots: { index: false, follow: false, nocache: true }
};

export const dynamic = "force-dynamic";

type SharePageProps = {
  params: Promise<{ token: string }>;
};

export default async function SharePage({ params }: SharePageProps) {
  const { token } = await params;
  const resolved = await getShareBoardService().resolveShare(token);
  if (!resolved) notFound();

  const { document, expiresAt } = resolved;
  const markdown = document.kind === "markdown"
    ? await renderMarkdown(document.content, getMarkdownHeadings(document.content))
    : null;

  return (
    <main className={styles.sharePage}>
      <header className={styles.shareHeader}>
        <p className={styles.shareMark}>DEREK / SHARED FILE</p>
        <h1>{document.title}</h1>
        <div className={styles.fileMeta}>
          <span>{document.fileName}</span>
          <span aria-hidden="true">·</span>
          <span>{document.kind === "markdown" ? "Markdown" : "HTML"}</span>
          {expiresAt ? (
            <>
              <span aria-hidden="true">·</span>
              <span>有效期至 {formatDate(expiresAt)}</span>
            </>
          ) : null}
        </div>
      </header>

      {document.kind === "html" ? (
        <iframe
          className={styles.htmlDocument}
          referrerPolicy="no-referrer"
          sandbox={HTML_SANDBOX_PERMISSIONS}
          srcDoc={document.content}
          title={document.title}
        />
      ) : (
        <article className={styles.markdownDocument}>{markdown}</article>
      )}
    </main>
  );
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}
