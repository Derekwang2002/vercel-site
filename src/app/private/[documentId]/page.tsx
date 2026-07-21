import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getMarkdownHeadings, renderMarkdown } from "@/components/markdown-renderer";
import { getShareBoardService } from "../../../../lib/share-board/runtime";
import { requirePrivateRepoReader } from "../../../../lib/share-board/session";
import { HTML_SANDBOX_PERMISSIONS } from "../../../../lib/share-board/validation";
import {
  PrivateDocumentDownloadLink,
  PrivateRepoBackLink
} from "../navigation";
import styles from "../private.module.css";

export const metadata: Metadata = {
  title: "Private Document",
  robots: { index: false, follow: false, nocache: true }
};

export const dynamic = "force-dynamic";

type PrivateDocumentPageProps = {
  params: Promise<{ documentId: string }>;
};

export default async function PrivateDocumentPage({ params }: PrivateDocumentPageProps) {
  await requirePrivateRepoReader();
  const { documentId } = await params;
  const document = await getShareBoardService().getDocument(documentId);
  if (!document) notFound();

  const markdown = document.kind === "markdown"
    ? await renderMarkdown(document.content, getMarkdownHeadings(document.content))
    : null;

  return (
    <main className={styles.documentPage}>
      <div className={styles.viewerToolbar}>
        <span className={styles.viewerBackLink}>
          <PrivateRepoBackLink />
        </span>
        <span className={styles.viewerFileName} title={document.fileName}>
          {document.fileName}
        </span>
        <PrivateDocumentDownloadLink
          className={styles.downloadLink}
          documentId={document.id}
          fileName={document.fileName}
        />
      </div>

      {document.kind === "html" ? (
        <iframe
          className={styles.htmlDocument}
          referrerPolicy="no-referrer"
          sandbox={HTML_SANDBOX_PERMISSIONS}
          srcDoc={document.content}
          title={document.title}
        />
      ) : (
        <div className={styles.markdownViewport}>
          <article className={styles.markdownDocument}>{markdown}</article>
        </div>
      )}
    </main>
  );
}
