import assert from "node:assert/strict";
import { test } from "node:test";
import {
  HTML_SANDBOX_PERMISSIONS,
  MAX_DOCUMENT_BYTES,
  validateDocumentInput
} from "./validation";

test("uploads accept only non-empty Markdown or HTML files up to one megabyte", () => {
  assert.deepEqual(
    validateDocumentInput({ content: "# Hello", fileName: "notes.MD", title: "Notes" }),
    {
      content: "# Hello",
      fileName: "notes.MD",
      kind: "markdown",
      sizeBytes: 7,
      title: "Notes"
    }
  );
  assert.equal(
    validateDocumentInput({ content: "<h1>Hello</h1>", fileName: "page.html", title: "Page" }).kind,
    "html"
  );
  assert.throws(
    () => validateDocumentInput({ content: "text", fileName: "notes.txt", title: "Notes" }),
    /Markdown.*HTML/i
  );
  assert.throws(
    () => validateDocumentInput({ content: "", fileName: "empty.md", title: "Empty" }),
    /empty/i
  );
  assert.throws(
    () =>
      validateDocumentInput({
        content: "a".repeat(MAX_DOCUMENT_BYTES + 1),
        fileName: "large.md",
        title: "Large"
      }),
    /1 MB/i
  );
});

test("shared HTML runs scripts without receiving same-origin privileges", () => {
  assert.equal(HTML_SANDBOX_PERMISSIONS, "allow-scripts");
  assert.doesNotMatch(HTML_SANDBOX_PERMISSIONS, /allow-same-origin|allow-top-navigation|allow-forms/);
});
