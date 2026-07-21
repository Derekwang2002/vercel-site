import assert from "node:assert/strict";
import { test } from "node:test";
import { createShareBoardService } from "./service";
import type {
  BoardDocument,
  BoardShare,
  ShareBoardRepository
} from "./types";

test("a share resolves exactly its bound document", async () => {
  const repository = createMemoryRepository();
  let sequence = 0;
  const service = createShareBoardService({
    repository,
    generateId: () => `id-${++sequence}`,
    generateToken: () => "unguessable-token",
    now: () => new Date("2026-07-20T12:00:00.000Z")
  });

  const first = await service.createDocument({
    content: "# First",
    fileName: "first.md",
    title: "First"
  });
  await service.createDocument({
    content: "# Private second",
    fileName: "second.md",
    title: "Second"
  });
  const share = await service.createShare(first.id);

  assert.equal(share.token, "unguessable-token");
  assert.deepEqual(await service.resolveShare(share.token), {
    document: first,
    expiresAt: null
  });
  assert.equal(await service.resolveShare("another-token"), null);
});

test("revoked and expired shares no longer resolve", async () => {
  const repository = createMemoryRepository();
  let now = new Date("2026-07-20T12:00:00.000Z");
  let sequence = 0;
  const service = createShareBoardService({
    repository,
    generateId: () => `id-${++sequence}`,
    generateToken: () => `token-${sequence}`,
    now: () => now
  });
  const document = await service.createDocument({
    content: "# Shared",
    fileName: "shared.md",
    title: "Shared"
  });
  const expiring = await service.createShare(
    document.id,
    new Date("2026-07-20T12:30:00.000Z")
  );

  assert.notEqual(await service.resolveShare(expiring.token), null);
  now = new Date("2026-07-20T12:30:00.000Z");
  assert.equal(await service.resolveShare(expiring.token), null);

  now = new Date("2026-07-20T12:10:00.000Z");
  const revoked = await service.createShare(document.id);
  await service.revokeShare(revoked.id);
  assert.equal(await service.resolveShare(revoked.token), null);
});

test("the owner can list documents and deletion removes their shares", async () => {
  const repository = createMemoryRepository();
  let sequence = 0;
  const service = createShareBoardService({
    repository,
    generateId: () => `id-${++sequence}`,
    generateToken: () => "share-token",
    now: () => new Date("2026-07-20T12:00:00.000Z")
  });
  const document = await service.createDocument({
    content: "<h1>Demo</h1>",
    fileName: "demo.html",
    title: "Demo"
  });
  const share = await service.createShare(document.id);

  assert.deepEqual(await service.listDocuments(), [document]);
  assert.deepEqual(await service.getDocument(document.id), document);
  assert.deepEqual(await service.listShares(document.id), [
    {
      createdAt: share.createdAt,
      expiresAt: null,
      id: share.id,
      revokedAt: null
    }
  ]);
  await service.deleteDocument(document.id);
  assert.deepEqual(await service.listDocuments(), []);
  assert.equal(await service.resolveShare(share.token), null);
});

test("the owner can replace a document without changing its share link", async () => {
  const repository = createMemoryRepository();
  let now = new Date("2026-07-20T12:00:00.000Z");
  let sequence = 0;
  const service = createShareBoardService({
    repository,
    generateId: () => `id-${++sequence}`,
    generateToken: () => "stable-share-token",
    now: () => now
  });
  const document = await service.createDocument({
    content: "# Version one",
    fileName: "guide.md",
    title: "Guide"
  });
  const share = await service.createShare(document.id);

  now = new Date("2026-07-20T13:00:00.000Z");
  const replaced = await service.replaceDocument(document.id, {
    content: "# Version two",
    fileName: "guide.md",
    title: "Guide updated"
  });

  assert.equal(replaced.id, document.id);
  assert.equal(replaced.updatedAt.toISOString(), "2026-07-20T13:00:00.000Z");
  assert.equal((await service.resolveShare(share.token))?.document.content, "# Version two");
});

function createMemoryRepository(): ShareBoardRepository {
  const documents = new Map<string, BoardDocument>();
  const shares = new Map<string, BoardShare>();

  return {
    async deleteDocument(id) {
      documents.delete(id);
      for (const [shareId, share] of shares) {
        if (share.documentId === id) shares.delete(shareId);
      }
    },
    async findDocumentById(id) {
      return documents.get(id) ?? null;
    },
    async findShareByTokenHash(tokenHash) {
      return Array.from(shares.values()).find((share) => share.tokenHash === tokenHash) ?? null;
    },
    async insertDocument(document) {
      documents.set(document.id, document);
    },
    async insertShare(share) {
      shares.set(share.id, share);
    },
    async listDocuments() {
      return Array.from(documents.values());
    },
    async listSharesByDocumentId(documentId) {
      return Array.from(shares.values()).filter((share) => share.documentId === documentId);
    },
    async revokeShare(id, revokedAt) {
      const share = shares.get(id);
      if (share) shares.set(id, { ...share, revokedAt });
    },
    async updateDocument(document) {
      documents.set(document.id, document);
    }
  };
}
