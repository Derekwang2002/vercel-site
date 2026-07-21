import React, { type ReactNode } from "react";
import type { BoardDocument } from "../../../../lib/share-board/types";
import { HTML_SANDBOX_PERMISSIONS } from "../../../../lib/share-board/validation";

export type SharedDocumentClassNames = {
  downloadLink: string;
  fileName: string;
  htmlDocument: string;
  markdownDocument: string;
  markdownViewport: string;
  sharePage: string;
  viewerToolbar: string;
};

type SharedDocumentContentProps = {
  classNames: SharedDocumentClassNames;
  document: BoardDocument;
  markdown: ReactNode;
  token: string;
};

export function SharedDocumentContent({
  classNames,
  document,
  markdown,
  token
}: SharedDocumentContentProps) {
  return (
    <main className={classNames.sharePage}>
      <div className={classNames.viewerToolbar}>
        <span className={classNames.fileName} title={document.fileName}>
          {document.fileName}
        </span>
        <a
          className={classNames.downloadLink}
          download={document.fileName}
          href={`/share/${encodeURIComponent(token)}/download`}
        >
          <span aria-hidden="true">↓</span> 下载文件
        </a>
      </div>

      {document.kind === "html" ? (
        <iframe
          className={classNames.htmlDocument}
          referrerPolicy="no-referrer"
          sandbox={HTML_SANDBOX_PERMISSIONS}
          srcDoc={document.content}
          title={document.title}
        />
      ) : (
        <div className={classNames.markdownViewport}>
          <article className={classNames.markdownDocument}>{markdown}</article>
        </div>
      )}
    </main>
  );
}
