-- Agent runs table
CREATE TABLE IF NOT EXISTS agent_runs (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  query TEXT,
  answer MEDIUMTEXT,
  sources_count INT,
  steps_json JSON,
  notified BOOLEAN,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_agent_runs_created ON agent_runs(created_at);

-- Compliance status table (dashboard)
CREATE TABLE IF NOT EXISTS document_compliance_status (
  doc_id BIGINT PRIMARY KEY,
  overall_score DOUBLE,
  risk_level VARCHAR(32),
  compliance_status VARCHAR(64),
  total_issues INT,
  critical_issues INT,
  high_issues INT,
  medium_issues INT,
  low_issues INT,
  metadata JSON,
  last_analyzed TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP
);

-- Metadata columns on source tables
ALTER TABLE reg_texts 
  ADD COLUMN IF NOT EXISTS display_name VARCHAR(255) NULL,
  ADD COLUMN IF NOT EXISTS tags VARCHAR(512) NULL;

ALTER TABLE corp_docs 
  ADD COLUMN IF NOT EXISTS display_name VARCHAR(255) NULL,
  ADD COLUMN IF NOT EXISTS section VARCHAR(255) NULL,
  ADD COLUMN IF NOT EXISTS tags VARCHAR(512) NULL;

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_corp_docs_path ON corp_docs(path);
CREATE INDEX IF NOT EXISTS idx_corp_docs_created ON corp_docs(created_at);
CREATE INDEX IF NOT EXISTS idx_dcs_last_analyzed ON document_compliance_status(last_analyzed);

