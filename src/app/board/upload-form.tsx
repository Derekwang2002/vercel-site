"use client";

import { useActionState } from "react";
import { uploadDocumentAction, type FormState } from "./actions";
import styles from "./board.module.css";

const initialState: FormState = { error: null };

export function UploadForm() {
  const [state, action, pending] = useActionState(uploadDocumentAction, initialState);

  return (
    <form action={action} className={styles.uploadForm}>
      <div className={styles.uploadField}>
        <label className={styles.fieldLabel} htmlFor="title">
          显示标题
        </label>
        <input className={styles.textInput} id="title" name="title" required type="text" />
      </div>
      <div className={styles.uploadField}>
        <label className={styles.fieldLabel} htmlFor="document">
          本地文件
        </label>
        <input
          accept=".md,.html,text/markdown,text/html"
          className={styles.fileInput}
          id="document"
          name="document"
          required
          type="file"
        />
      </div>
      <div className={styles.uploadSubmit}>
        <span className={styles.fieldHint}>仅 .md / .html，最大 1 MB</span>
        <button className={styles.primaryButton} disabled={pending} type="submit">
          {pending ? "正在上传…" : "添加到白板"}
        </button>
      </div>
      {state.error ? <p className={styles.formError}>{state.error}</p> : null}
    </form>
  );
}
