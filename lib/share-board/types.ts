export type DocumentKind = "markdown" | "html";

export type BoardDocument = {
  id: string;
  title: string;
  fileName: string;
  kind: DocumentKind;
  content: string;
  sizeBytes: number;
  createdAt: Date;
  updatedAt: Date;
};

export type BoardShare = {
  id: string;
  documentId: string;
  tokenHash: string;
  createdAt: Date;
  expiresAt: Date | null;
  revokedAt: Date | null;
};

export type ShareBoardRepository = {
  deleteDocument(id: string): Promise<void>;
  findDocumentById(id: string): Promise<BoardDocument | null>;
  findShareByTokenHash(tokenHash: string): Promise<BoardShare | null>;
  insertDocument(document: BoardDocument): Promise<void>;
  insertShare(share: BoardShare): Promise<void>;
  listDocuments(): Promise<BoardDocument[]>;
  listSharesByDocumentId(documentId: string): Promise<BoardShare[]>;
  revokeShare(id: string, revokedAt: Date): Promise<void>;
  updateDocument(document: BoardDocument): Promise<void>;
};
