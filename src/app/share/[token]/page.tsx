import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getMarkdownHeadings, renderMarkdown } from "@/components/markdown-renderer";
import { getShareBoardService } from "../../../../lib/share-board/runtime";
import { SharedDocumentView } from "./shared-document-view";

export const metadata: Metadata = {
  title: "Shared Document",
  robots: { index: false, follow: false, nocache: true }
};

export const dynamic = "force-dynamic";

type SharePageProps = {
  params: Promise<{ token: string }>;
};

export default async function SharePage({ params }: SharePageProps) {
  const { token } = await params;
  const resolved = await getShareBoardService().resolveShare(token);
  if (!resolved) notFound();

  const { document } = resolved;
  const markdown = document.kind === "markdown"
    ? await renderMarkdown(document.content, getMarkdownHeadings(document.content))
    : null;

  return <SharedDocumentView document={document} markdown={markdown} token={token} />;
}
