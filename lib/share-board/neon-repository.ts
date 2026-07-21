import { neon } from "@neondatabase/serverless";
import type {
  BoardDocument,
  BoardShare,
  DocumentKind,
  ShareBoardRepository
} from "./types";

type DocumentRow = {
  id: string;
  title: string;
  file_name: string;
  kind: DocumentKind;
  content: string;
  size_bytes: number;
  created_at: string | Date;
  updated_at: string | Date;
};

type ShareRow = {
  id: string;
  document_id: string;
  token_hash: string;
  created_at: string | Date;
  expires_at: string | Date | null;
  revoked_at: string | Date | null;
};

export function createNeonShareBoardRepository(connectionString: string): ShareBoardRepository {
  const sql = neon(connectionString);

  return {
    async deleteDocument(id) {
      await sql.query("DELETE FROM board_documents WHERE id = $1", [id]);
    },

    async findDocumentById(id) {
      const rows = (await sql.query(
        `SELECT id, title, file_name, kind, content, size_bytes, created_at, updated_at
         FROM board_documents
         WHERE id = $1
         LIMIT 1`,
        [id]
      )) as DocumentRow[];
      return rows[0] ? mapDocument(rows[0]) : null;
    },

    async findShareByTokenHash(tokenHash) {
      const rows = (await sql.query(
        `SELECT id, document_id, token_hash, created_at, expires_at, revoked_at
         FROM board_shares
         WHERE token_hash = $1
         LIMIT 1`,
        [tokenHash]
      )) as ShareRow[];
      return rows[0] ? mapShare(rows[0]) : null;
    },

    async insertDocument(document) {
      await sql.query(
        `INSERT INTO board_documents
          (id, title, file_name, kind, content, size_bytes, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          document.id,
          document.title,
          document.fileName,
          document.kind,
          document.content,
          document.sizeBytes,
          document.createdAt.toISOString(),
          document.updatedAt.toISOString()
        ]
      );
    },

    async insertShare(share) {
      await sql.query(
        `INSERT INTO board_shares
          (id, document_id, token_hash, created_at, expires_at, revoked_at)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          share.id,
          share.documentId,
          share.tokenHash,
          share.createdAt.toISOString(),
          share.expiresAt?.toISOString() ?? null,
          share.revokedAt?.toISOString() ?? null
        ]
      );
    },

    async listDocuments() {
      const rows = (await sql.query(
        `SELECT id, title, file_name, kind, content, size_bytes, created_at, updated_at
         FROM board_documents
         ORDER BY updated_at DESC, id ASC`
      )) as DocumentRow[];
      return rows.map(mapDocument);
    },

    async listSharesByDocumentId(documentId) {
      const rows = (await sql.query(
        `SELECT id, document_id, token_hash, created_at, expires_at, revoked_at
         FROM board_shares
         WHERE document_id = $1
         ORDER BY created_at DESC, id ASC`,
        [documentId]
      )) as ShareRow[];
      return rows.map(mapShare);
    },

    async revokeShare(id, revokedAt) {
      await sql.query(
        `UPDATE board_shares
         SET revoked_at = $2
         WHERE id = $1 AND revoked_at IS NULL`,
        [id, revokedAt.toISOString()]
      );
    },

    async updateDocument(document) {
      await sql.query(
        `UPDATE board_documents
         SET title = $2,
             file_name = $3,
             kind = $4,
             content = $5,
             size_bytes = $6,
             updated_at = $7
         WHERE id = $1`,
        [
          document.id,
          document.title,
          document.fileName,
          document.kind,
          document.content,
          document.sizeBytes,
          document.updatedAt.toISOString()
        ]
      );
    }
  };
}

function mapDocument(row: DocumentRow): BoardDocument {
  return {
    id: row.id,
    title: row.title,
    fileName: row.file_name,
    kind: row.kind,
    content: row.content,
    sizeBytes: Number(row.size_bytes),
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at)
  };
}

function mapShare(row: ShareRow): BoardShare {
  return {
    id: row.id,
    documentId: row.document_id,
    tokenHash: row.token_hash,
    createdAt: new Date(row.created_at),
    expiresAt: row.expires_at ? new Date(row.expires_at) : null,
    revokedAt: row.revoked_at ? new Date(row.revoked_at) : null
  };
}
