import assert from "node:assert/strict";
import test from "node:test";
import { isSiteChromeVisible } from "../../src/components/site-chrome";

test("site navigation and footer are absent from every Share route", () => {
  assert.equal(isSiteChromeVisible("/share/share-token"), false);
  assert.equal(isSiteChromeVisible("/share/share-token/download"), false);
  assert.equal(isSiteChromeVisible("/board"), true);
  assert.equal(isSiteChromeVisible("/blog"), true);
});
