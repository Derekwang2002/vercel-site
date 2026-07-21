import assert from "node:assert/strict";
import test from "node:test";
import { createShareDownloadResponse } from "./download";

test("a Viewer downloads the file bound to the supplied Share Token", async () => {
  let resolvedToken = "";
  const response = await createShareDownloadResponse("share-token", async (token) => {
    resolvedToken = token;
    return {
      document: {
        content: "<h1>LRU cache</h1>",
        createdAt: new Date("2026-07-21T00:00:00.000Z"),
        fileName: "LRU 缓存.html",
        id: "document-1",
        kind: "html",
        sizeBytes: 18,
        title: "LRU cache",
        updatedAt: new Date("2026-07-21T00:00:00.000Z")
      },
      expiresAt: null
    };
  });

  assert.equal(resolvedToken, "share-token");
  assert.equal(response.status, 200);
  assert.equal(await response.text(), "<h1>LRU cache</h1>");
  assert.equal(response.headers.get("content-type"), "text/html; charset=utf-8");
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.equal(
    response.headers.get("content-disposition"),
    "attachment; filename=\"LRU __.html\"; filename*=UTF-8''LRU%20%E7%BC%93%E5%AD%98.html"
  );
});

test("an invalid Share Token cannot download a document", async () => {
  const response = await createShareDownloadResponse("invalid-token", async () => null);

  assert.equal(response.status, 404);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.equal(response.headers.get("content-disposition"), null);
});
