import { createHash, createHmac, timingSafeEqual } from "node:crypto";

type SessionPayload = {
  expiresAt: number;
};

export function matchesAdminPassword(candidate: string, configuredPassword: string): boolean {
  if (!candidate || !configuredPassword) return false;

  return timingSafeEqual(hash(candidate), hash(configuredPassword));
}

export function createAdminSession(
  secret: string,
  now = new Date(),
  lifetimeSeconds = 60 * 60 * 24 * 7
): string {
  const payload = Buffer.from(
    JSON.stringify({ expiresAt: Math.floor(now.getTime() / 1000) + lifetimeSeconds } satisfies SessionPayload)
  ).toString("base64url");

  return `${payload}.${sign(payload, secret)}`;
}

export function verifyAdminSession(token: string, secret: string, now = new Date()): boolean {
  if (!token || !secret) return false;

  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra) return false;

  try {
    if (!timingSafeEqual(Buffer.from(signature), Buffer.from(sign(payload, secret)))) {
      return false;
    }

    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as SessionPayload;
    return Number.isInteger(parsed.expiresAt) && parsed.expiresAt >= Math.floor(now.getTime() / 1000);
  } catch {
    return false;
  }
}

function hash(value: string): Buffer {
  return createHash("sha256").update(value, "utf8").digest();
}

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload, "utf8").digest("base64url");
}
