import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createAdminSession,
  createPrivateReaderSession,
  matchesAdminPassword,
  verifyAdminSession,
  verifyPrivateReaderSession
} from "./auth";

test("administrator authentication accepts only the configured password", () => {
  assert.equal(matchesAdminPassword("correct horse", "correct horse"), true);
  assert.equal(matchesAdminPassword("correct-horse", "correct horse"), false);
  assert.equal(matchesAdminPassword("", "correct horse"), false);
});

test("administrator sessions reject tampering and expiration", () => {
  const now = new Date("2026-07-20T12:00:00.000Z");
  const token = createAdminSession("session secret", now, 3600);

  assert.equal(verifyAdminSession(token, "session secret", now), true);
  assert.equal(verifyAdminSession(`${token}x`, "session secret", now), false);
  assert.equal(
    verifyAdminSession(token, "session secret", new Date("2026-07-20T13:00:01.000Z")),
    false
  );
});

test("private reader sessions cannot be promoted to administrator sessions", () => {
  const now = new Date("2026-07-20T12:00:00.000Z");
  const secret = "shared signing secret";
  const readerToken = createPrivateReaderSession(secret, now, 3600);
  const administratorToken = createAdminSession(secret, now, 3600);

  assert.equal(verifyPrivateReaderSession(readerToken, secret, now), true);
  assert.equal(verifyAdminSession(readerToken, secret, now), false);
  assert.equal(verifyPrivateReaderSession(administratorToken, secret, now), false);
});
