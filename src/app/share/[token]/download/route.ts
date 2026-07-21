import { createShareDownloadResponse } from "../../../../../lib/share-board/download";
import { getShareBoardService } from "../../../../../lib/share-board/runtime";

export const dynamic = "force-dynamic";

type DownloadRouteContext = {
  params: Promise<{ token: string }>;
};

export async function GET(_request: Request, { params }: DownloadRouteContext) {
  const { token } = await params;
  const service = getShareBoardService();
  return createShareDownloadResponse(token, service.resolveShare);
}
