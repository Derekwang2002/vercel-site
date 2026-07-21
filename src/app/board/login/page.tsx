import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { isBoardOwner } from "../../../../lib/share-board/session";
import { LoginForm } from "./login-form";
import styles from "../board.module.css";

export const metadata: Metadata = {
  title: "Share Board Login",
  robots: { index: false, follow: false }
};

export const dynamic = "force-dynamic";

export default async function BoardLoginPage() {
  if (await isBoardOwner()) redirect("/board");

  return (
    <main className={styles.loginPage}>
      <section className={styles.loginPanel}>
        <p className={styles.eyebrow}>PRIVATE DESK / 01</p>
        <h1 className={styles.displayTitle}>Share Board</h1>
        <p className={styles.lede}>
          上传本地 Markdown 或 HTML，为每个文件创建独立、可撤销的访问链接。
        </p>
        <LoginForm />
      </section>
    </main>
  );
}
