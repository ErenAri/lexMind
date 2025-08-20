USE lexmind;

-- Performance indexes for common query patterns

-- Corp docs indexes (document content and retrieval)
CREATE INDEX IF NOT EXISTS idx_corp_docs_path ON corp_docs(path);
CREATE INDEX IF NOT EXISTS idx_corp_docs_path_chunk ON corp_docs(path, chunk_idx);
CREATE INDEX IF NOT EXISTS idx_corp_docs_created_at ON corp_docs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_corp_docs_path_created ON corp_docs(path, created_at DESC);

-- Regulation texts indexes  
CREATE INDEX IF NOT EXISTS idx_reg_texts_created_at ON reg_texts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reg_texts_title ON reg_texts(title);
CREATE INDEX IF NOT EXISTS idx_reg_texts_source ON reg_texts(source);
CREATE INDEX IF NOT EXISTS idx_reg_texts_section ON reg_texts(section);

-- Coverage and mappings indexes
CREATE INDEX IF NOT EXISTS idx_mappings_reg ON mappings(reg_id);
CREATE INDEX IF NOT EXISTS idx_mappings_doc ON mappings(doc_id);
CREATE INDEX IF NOT EXISTS idx_mappings_confidence ON mappings(confidence DESC);
CREATE INDEX IF NOT EXISTS idx_mappings_reg_confidence ON mappings(reg_id, confidence DESC);

-- Document metadata indexes
CREATE INDEX IF NOT EXISTS idx_documents_meta_path ON documents_meta(path);
CREATE INDEX IF NOT EXISTS idx_documents_meta_resolved ON documents_meta(resolved);

-- Task management indexes
CREATE INDEX IF NOT EXISTS idx_tasks_finding ON tasks(finding_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON tasks(assignee);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);

-- Findings indexes
CREATE INDEX IF NOT EXISTS idx_findings_reg ON findings(reg_id);
CREATE INDEX IF NOT EXISTS idx_findings_doc ON findings(doc_id);
CREATE INDEX IF NOT EXISTS idx_findings_created_at ON findings(created_at DESC);

-- Full-text search optimization (if using MySQL/TiDB FTS)
-- CREATE FULLTEXT INDEX IF NOT EXISTS ft_reg_texts_text ON reg_texts(text);
-- CREATE FULLTEXT INDEX IF NOT EXISTS ft_corp_docs_content ON corp_docs(content);

-- Audit log indexes for compliance tracking
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_step ON audit_log(step);

-- Vector search optimization (TiDB vector index)
-- Note: Vector indexes in TiDB are created differently and may need special syntax
-- ALTER TABLE corp_docs ADD VECTOR INDEX idx_corp_docs_embedding(embedding);

