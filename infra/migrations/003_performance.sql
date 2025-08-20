USE lexmind;

-- Advanced performance optimizations for LexMind

-- Optimize document listing query with composite index
CREATE INDEX IF NOT EXISTS idx_corp_docs_perf_listing ON corp_docs(path, created_at DESC, id);

-- Optimize coverage detail query 
CREATE INDEX IF NOT EXISTS idx_mappings_coverage_detail ON mappings(reg_id, confidence DESC, doc_id);

-- Optimize recent documents query
CREATE INDEX IF NOT EXISTS idx_corp_docs_recent ON corp_docs(created_at DESC, path);
CREATE INDEX IF NOT EXISTS idx_reg_texts_recent ON reg_texts(created_at DESC, id, title, source);

-- Query optimization for hybrid search
-- Note: Vector similarity search is already optimized by TiDB's vector index
CREATE INDEX IF NOT EXISTS idx_reg_texts_search ON reg_texts(id, section, text(500));

-- Audit log performance (for compliance tracking)
CREATE INDEX IF NOT EXISTS idx_audit_log_perf ON audit_log(created_at DESC, step, id);

-- Clean up test data and optimize tables (run periodically)
-- ANALYZE TABLE corp_docs;
-- ANALYZE TABLE reg_texts; 
-- ANALYZE TABLE mappings;
-- ANALYZE TABLE audit_log;

-- Table statistics update (uncomment to run)
-- UPDATE STATISTICS corp_docs;
-- UPDATE STATISTICS reg_texts;
-- UPDATE STATISTICS mappings;