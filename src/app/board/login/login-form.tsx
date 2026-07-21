"use client";

import { useActionState } from "react";
import { loginAction, type FormState } from "../actions";
import styles from "../board.module.css";

const initialState: FormState = { error: null };

export function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, initialState);

  return (
    <form action={action} className={styles.formStack}>
      <label className={styles.fieldLabel} htmlFor="password">
        管理员密码
      </label>
      <input
        autoComplete="current-password"
        autoFocus
        className={styles.textInput}
        id="password"
        name="password"
        required
        type="password"
      />
      {state.error ? <p className={styles.formError}>{state.error}</p> : null}
      <button className={styles.primaryButton} disabled={pending} type="submit">
        {pending ? "正在验证…" : "进入白板"}
      </button>
    </form>
  );
}
