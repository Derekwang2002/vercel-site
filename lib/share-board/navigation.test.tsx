import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  BoardBackLink,
  BoardDocumentLink
} from "../../src/app/board/navigation";

test("Board navigation renders a complete list and document loop", () => {
  const toDocument = renderToStaticMarkup(
    <BoardDocumentLink documentId="document-123">Example</BoardDocumentLink>
  );
  const toBoard = renderToStaticMarkup(<BoardBackLink />);

  assert.match(toDocument, /href="\/board\/document-123"/);
  assert.match(toBoard, /href="\/board"/);
});
