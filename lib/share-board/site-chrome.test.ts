import assert from "node:assert/strict";
import test from "node:test";
import { isSiteChromeVisible } from "../../src/components/site-chrome";

test("site navigation and footer are absent from every Share route", () => {
  assert.equal(isSiteChromeVisible("/share/share-token"), false);
  assert.equal(isSiteChromeVisible("/share/share-token/download"), false);
  assert.equal(isSiteChromeVisible("/board"), true);
  assert.equal(isSiteChromeVisible("/blog"), true);
});

test("the unlisted Private Repo has no public-site navigation or footer", () => {
  assert.equal(isSiteChromeVisible("/private"), false);
  assert.equal(isSiteChromeVisible("/private/document-1"), false);
  assert.equal(isSiteChromeVisible("/private/document-1/download"), false);
});
