import type { Metadata } from "next";
import { getShareBoardService } from "../../../lib/share-board/runtime";
import { isPrivateRepoReader } from "../../../lib/share-board/session";
import { privateRepoLogoutAction } from "./actions";
import { PrivateRepoLoginForm } from "./login-form";
import { PrivateDocumentLink } from "./navigation";
import styles from "./private.module.css";

export const metadata: Metadata = {
  title: "Private Repo",
  robots: { index: false, follow: false, nocache: true }
};

export const dynamic = "force-dynamic";

export default async function PrivateRepoPage() {
  if (!(await isPrivateRepoReader())) {
    return (
      <main className={styles.loginPage}>
        <section className={styles.loginPanel}>
          <p className={styles.eyebrow}>RESTRICTED SHELF / AUTH</p>
          <h1 className={styles.displayTitle}>Private Repo</h1>
          <p className={styles.lede}>
            这里保存不公开发布的 Markdown 与 HTML 文件。请输入阅读密码继续。
          </p>
          <PrivateRepoLoginForm />
        </section>
      </main>
    );
  }

  const documents = await getShareBoardService().listDocuments();

  return (
    <main className={styles.repoPage}>
      <header className={styles.repoHeader}>
        <div>
          <p className={styles.eyebrow}>
            RESTRICTED SHELF / {String(documents.length).padStart(2, "0")}
          </p>
          <h1 className={styles.displayTitle}>Private Repo</h1>
          <p className={styles.lede}>只对持有阅读密码的人开放的私人文件库。</p>
        </div>
        <form action={privateRepoLogoutAction}>
          <button className={styles.textButton} type="submit">退出私有库</button>
        </form>
      </header>

      <section aria-labelledby="private-documents-heading" className={styles.catalogue}>
        <div className={styles.sectionHeading}>
          <span>INDEX</span>
          <h2 id="private-documents-heading">文件目录</h2>
        </div>
        {documents.length ? (
          <ol className={styles.documentList}>
            {documents.map((document, index) => (
              <li className={styles.documentRow} key={document.id}>
                <span className={styles.rowIndex}>
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div className={styles.documentIdentity}>
                  <PrivateDocumentLink
                    className={styles.documentLink}
                    documentId={document.id}
                  >
                    {document.title}
                  </PrivateDocumentLink>
                  <span className={styles.fileName}>{document.fileName}</span>
                </div>
                <span className={styles.kindStamp}>
                  {document.kind === "markdown" ? "MD" : "HTML"}
                </span>
                <span className={styles.documentMeta}>{formatBytes(document.sizeBytes)}</span>
                <time
                  className={styles.documentMeta}
                  dateTime={document.updatedAt.toISOString()}
                >
                  {formatDate(document.updatedAt)}
                </time>
              </li>
            ))}
          </ol>
        ) : (
          <p className={styles.emptyState}>Private Repo 目前没有文件。</p>
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
