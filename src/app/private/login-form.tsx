"use client";

import { useActionState } from "react";
import {
  privateRepoLoginAction,
  type PrivateRepoFormState
} from "./actions";
import styles from "./private.module.css";

const initialState: PrivateRepoFormState = { error: null };

export function PrivateRepoLoginForm() {
  const [state, action, pending] = useActionState(
    privateRepoLoginAction,
    initialState
  );

  return (
    <form action={action} className={styles.loginForm}>
      <label className={styles.fieldLabel} htmlFor="private-repo-password">
        私有库密码
      </label>
      <input
        autoComplete="current-password"
        autoFocus
        className={styles.passwordInput}
        id="private-repo-password"
        name="password"
        required
        type="password"
      />
      {state.error ? <p className={styles.formError}>{state.error}</p> : null}
      <button className={styles.primaryButton} disabled={pending} type="submit">
        {pending ? "正在验证…" : "进入 Private Repo"}
      </button>
    </form>
  );
}
