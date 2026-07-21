import React, { type ReactNode } from "react";
import Link from "next/link";

type BoardDocumentLinkProps = {
  children: ReactNode;
  className?: string;
  documentId: string;
};

export function BoardDocumentLink({
  children,
  className,
  documentId
}: BoardDocumentLinkProps) {
  return (
    <Link className={className} href={`/board/${documentId}`}>
      {children}
    </Link>
  );
}

export function BoardBackLink() {
  return <Link href="/board">← 返回白板</Link>;
}
