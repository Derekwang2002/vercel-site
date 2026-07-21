import type { ReactNode } from "react";
import type { BoardDocument } from "../../../../lib/share-board/types";
import {
  SharedDocumentContent,
  type SharedDocumentClassNames
} from "./shared-document-content";
import styles from "./share.module.css";

const classNames: SharedDocumentClassNames = {
  downloadLink: styles.downloadLink,
  fileName: styles.fileName,
  htmlDocument: styles.htmlDocument,
  markdownDocument: styles.markdownDocument,
  markdownViewport: styles.markdownViewport,
  sharePage: styles.sharePage,
  viewerToolbar: styles.viewerToolbar
};

type SharedDocumentViewProps = {
  document: BoardDocument;
  markdown: ReactNode;
  token: string;
};

export function SharedDocumentView({
  document,
  markdown,
  token
}: SharedDocumentViewProps) {
  return <SharedDocumentContent classNames={classNames} document={document} markdown={markdown} token={token} />;
}
