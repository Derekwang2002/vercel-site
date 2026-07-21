import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  PrivateDocumentLink,
  PrivateRepoBackLink,
  PrivateDocumentDownloadLink
} from "../../src/app/private/navigation";

test("Private Repo navigation forms a complete repository and document loop", () => {
  const toDocument = renderToStaticMarkup(
    <PrivateDocumentLink documentId="document-123">Example</PrivateDocumentLink>
  );
  const toRepository = renderToStaticMarkup(<PrivateRepoBackLink />);
  const toDownload = renderToStaticMarkup(
    <PrivateDocumentDownloadLink documentId="document-123" fileName="example.md" />
  );

  assert.match(toDocument, /href="\/private\/document-123"/);
  assert.match(toRepository, /href="\/private"/);
  assert.match(toDownload, /download="example.md"/);
  assert.match(toDownload, /href="\/private\/document-123\/download"/);
});
