import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getMarkdownHeadings, renderMarkdown } from "@/components/markdown-renderer";
import { getShareBoardService } from "../../../../lib/share-board/runtime";
import { requireBoardOwner } from "../../../../lib/share-board/session";
import { HTML_SANDBOX_PERMISSIONS } from "../../../../lib/share-board/validation";
import { revokeShareAction } from "../actions";
import { BoardBackLink } from "../navigation";
import styles from "../board.module.css";
import { DeleteDocumentForm } from "./delete-document-form";
import { ReplaceDocumentForm } from "./replace-document-form";
import { ShareCreator } from "./share-creator";

export const metadata: Metadata = {
  title: "Manage Document",
  robots: { index: false, follow: false }
};

export const dynamic = "force-dynamic";

type DocumentPageProps = {
  params: Promise<{ documentId: string }>;
};

export default async function DocumentPage({ params }: DocumentPageProps) {
  await requireBoardOwner();
  const { documentId } = await params;
  const service = getShareBoardService();
  const document = await service.getDocument(documentId);
  if (!document) notFound();

  const shares = await service.listShares(documentId);
  const markdown = document.kind === "markdown"
    ? await renderMarkdown(document.content, getMarkdownHeadings(document.content))
    : null;

  return (
    <main className={styles.boardPage}>
      <p className={styles.backLine}>
        <BoardBackLink />
      </p>
      <header className={styles.documentHeader}>
        <div>
          <p className={styles.eyebrow}>{document.kind.toUpperCase()} / {formatBytes(document.sizeBytes)}</p>
          <h1 className={styles.displayTitle}>{document.title}</h1>
          <p className={styles.fileName}>{document.fileName}</p>
        </div>
        <DeleteDocumentForm documentId={document.id} />
      </header>

      <section aria-labelledby="replace-heading" className={styles.section}>
        <div className={styles.sectionHeading}>
          <span className={styles.sectionNumber}>01</span>
          <h2 id="replace-heading">更新文件</h2>
        </div>
        <ReplaceDocumentForm documentId={document.id} title={document.title} />
      </section>

      <section aria-labelledby="share-heading" className={styles.section}>
        <div className={styles.sectionHeading}>
          <span className={styles.sectionNumber}>02</span>
          <h2 id="share-heading">分享权限</h2>
        </div>
        <ShareCreator documentId={document.id} />
        {shares.length ? (
          <ul className={styles.shareList}>
            {shares.map((share) => {
              const status = getShareStatus(share);
              return (
                <li className={styles.shareRow} key={share.id}>
                  <span className={`${styles.statusDot} ${styles[`status${status.label}`]}`} aria-hidden="true" />
                  <div>
                    <strong>{status.text}</strong>
                    <p className={styles.shareMeta}>
                      创建于 {formatDateTime(share.createdAt)}
                      {share.expiresAt ? ` · 到期于 ${formatDateTime(share.expiresAt)}` : " · 无自动到期"}
                    </p>
                  </div>
                  {status.label === "Active" ? (
                    <form action={revokeShareAction}>
                      <input name="documentId" type="hidden" value={document.id} />
                      <input name="shareId" type="hidden" value={share.id} />
                      <button className={styles.textButton} type="submit">撤销</button>
                    </form>
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className={styles.emptyState}>还没有分享链接。</p>
        )}
      </section>

      <section aria-labelledby="preview-heading" className={styles.section}>
        <div className={styles.sectionHeading}>
          <span className={styles.sectionNumber}>03</span>
          <h2 id="preview-heading">私有预览</h2>
        </div>
        {document.kind === "html" ? (
          <iframe
            className={styles.htmlPreview}
            referrerPolicy="no-referrer"
            sandbox={HTML_SANDBOX_PERMISSIONS}
            srcDoc={document.content}
            title={`${document.title} preview`}
          />
        ) : (
          <article className={styles.markdownPreview}>{markdown}</article>
        )}
      </section>
    </main>
  );
}

function getShareStatus(share: { expiresAt: Date | null; revokedAt: Date | null }) {
  if (share.revokedAt) return { label: "Revoked", text: "已撤销" } as const;
  if (share.expiresAt && share.expiresAt.getTime() <= Date.now()) {
    return { label: "Expired", text: "已过期" } as const;
  }
  return { label: "Active", text: "有效" } as const;
}

function formatBytes(bytes: number): string {
  return bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`;
}

function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}
