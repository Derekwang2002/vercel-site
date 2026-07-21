import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SharedDocumentContent } from "../../src/app/share/[token]/shared-document-content";

test("a Viewer sees only the shared HTML document and its download control", () => {
  const html = renderToStaticMarkup(
    <SharedDocumentContent
      classNames={{
        downloadLink: "download-link",
        fileName: "file-name",
        htmlDocument: "html-document",
        markdownDocument: "markdown-document",
        markdownViewport: "markdown-viewport",
        sharePage: "share-page",
        viewerToolbar: "viewer-toolbar"
      }}
      document={{
        content: "<h1>Private demo</h1>",
        createdAt: new Date("2026-07-21T00:00:00.000Z"),
        fileName: "private-demo.html",
        id: "document-1",
        kind: "html",
        sizeBytes: 21,
        title: "Private demo",
        updatedAt: new Date("2026-07-21T00:00:00.000Z")
      }}
      markdown={null}
      token="share-token"
    />
  );

  const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map((match) => match[1]);
  assert.deepEqual(hrefs, ["/share/share-token/download"]);
  assert.match(html, /<iframe/);
  assert.match(html, /sandbox="allow-scripts"/);
  assert.doesNotMatch(html, />Home<|>Blog<|>Hub<|返回|DEREK \/ SHARED FILE/);
});
