"use client";

import { useActionState, useEffect, useState } from "react";
import { createShareAction, type ShareFormState } from "../actions";
import styles from "../board.module.css";

const initialState: ShareFormState = { error: null, sharePath: null };

export function ShareCreator({ documentId }: { documentId: string }) {
  const [state, action, pending] = useActionState(createShareAction, initialState);
  const [shareUrl, setShareUrl] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setShareUrl(state.sharePath ? new URL(state.sharePath, window.location.origin).toString() : "");
    setCopied(false);
  }, [state.sharePath]);

  async function copyShareUrl() {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
  }

  return (
    <div>
      <form action={action} className={styles.shareForm}>
        <input name="documentId" type="hidden" value={documentId} />
        <label className={styles.fieldLabel} htmlFor="expiry">链接有效期</label>
        <select className={styles.selectInput} defaultValue="never" id="expiry" name="expiry">
          <option value="never">永久，直到手动撤销</option>
          <option value="1">1 天</option>
          <option value="7">7 天</option>
          <option value="30">30 天</option>
        </select>
        <button className={styles.primaryButton} disabled={pending} type="submit">
          {pending ? "正在创建…" : "创建独立链接"}
        </button>
      </form>
      {state.error ? <p className={styles.formError}>{state.error}</p> : null}
      {shareUrl ? (
        <div className={styles.newShare} role="status">
          <p className={styles.newShareLabel}>链接只显示一次，请立即保存</p>
          <div className={styles.shareUrlRow}>
            <input className={styles.shareUrl} readOnly value={shareUrl} />
            <button className={styles.secondaryButton} onClick={copyShareUrl} type="button">
              {copied ? "已复制" : "复制"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
