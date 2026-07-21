"use server";

import { redirect } from "next/navigation";
import { matchesAdminPassword } from "../../../lib/share-board/auth";
import {
  endPrivateRepoSession,
  getPrivateRepoPassword,
  startPrivateRepoSession
} from "../../../lib/share-board/session";

export type PrivateRepoFormState = {
  error: string | null;
};

export async function privateRepoLoginAction(
  _state: PrivateRepoFormState,
  formData: FormData
): Promise<PrivateRepoFormState> {
  const password = String(formData.get("password") ?? "");
  if (!matchesAdminPassword(password, getPrivateRepoPassword())) {
    return { error: "密码不正确。" };
  }

  await startPrivateRepoSession();
  redirect("/private");
}

export async function privateRepoLogoutAction(): Promise<void> {
  await endPrivateRepoSession();
  redirect("/private");
}
