-- TiDB schema for LexMind (VECTOR functions assumed available)
CREATE TABLE IF NOT EXISTS reg_texts (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  source VARCHAR(100),
  title VARCHAR(255),
  section VARCHAR(255),
  text MEDIUMTEXT,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  embedding VECTOR(384)
);

CREATE TABLE IF NOT EXISTS corp_docs (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  path VARCHAR(512),
  chunk_idx INT,
  content MEDIUMTEXT,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  embedding VECTOR(384),
  KEY idx_path_chunk (path, chunk_idx),
  KEY idx_created (created_at)
);

CREATE TABLE IF NOT EXISTS documents_meta (
  path VARCHAR(512) PRIMARY KEY,
  display_name VARCHAR(255),
  description TEXT,
  resolved BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS mappings (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  reg_id BIGINT,
  doc_id BIGINT,
  confidence DOUBLE,
  KEY idx_reg (reg_id),
  KEY idx_doc (doc_id)
);

CREATE TABLE IF NOT EXISTS tasks (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  finding_id BIGINT,
  system VARCHAR(64),
  external_id VARCHAR(128),
  status VARCHAR(32),
  assignee VARCHAR(128),
  due_date VARCHAR(64),
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS audit_log (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  step VARCHAR(64),
  payload_json JSON,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_step (step),
  KEY idx_created (created_at)
);

CREATE TABLE IF NOT EXISTS search_logs (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user VARCHAR(128),
  role VARCHAR(32),
  query TEXT,
  top_k INT,
  duration_ms INT,
  results_json JSON,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_created (created_at)
);


