import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  createAdminSession,
  createPrivateReaderSession,
  verifyAdminSession,
  verifyPrivateReaderSession
} from "./auth";

const SESSION_COOKIE = "derek_board_session";
const PRIVATE_REPO_SESSION_COOKIE = "derek_private_repo_session";
const SESSION_LIFETIME_SECONDS = 60 * 60 * 24 * 7;

export async function isBoardOwner(): Promise<boolean> {
  const secret = process.env.BOARD_SESSION_SECRET?.trim();
  if (!secret) return false;

  const token = (await cookies()).get(SESSION_COOKIE)?.value ?? "";
  return verifyAdminSession(token, secret);
}

export async function requireBoardOwner(): Promise<void> {
  if (!(await isBoardOwner())) redirect("/board/login");
}

export async function isPrivateRepoReader(): Promise<boolean> {
  const secret = process.env.BOARD_SESSION_SECRET?.trim();
  if (!secret) return false;

  const token = (await cookies()).get(PRIVATE_REPO_SESSION_COOKIE)?.value ?? "";
  return verifyPrivateReaderSession(token, secret);
}

export async function requirePrivateRepoReader(): Promise<void> {
  if (!(await isPrivateRepoReader())) redirect("/private");
}

export async function startBoardSession(): Promise<void> {
  const secret = requiredEnvironmentValue("BOARD_SESSION_SECRET");
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, createAdminSession(secret), {
    httpOnly: true,
    maxAge: SESSION_LIFETIME_SECONDS,
    path: "/board",
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production"
  });
}

export async function endBoardSession(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}

export async function startPrivateRepoSession(): Promise<void> {
  const secret = requiredEnvironmentValue("BOARD_SESSION_SECRET");
  const cookieStore = await cookies();
  cookieStore.set(
    PRIVATE_REPO_SESSION_COOKIE,
    createPrivateReaderSession(secret),
    privateRepoCookieOptions(SESSION_LIFETIME_SECONDS)
  );
}

export async function endPrivateRepoSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(PRIVATE_REPO_SESSION_COOKIE, "", privateRepoCookieOptions(0));
}

export function getBoardAdminPassword(): string {
  return requiredEnvironmentValue("BOARD_ADMIN_PASSWORD");
}

export function getPrivateRepoPassword(): string {
  return requiredEnvironmentValue("PRIVATE_REPO_PASSWORD");
}

function privateRepoCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    maxAge,
    path: "/private",
    sameSite: "strict" as const,
    secure: process.env.NODE_ENV === "production"
  };
}

function requiredEnvironmentValue(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required for private content access.`);
  return value;
}
