import type { Metadata } from "next";
import Link from "next/link";
import { getShareBoardService } from "../../../lib/share-board/runtime";
import { requireBoardOwner } from "../../../lib/share-board/session";
import { logoutAction } from "./actions";
import { BoardDocumentLink } from "./navigation";
import { UploadForm } from "./upload-form";
import styles from "./board.module.css";

export const metadata: Metadata = {
  title: "Share Board",
  robots: { index: false, follow: false }
};

export const dynamic = "force-dynamic";

export default async function BoardPage() {
  await requireBoardOwner();
  const documents = await getShareBoardService().listDocuments();

  return (
    <main className={styles.boardPage}>
      <header className={styles.boardHeader}>
        <div>
          <p className={styles.eyebrow}>PRIVATE DESK / {String(documents.length).padStart(2, "0")}</p>
          <h1 className={styles.displayTitle}>Share Board</h1>
          <p className={styles.lede}>你的私人文件架。每个链接只打开一个文件。</p>
        </div>
        <div className={styles.headerActions}>
          <Link className={styles.textButton} href="/private">查看 Private Repo</Link>
          <form action={logoutAction}>
            <button className={styles.textButton} type="submit">退出</button>
          </form>
        </div>
      </header>

      <section aria-labelledby="upload-heading" className={styles.section}>
        <div className={styles.sectionHeading}>
          <span className={styles.sectionNumber}>01</span>
          <h2 id="upload-heading">上传文件</h2>
        </div>
        <UploadForm />
      </section>

      <section aria-labelledby="documents-heading" className={styles.section}>
        <div className={styles.sectionHeading}>
          <span className={styles.sectionNumber}>02</span>
          <h2 id="documents-heading">文件清单</h2>
        </div>
        {documents.length ? (
          <ol className={styles.documentList}>
            {documents.map((document, index) => (
              <li className={styles.documentRow} key={document.id}>
                <span className={styles.rowIndex}>{String(index + 1).padStart(2, "0")}</span>
                <div className={styles.documentIdentity}>
                  <BoardDocumentLink className={styles.documentLink} documentId={document.id}>
                    {document.title}
                  </BoardDocumentLink>
                  <span className={styles.fileName}>{document.fileName}</span>
                </div>
                <span className={styles.kindStamp}>{document.kind === "markdown" ? "MD" : "HTML"}</span>
                <span className={styles.documentMeta}>{formatBytes(document.sizeBytes)}</span>
                <time className={styles.documentMeta} dateTime={document.updatedAt.toISOString()}>
                  {formatDate(document.updatedAt)}
                </time>
              </li>
            ))}
          </ol>
        ) : (
          <p className={styles.emptyState}>白板还是空的。上传第一个文件后，它会出现在这里。</p>
        )}
      </section>
    </main>
  );
}

function formatBytes(bytes: number): string {
  return bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`;
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}
