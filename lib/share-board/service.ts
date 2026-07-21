import { createHash, randomBytes, randomUUID } from "node:crypto";
import type {
  BoardDocument,
  BoardShare,
  ShareBoardRepository
} from "./types";
import { validateDocumentInput } from "./validation";

type ServiceDependencies = {
  repository: ShareBoardRepository;
  generateId?: () => string;
  generateToken?: () => string;
  now?: () => Date;
};

type CreateDocumentInput = {
  content: string;
  fileName: string;
  title: string;
};

export function createShareBoardService({
  repository,
  generateId = randomUUID,
  generateToken = () => randomBytes(24).toString("base64url"),
  now = () => new Date()
}: ServiceDependencies) {
  return {
    async listDocuments(): Promise<BoardDocument[]> {
      return repository.listDocuments();
    },

    async getDocument(documentId: string): Promise<BoardDocument | null> {
      return repository.findDocumentById(documentId);
    },

    async listShares(documentId: string) {
      return (await repository.listSharesByDocumentId(documentId)).map(
        ({ id, createdAt, expiresAt, revokedAt }) => ({
          id,
          createdAt,
          expiresAt,
          revokedAt
        })
      );
    },

    async createDocument(input: CreateDocumentInput): Promise<BoardDocument> {
      const validated = validateDocumentInput(input);
      const timestamp = now();
      const document: BoardDocument = {
        id: generateId(),
        title: validated.title,
        fileName: validated.fileName,
        kind: validated.kind,
        content: validated.content,
        sizeBytes: validated.sizeBytes,
        createdAt: timestamp,
        updatedAt: timestamp
      };

      await repository.insertDocument(document);
      return document;
    },

    async deleteDocument(documentId: string): Promise<void> {
      await repository.deleteDocument(documentId);
    },

    async replaceDocument(
      documentId: string,
      input: CreateDocumentInput
    ): Promise<BoardDocument> {
      const existing = await repository.findDocumentById(documentId);
      if (!existing) throw new Error("Document not found.");

      const validated = validateDocumentInput(input);
      const document: BoardDocument = {
        ...existing,
        title: validated.title,
        fileName: validated.fileName,
        kind: validated.kind,
        content: validated.content,
        sizeBytes: validated.sizeBytes,
        updatedAt: now()
      };
      await repository.updateDocument(document);
      return document;
    },

    async createShare(documentId: string, expiresAt: Date | null = null) {
      if (!(await repository.findDocumentById(documentId))) {
        throw new Error("Document not found.");
      }

      const token = generateToken();
      const share: BoardShare = {
        id: generateId(),
        documentId,
        tokenHash: hashShareToken(token),
        createdAt: now(),
        expiresAt,
        revokedAt: null
      };
      await repository.insertShare(share);

      return {
        id: share.id,
        documentId,
        token,
        createdAt: share.createdAt,
        expiresAt
      };
    },

    async revokeShare(shareId: string): Promise<void> {
      await repository.revokeShare(shareId, now());
    },

    async resolveShare(token: string) {
      const share = await repository.findShareByTokenHash(hashShareToken(token));
      const currentTime = now();
      if (
        !share ||
        share.revokedAt ||
        (share.expiresAt && share.expiresAt.getTime() <= currentTime.getTime())
      ) {
        return null;
      }

      const document = await repository.findDocumentById(share.documentId);
      return document ? { document, expiresAt: share.expiresAt } : null;
    }
  };
}

export function hashShareToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}
