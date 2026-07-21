"use client";

import type { FormEvent } from "react";
import { deleteDocumentAction } from "../actions";
import styles from "../board.module.css";

export function DeleteDocumentForm({ documentId }: { documentId: string }) {
  function confirmDeletion(event: FormEvent<HTMLFormElement>) {
    if (!window.confirm("删除文件会同时撤销它的全部分享链接。确定继续吗？")) {
      event.preventDefault();
    }
  }

  return (
    <form action={deleteDocumentAction} onSubmit={confirmDeletion}>
      <input name="documentId" type="hidden" value={documentId} />
      <button className={styles.dangerButton} type="submit">删除文件</button>
    </form>
  );
}
