CREATE TABLE IF NOT EXISTS board_documents (
  id uuid PRIMARY KEY,
  title text NOT NULL,
  file_name text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('markdown', 'html')),
  content text NOT NULL,
  size_bytes integer NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 1048576),
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS board_shares (
  id uuid PRIMARY KEY,
  document_id uuid NOT NULL REFERENCES board_documents(id) ON DELETE CASCADE,
  token_hash char(64) NOT NULL UNIQUE,
  created_at timestamptz NOT NULL,
  expires_at timestamptz,
  revoked_at timestamptz
);

CREATE INDEX IF NOT EXISTS board_shares_document_id_idx
  ON board_shares(document_id);
