import path from "node:path";
import type { DocumentKind } from "./types";

export const MAX_DOCUMENT_BYTES = 1024 * 1024;
export const HTML_SANDBOX_PERMISSIONS = "allow-scripts";

type DocumentInput = {
  content: string;
  fileName: string;
  title: string;
};

export function validateDocumentInput(input: DocumentInput): DocumentInput & {
  kind: DocumentKind;
  sizeBytes: number;
} {
  const fileName = path.basename(input.fileName);
  const extension = path.extname(fileName).toLowerCase();
  const kind = extension === ".md" ? "markdown" : extension === ".html" ? "html" : null;
  if (!kind) {
    throw new Error("Only Markdown (.md) and HTML (.html) files are supported.");
  }

  if (!input.content.trim()) {
    throw new Error("The uploaded document is empty.");
  }

  const sizeBytes = Buffer.byteLength(input.content, "utf8");
  if (sizeBytes > MAX_DOCUMENT_BYTES) {
    throw new Error("Documents must be 1 MB or smaller.");
  }

  const title = input.title.trim();
  if (!title) {
    throw new Error("A document title is required.");
  }

  return { content: input.content, fileName, kind, sizeBytes, title };
}
