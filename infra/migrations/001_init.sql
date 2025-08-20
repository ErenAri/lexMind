CREATE DATABASE IF NOT EXISTS lexmind;
USE lexmind;

CREATE TABLE IF NOT EXISTS reg_texts (
  id BIGINT PRIMARY KEY AUTO_RANDOM,
  source VARCHAR(255),
  title VARCHAR(255),
  section VARCHAR(255),
  text TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FULLTEXT INDEX fts_text (text)
);

CREATE TABLE IF NOT EXISTS corp_docs (
  id BIGINT PRIMARY KEY AUTO_RANDOM,
  path VARCHAR(255),
  chunk_idx INT,
  content TEXT,
  embedding VECTOR(1536) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  VECTOR INDEX hnsw_index ((VEC_COSINE_DISTANCE(embedding))) USING HNSW
);

CREATE TABLE IF NOT EXISTS findings (
  id BIGINT PRIMARY KEY AUTO_RANDOM,
  reg_id BIGINT,
  doc_id BIGINT,
  risk_score DECIMAL(3,2),
  rationale TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tasks (
  id BIGINT PRIMARY KEY AUTO_RANDOM,
  finding_id BIGINT,
  system VARCHAR(255),
  external_id VARCHAR(255),
  status VARCHAR(64),
  assignee VARCHAR(255),
  due_date DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS audit_log (
  id BIGINT PRIMARY KEY AUTO_RANDOM,
  step VARCHAR(255),
  payload_json JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Optional metadata for documents (display name, description, resolution state)
CREATE TABLE IF NOT EXISTS documents_meta (
  path VARCHAR(255) PRIMARY KEY,
  display_name VARCHAR(255),
  description TEXT,
  resolved BOOLEAN DEFAULT FALSE,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Links between regulations and document chunks (evidence)
CREATE TABLE IF NOT EXISTS mappings (
  id BIGINT PRIMARY KEY AUTO_RANDOM,
  reg_id BIGINT NOT NULL,
  doc_id BIGINT NOT NULL,
  confidence DECIMAL(3,2) DEFAULT 0.80,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);