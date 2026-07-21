import { createDocumentDownloadResponse } from "../../../../../lib/share-board/download";
import { getShareBoardService } from "../../../../../lib/share-board/runtime";
import { requirePrivateRepoReader } from "../../../../../lib/share-board/session";

export const dynamic = "force-dynamic";

type PrivateDocumentDownloadContext = {
  params: Promise<{ documentId: string }>;
};

export async function GET(
  _request: Request,
  { params }: PrivateDocumentDownloadContext
): Promise<Response> {
  await requirePrivateRepoReader();
  const { documentId } = await params;
  const document = await getShareBoardService().getDocument(documentId);
  return createDocumentDownloadResponse(document);
}
