"use client";

import { useActionState } from "react";
import { replaceDocumentAction, type ReplaceFormState } from "../actions";
import styles from "../board.module.css";

const initialState: ReplaceFormState = { error: null, updated: false };

export function ReplaceDocumentForm({
  documentId,
  title
}: {
  documentId: string;
  title: string;
}) {
  const [state, action, pending] = useActionState(replaceDocumentAction, initialState);

  return (
    <form action={action} className={styles.uploadForm}>
      <input name="documentId" type="hidden" value={documentId} />
      <div className={styles.uploadField}>
        <label className={styles.fieldLabel} htmlFor="replacement-title">显示标题</label>
        <input
          className={styles.textInput}
          defaultValue={title}
          id="replacement-title"
          name="title"
          required
          type="text"
        />
      </div>
      <div className={styles.uploadField}>
        <label className={styles.fieldLabel} htmlFor="replacement-document">替换文件</label>
        <input
          accept=".md,.html,text/markdown,text/html"
          className={styles.fileInput}
          id="replacement-document"
          name="document"
          required
          type="file"
        />
      </div>
      <div className={styles.uploadSubmit}>
        <span className={styles.fieldHint}>现有分享链接保持有效</span>
        <button className={styles.primaryButton} disabled={pending} type="submit">
          {pending ? "正在替换…" : "更新文件"}
        </button>
      </div>
      {state.error ? <p className={styles.formError}>{state.error}</p> : null}
      {state.updated ? <p className={styles.formSuccess}>文件已更新，分享链接无需更换。</p> : null}
    </form>
  );
}
