"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { matchesAdminPassword } from "../../../lib/share-board/auth";
import { MAX_DOCUMENT_BYTES } from "../../../lib/share-board/validation";
import { getShareBoardService } from "../../../lib/share-board/runtime";
import {
  endBoardSession,
  getBoardAdminPassword,
  requireBoardOwner,
  startBoardSession
} from "../../../lib/share-board/session";

export type FormState = {
  error: string | null;
};

export type ShareFormState = FormState & {
  sharePath: string | null;
};

export type ReplaceFormState = FormState & {
  updated: boolean;
};

export async function loginAction(_state: FormState, formData: FormData): Promise<FormState> {
  const password = String(formData.get("password") ?? "");
  if (!matchesAdminPassword(password, getBoardAdminPassword())) {
    return { error: "密码不正确。" };
  }

  await startBoardSession();
  redirect("/board");
}

export async function logoutAction(): Promise<void> {
  await endBoardSession();
  redirect("/board/login");
}

export async function uploadDocumentAction(
  _state: FormState,
  formData: FormData
): Promise<FormState> {
  await requireBoardOwner();
  const file = formData.get("document");
  const title = String(formData.get("title") ?? "");

  if (!(file instanceof File) || !file.name) {
    return { error: "请选择一个 Markdown 或 HTML 文件。" };
  }
  if (file.size > MAX_DOCUMENT_BYTES) {
    return { error: "文件不能超过 1 MB。" };
  }

  let documentId: string;
  try {
    const document = await getShareBoardService().createDocument({
      content: await file.text(),
      fileName: file.name,
      title
    });
    documentId = document.id;
  } catch (error) {
    return { error: getErrorMessage(error) };
  }

  revalidatePath("/board");
  redirect(`/board/${documentId}`);
}

export async function createShareAction(
  _state: ShareFormState,
  formData: FormData
): Promise<ShareFormState> {
  await requireBoardOwner();
  const documentId = String(formData.get("documentId") ?? "");
  const expiry = String(formData.get("expiry") ?? "never");

  try {
    const share = await getShareBoardService().createShare(
      documentId,
      getExpiryDate(expiry)
    );
    revalidatePath(`/board/${documentId}`);
    return { error: null, sharePath: `/share/${share.token}` };
  } catch (error) {
    return { error: getErrorMessage(error), sharePath: null };
  }
}

export async function replaceDocumentAction(
  _state: ReplaceFormState,
  formData: FormData
): Promise<ReplaceFormState> {
  await requireBoardOwner();
  const documentId = String(formData.get("documentId") ?? "");
  const file = formData.get("document");
  const title = String(formData.get("title") ?? "");

  if (!(file instanceof File) || !file.name) {
    return { error: "请选择新的 Markdown 或 HTML 文件。", updated: false };
  }
  if (file.size > MAX_DOCUMENT_BYTES) {
    return { error: "文件不能超过 1 MB。", updated: false };
  }

  try {
    await getShareBoardService().replaceDocument(documentId, {
      content: await file.text(),
      fileName: file.name,
      title
    });
    revalidatePath("/board");
    revalidatePath(`/board/${documentId}`);
    return { error: null, updated: true };
  } catch (error) {
    return { error: getErrorMessage(error), updated: false };
  }
}

export async function revokeShareAction(formData: FormData): Promise<void> {
  await requireBoardOwner();
  const documentId = String(formData.get("documentId") ?? "");
  const shareId = String(formData.get("shareId") ?? "");
  await getShareBoardService().revokeShare(shareId);
  revalidatePath(`/board/${documentId}`);
}

export async function deleteDocumentAction(formData: FormData): Promise<void> {
  await requireBoardOwner();
  const documentId = String(formData.get("documentId") ?? "");
  await getShareBoardService().deleteDocument(documentId);
  revalidatePath("/board");
  redirect("/board");
}

function getExpiryDate(value: string): Date | null {
  if (value === "never") return null;
  const days = Number(value);
  if (![1, 7, 30].includes(days)) throw new Error("无效的链接有效期。");
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "操作失败，请重试。";
}
