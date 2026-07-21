import type { BoardDocument } from "./types";

type ShareResolution = {
  document: BoardDocument;
  expiresAt: Date | null;
};

type ResolveShare = (token: string) => Promise<ShareResolution | null>;

export async function createShareDownloadResponse(
  token: string,
  resolveShare: ResolveShare
): Promise<Response> {
  const resolved = await resolveShare(token);
  return createDocumentDownloadResponse(resolved?.document ?? null);
}

export function createDocumentDownloadResponse(document: BoardDocument | null): Response {
  if (!document) {
    return new Response("Not found", {
      headers: { "Cache-Control": "private, no-store" },
      status: 404
    });
  }

  return new Response(document.content, {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Disposition": contentDisposition(document.fileName),
      "Content-Type": document.kind === "html"
        ? "text/html; charset=utf-8"
        : "text/markdown; charset=utf-8",
      "X-Content-Type-Options": "nosniff"
    }
  });
}

function contentDisposition(fileName: string): string {
  const asciiFallback = fileName
    .replace(/[^\x20-\x7e]/g, "_")
    .replace(/["\\]/g, "_");
  const encoded = encodeURIComponent(fileName).replace(
    /[!'()*]/g,
    (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`
  );
  return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encoded}`;
}
