import Link from "next/link";
import React, { type ReactNode } from "react";

type PrivateDocumentLinkProps = {
  children: ReactNode;
  className?: string;
  documentId: string;
};

export function PrivateDocumentLink({
  children,
  className,
  documentId
}: PrivateDocumentLinkProps) {
  return (
    <Link className={className} href={`/private/${documentId}`}>
      {children}
    </Link>
  );
}

export function PrivateRepoBackLink() {
  return <Link href="/private">← 返回 Private Repo</Link>;
}

type PrivateDocumentDownloadLinkProps = {
  className?: string;
  documentId: string;
  fileName: string;
};

export function PrivateDocumentDownloadLink({
  className,
  documentId,
  fileName
}: PrivateDocumentDownloadLinkProps) {
  return (
    <a
      className={className}
      download={fileName}
      href={`/private/${documentId}/download`}
    >
      <span aria-hidden="true">↓</span> 下载文件
    </a>
  );
}
